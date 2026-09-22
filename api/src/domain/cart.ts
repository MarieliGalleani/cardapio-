// Monta os itens do pedido a partir da sacola do cliente.
// O preço é sempre recalculado aqui com os dados do cardápio: o valor que vem
// do navegador nunca é usado.

export class CartError extends Error {}

export interface CatalogAddon {
  id: string
  name: string
  price: number
  available: boolean
}

export interface CatalogProduct {
  id: string
  name: string
  available: boolean // já considera categoria ativa e estoque
  price: number
  promoPrice: number | null
  variations: { id: string; name: string; price: number; available: boolean }[]
  addonGroups: { id: string; name: string; minSelect: number; maxSelect: number; addons: CatalogAddon[] }[]
}

export interface CartLine {
  productId: string
  variationId?: string | null
  quantity: number
  addonIds?: string[]
  notes?: string | null
}

export interface PricedItem {
  productId: string
  variationId: string | null
  name: string
  unitPrice: number // preço do produto/variação, sem adicionais
  quantity: number
  notes: string | null
  addons: { addonId: string; name: string; price: number }[]
  lineTotal: number
}

const cents = (v: number) => Math.round(v * 100) / 100

export function priceCart(lines: CartLine[], catalog: Map<string, CatalogProduct>): { items: PricedItem[]; subtotal: number } {
  if (lines.length === 0) throw new CartError('A sacola está vazia')

  const items = lines.map((line): PricedItem => {
    const product = catalog.get(line.productId)
    if (!product) throw new CartError('Um produto da sacola não existe mais. Atualize a página.')
    if (!product.available) throw new CartError(`${product.name} está indisponível no momento`)
    if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new CartError('Quantidade inválida')

    let name = product.name
    let unitPrice = product.promoPrice ?? product.price
    let variationId: string | null = null

    if (product.variations.length > 0) {
      const variation = product.variations.find((v) => v.id === line.variationId)
      if (!variation) throw new CartError(`Escolha uma opção de ${product.name}`)
      if (!variation.available) throw new CartError(`${product.name} (${variation.name}) está indisponível`)
      name = `${product.name} — ${variation.name}`
      unitPrice = variation.price
      variationId = variation.id
    } else if (line.variationId) {
      throw new CartError(`${product.name} não tem opções`)
    }

    const chosen = new Set(line.addonIds ?? [])
    const addons: PricedItem['addons'] = []
    for (const group of product.addonGroups) {
      const picked = group.addons.filter((a) => chosen.has(a.id))
      if (picked.length < group.minSelect) {
        throw new CartError(`Escolha pelo menos ${group.minSelect} em "${group.name}" (${product.name})`)
      }
      if (picked.length > group.maxSelect) {
        throw new CartError(`Escolha no máximo ${group.maxSelect} em "${group.name}" (${product.name})`)
      }
      for (const a of picked) {
        if (!a.available) throw new CartError(`${a.name} está indisponível`)
        addons.push({ addonId: a.id, name: a.name, price: a.price })
        chosen.delete(a.id)
      }
    }
    if (chosen.size > 0) throw new CartError(`Adicional inválido em ${product.name}`)

    const unitWithAddons = unitPrice + addons.reduce((s, a) => s + a.price, 0)
    return {
      productId: product.id,
      variationId,
      name,
      unitPrice: cents(unitPrice),
      quantity: line.quantity,
      notes: line.notes?.trim() || null,
      addons,
      lineTotal: cents(unitWithAddons * line.quantity),
    }
  })

  return { items, subtotal: cents(items.reduce((s, i) => s + i.lineTotal, 0)) }
}
