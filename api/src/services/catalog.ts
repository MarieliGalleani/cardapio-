import type { Prisma } from '@prisma/client'
import type { CatalogProduct } from '../domain/cart.js'
import { num } from '../lib/serialize.js'
import { hasStockForOneUnit, recipeInclude } from './recipes.js'

export const catalogInclude = {
  category: { select: { active: true } },
  recipe: { include: recipeInclude },
  variations: { orderBy: { sortOrder: 'asc' }, include: { recipe: { include: recipeInclude } } },
  addonGroups: {
    orderBy: { sortOrder: 'asc' },
    include: { group: { include: { addons: { orderBy: { sortOrder: 'asc' } } } } },
  },
} satisfies Prisma.ProductInclude

export type CatalogRow = Prisma.ProductGetPayload<{ include: typeof catalogInclude }>

// Disponibilidade vista pelo cliente: chave manual + categoria ativa + (se ligado) estoque
export function toCatalogProduct(p: CatalogRow, stockControl: boolean): CatalogProduct {
  const inStock = (r: Parameters<typeof hasStockForOneUnit>[0]) => !stockControl || hasStockForOneUnit(r)
  const variations = p.variations.map((v) => ({
    id: v.id,
    name: v.name,
    price: num(v.price),
    available: v.available && inStock(v.recipe),
  }))
  return {
    id: p.id,
    name: p.name,
    price: num(p.price),
    promoPrice: p.promoPrice == null ? null : num(p.promoPrice),
    available:
      p.available &&
      p.category.active &&
      inStock(p.recipe) &&
      (variations.length === 0 || variations.some((v) => v.available)),
    variations,
    addonGroups: p.addonGroups.map(({ group }) => ({
      id: group.id,
      name: group.name,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      addons: group.addons.map((a) => ({ id: a.id, name: a.name, price: num(a.price), available: a.available })),
    })),
  }
}
