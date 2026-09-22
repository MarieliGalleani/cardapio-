import type { Prisma } from '@prisma/client'
import { actualMargin, calculateRecipeCost, type RecipeCost } from '../domain/pricing.js'
import { num } from '../lib/serialize.js'
import { prisma } from '../lib/prisma.js'

export const recipeInclude = {
  items: { include: { stockItem: true }, orderBy: { stockItem: { name: 'asc' } } },
  product: { select: { id: true, name: true, price: true } },
  variation: { select: { id: true, name: true, price: true, product: { select: { id: true, name: true } } } },
} satisfies Prisma.RecipeInclude

export type RecipeWithItems = Prisma.RecipeGetPayload<{ include: typeof recipeInclude }>

export interface RecipeSummary extends RecipeCost {
  salePrice: number | null // preço atual no cardápio
  actualMargin: number | null
  belowTarget: boolean
}

// O custo é sempre calculado na hora a partir do custo atual de cada item de
// estoque. Por isso, quando o preço de compra de um ingrediente muda, todas as
// receitas que o usam já aparecem recalculadas.
export function summarizeRecipe(r: RecipeWithItems): RecipeSummary {
  const cost = calculateRecipeCost({
    yieldQuantity: num(r.yieldQuantity),
    targetMargin: num(r.targetMargin),
    packagingCostPerUnit: num(r.packagingCostPerUnit),
    energyCost: num(r.energyCost),
    laborCost: num(r.laborCost),
    appFeePercent: num(r.appFeePercent),
    items: r.items.map((i) => ({ quantity: num(i.quantity), unitCost: num(i.stockItem.unitCost) })),
  })
  const salePrice = r.variation ? num(r.variation.price) : r.product ? num(r.product.price) : null
  const margin = salePrice ? actualMargin(salePrice, cost.unitCost, num(r.appFeePercent)) : null
  return {
    ...cost,
    salePrice,
    actualMargin: margin,
    belowTarget: margin !== null && margin < num(r.targetMargin),
  }
}

export function recipeLabel(r: RecipeWithItems): string {
  if (r.variation) return `${r.variation.product.name} — ${r.variation.name}`
  return r.product?.name ?? 'Receita sem produto'
}

// Receitas que usam algum dos itens de estoque e ficaram abaixo da margem desejada.
export async function recipesBelowTarget(stockItemIds?: string[]) {
  const recipes = await prisma.recipe.findMany({
    where: stockItemIds ? { items: { some: { stockItemId: { in: stockItemIds } } } } : undefined,
    include: recipeInclude,
  })
  return recipes
    .map((r) => ({ id: r.id, label: recipeLabel(r), targetMargin: num(r.targetMargin), ...summarizeRecipe(r) }))
    .filter((r) => r.belowTarget)
}

// Com o controle de estoque ligado, um produto só fica disponível se houver
// ingrediente para produzir pelo menos 1 unidade.
export function hasStockForOneUnit(r: RecipeWithItems | null | undefined): boolean {
  if (!r) return true
  const yieldQty = num(r.yieldQuantity)
  return r.items.every((i) => num(i.stockItem.quantity) >= num(i.quantity) / yieldQty)
}
