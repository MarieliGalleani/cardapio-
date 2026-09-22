// Cálculo da ficha técnica e do preço sugerido.
//
// Regra do documento de requisitos:
//   preço sugerido = custo por unidade ÷ (1 − margem desejada)
// A taxa do app de delivery é uma porcentagem do preço de venda, então ela entra
// no divisor junto com a margem: custo ÷ (1 − margem − taxa). Sem taxa, a fórmula
// é exatamente a do documento.

export interface RecipeInput {
  yieldQuantity: number
  targetMargin: number // 0.30 = 30%
  packagingCostPerUnit: number
  energyCost: number
  laborCost: number
  appFeePercent: number // 0.12 = 12%
  items: { quantity: number; unitCost: number }[]
}

export interface RecipeCost {
  ingredientsCost: number // soma dos ingredientes da receita inteira
  indirectCost: number // gás/energia + mão de obra + embalagens (receita inteira)
  totalCost: number // custo da receita inteira
  unitCost: number // custo por unidade
  suggestedUnitPrice: number | null // null quando margem + taxa ≥ 100%
  suggestedBatchPrice: number | null
}

export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals
  return Math.round((value + Number.EPSILON) * f) / f
}

export function calculateRecipeCost(r: RecipeInput): RecipeCost {
  if (r.yieldQuantity <= 0) throw new Error('O rendimento precisa ser maior que zero')

  const ingredientsCost = r.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)
  const indirectCost = r.energyCost + r.laborCost + r.packagingCostPerUnit * r.yieldQuantity
  const totalCost = ingredientsCost + indirectCost
  const unitCost = totalCost / r.yieldQuantity

  const divisor = 1 - r.targetMargin - r.appFeePercent
  const suggestedUnitPrice = divisor > 0 ? unitCost / divisor : null

  return {
    ingredientsCost: round(ingredientsCost),
    indirectCost: round(indirectCost),
    totalCost: round(totalCost),
    unitCost: round(unitCost),
    suggestedUnitPrice: suggestedUnitPrice === null ? null : round(suggestedUnitPrice),
    suggestedBatchPrice: suggestedUnitPrice === null ? null : round(suggestedUnitPrice * r.yieldQuantity),
  }
}

// Margem real que o preço de venda atual entrega, já descontada a taxa do app.
export function actualMargin(salePrice: number, unitCost: number, appFeePercent: number): number | null {
  if (salePrice <= 0) return null
  return round((salePrice - unitCost - salePrice * appFeePercent) / salePrice, 4)
}

// ─── Unidades ───────────────────────────────────────────────────────────────

export type BaseUnit = 'G' | 'ML' | 'UN'
export type PurchaseUnit = 'G' | 'KG' | 'ML' | 'L' | 'UN' | 'DZ'

const TO_BASE: Record<PurchaseUnit, { base: BaseUnit; factor: number }> = {
  G: { base: 'G', factor: 1 },
  KG: { base: 'G', factor: 1000 },
  ML: { base: 'ML', factor: 1 },
  L: { base: 'ML', factor: 1000 },
  UN: { base: 'UN', factor: 1 },
  DZ: { base: 'UN', factor: 12 },
}

// Converte uma quantidade comprada (ex.: 5 kg) para a unidade base do item (5000 g).
export function toBaseUnit(quantity: number, from: PurchaseUnit, itemUnit: BaseUnit): number {
  const conv = TO_BASE[from]
  if (conv.base !== itemUnit) {
    throw new Error(`Não dá para converter ${from} em ${itemUnit}`)
  }
  return quantity * conv.factor
}
