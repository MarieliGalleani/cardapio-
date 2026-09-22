import { describe, expect, it } from 'vitest'
import { actualMargin, calculateRecipeCost, toBaseUnit } from './pricing.js'

const brigadeiro = {
  yieldQuantity: 30,
  targetMargin: 0.3,
  packagingCostPerUnit: 0,
  energyCost: 0,
  laborCost: 0,
  appFeePercent: 0,
  items: [
    { quantity: 395, unitCost: 0.02 }, // leite condensado: R$ 7,90 por 395 g
    { quantity: 50, unitCost: 0.04 }, // chocolate em pó
    { quantity: 20, unitCost: 0.05 }, // manteiga
  ],
}

describe('calculateRecipeCost', () => {
  it('soma os ingredientes e divide pelo rendimento', () => {
    const r = calculateRecipeCost(brigadeiro)
    expect(r.ingredientsCost).toBe(10.9)
    expect(r.totalCost).toBe(10.9)
    expect(r.unitCost).toBe(0.36)
  })

  it('usa preço = custo ÷ (1 − margem)', () => {
    const r = calculateRecipeCost(brigadeiro)
    // 0,3633... ÷ 0,7 = 0,519
    expect(r.suggestedUnitPrice).toBe(0.52)
    expect(r.suggestedBatchPrice).toBe(15.57)
  })

  it('inclui custos indiretos por receita e embalagem por unidade', () => {
    const r = calculateRecipeCost({ ...brigadeiro, energyCost: 3, laborCost: 15, packagingCostPerUnit: 0.1 })
    expect(r.indirectCost).toBe(21) // 3 + 15 + 0,10 × 30
    expect(r.totalCost).toBe(31.9)
    expect(r.unitCost).toBe(1.06)
  })

  it('desconta a taxa do app junto com a margem', () => {
    const r = calculateRecipeCost({ ...brigadeiro, items: [{ quantity: 1, unitCost: 30 }], appFeePercent: 0.2 })
    // custo unitário 1,00 ÷ (1 − 0,3 − 0,2) = 2,00
    expect(r.suggestedUnitPrice).toBe(2)
  })

  it('não sugere preço quando margem + taxa chegam a 100%', () => {
    const r = calculateRecipeCost({ ...brigadeiro, targetMargin: 0.8, appFeePercent: 0.2 })
    expect(r.suggestedUnitPrice).toBeNull()
  })

  it('rejeita rendimento zero', () => {
    expect(() => calculateRecipeCost({ ...brigadeiro, yieldQuantity: 0 })).toThrow()
  })
})

describe('actualMargin', () => {
  it('calcula a margem real do preço atual', () => {
    expect(actualMargin(2, 1, 0)).toBe(0.5)
    expect(actualMargin(2, 1, 0.2)).toBe(0.3)
  })
})

describe('toBaseUnit', () => {
  it('converte kg para g e dúzia para unidade', () => {
    expect(toBaseUnit(5, 'KG', 'G')).toBe(5000)
    expect(toBaseUnit(2, 'DZ', 'UN')).toBe(24)
  })

  it('recusa unidades incompatíveis', () => {
    expect(() => toBaseUnit(1, 'L', 'G')).toThrow()
  })
})
