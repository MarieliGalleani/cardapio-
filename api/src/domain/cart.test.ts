import { describe, expect, it } from 'vitest'
import { CartError, priceCart, type CatalogProduct } from './cart.js'

const brigadeiro: CatalogProduct = {
  id: 'brig',
  name: 'Brigadeiro',
  available: true,
  price: 3.5,
  promoPrice: null,
  variations: [],
  addonGroups: [],
}

const bolo: CatalogProduct = {
  id: 'bolo',
  name: 'Bolo de cenoura',
  available: true,
  price: 0,
  promoPrice: null,
  variations: [
    { id: 'fatia', name: 'Fatia', price: 12, available: true },
    { id: 'inteiro', name: 'Inteiro', price: 60, available: false },
  ],
  addonGroups: [
    {
      id: 'cob',
      name: 'Cobertura',
      minSelect: 1,
      maxSelect: 1,
      addons: [
        { id: 'choc', name: 'Chocolate', price: 3, available: true },
        { id: 'nada', name: 'Sem cobertura', price: 0, available: true },
      ],
    },
  ],
}

const catalog = new Map([
  ['brig', brigadeiro],
  ['bolo', bolo],
])

describe('priceCart', () => {
  it('soma itens, variações e adicionais', () => {
    const r = priceCart(
      [
        { productId: 'brig', quantity: 10 },
        { productId: 'bolo', variationId: 'fatia', quantity: 2, addonIds: ['choc'], notes: ' sem açúcar ' },
      ],
      catalog,
    )
    expect(r.subtotal).toBe(35 + 30)
    expect(r.items[1]).toMatchObject({
      name: 'Bolo de cenoura — Fatia',
      unitPrice: 12,
      lineTotal: 30,
      notes: 'sem açúcar',
      addons: [{ addonId: 'choc', name: 'Chocolate', price: 3 }],
    })
  })

  it('usa o preço promocional', () => {
    const promo = new Map([['brig', { ...brigadeiro, promoPrice: 3 }]])
    expect(priceCart([{ productId: 'brig', quantity: 2 }], promo).subtotal).toBe(6)
  })

  it('exige variação quando o produto tem', () => {
    expect(() => priceCart([{ productId: 'bolo', quantity: 1, addonIds: ['choc'] }], catalog)).toThrow(CartError)
  })

  it('recusa variação indisponível', () => {
    expect(() =>
      priceCart([{ productId: 'bolo', variationId: 'inteiro', quantity: 1, addonIds: ['choc'] }], catalog),
    ).toThrow(/indisponível/)
  })

  it('respeita mínimo e máximo de adicionais', () => {
    expect(() => priceCart([{ productId: 'bolo', variationId: 'fatia', quantity: 1 }], catalog)).toThrow(/pelo menos 1/)
    expect(() =>
      priceCart([{ productId: 'bolo', variationId: 'fatia', quantity: 1, addonIds: ['choc', 'nada'] }], catalog),
    ).toThrow(/no máximo 1/)
  })

  it('recusa adicional de outro produto', () => {
    expect(() => priceCart([{ productId: 'brig', quantity: 1, addonIds: ['choc'] }], catalog)).toThrow(/inválido/)
  })

  it('recusa produto indisponível, quantidade inválida e sacola vazia', () => {
    const off = new Map([['brig', { ...brigadeiro, available: false }]])
    expect(() => priceCart([{ productId: 'brig', quantity: 1 }], off)).toThrow(/indisponível/)
    expect(() => priceCart([{ productId: 'brig', quantity: 0 }], catalog)).toThrow(/Quantidade/)
    expect(() => priceCart([], catalog)).toThrow(/vazia/)
  })
})
