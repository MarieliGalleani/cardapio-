import type { Prisma } from '@prisma/client'
import { CartError, priceCart, type CartLine } from '../domain/cart.js'
import { nextStatuses, scheduleError, stockAction, localDayRange, type OrderStatus } from '../domain/orderRules.js'
import { HttpError } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { num } from '../lib/serialize.js'
import { catalogInclude, toCatalogProduct } from './catalog.js'
import { emitOrder } from './events.js'
import { recipeInclude, type RecipeWithItems } from './recipes.js'
import { currentStatus, enabledPaymentMethods, getSettings, type PaymentMethod } from './store.js'

export const orderInclude = {
  items: { include: { addons: true } },
  statusHistory: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude

export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>

export interface NewOrder {
  customerName: string
  customerPhone: string
  fulfillment: 'PICKUP' | 'DELIVERY'
  address?: { street: string; number: string; complement?: string | null; neighborhood: string; reference?: string | null } | null
  scheduledFor?: Date | null
  paymentMethod: PaymentMethod
  changeFor?: number | null
  notes?: string | null
  items: CartLine[]
}

const cents = (v: number) => Math.round(v * 100) / 100

export async function createOrder(input: NewOrder, now = new Date()) {
  const s = await getSettings()

  if (!s.checkoutEnabled) throw new HttpError(409, 'Esta loja recebe pedidos pelo WhatsApp')

  const status = currentStatus(s, now)
  const scheduledFor = input.scheduledFor ?? null
  const scheduleProblem = scheduleError({
    scheduledFor,
    now,
    storeOpen: status.state === 'OPEN',
    preOrdersEnabled: s.preOrdersEnabled,
    minHours: s.preOrderMinHours,
  })
  if (scheduleProblem) throw new HttpError(409, scheduleProblem)

  if (scheduledFor && s.preOrderDailyLimit) {
    const { start, end } = localDayRange(scheduledFor)
    const sameDay = await prisma.order.count({
      where: { scheduledFor: { gte: start, lt: end }, status: { not: 'CANCELED' } },
    })
    if (sameDay >= s.preOrderDailyLimit) throw new HttpError(409, 'Não há mais vagas de encomenda para esse dia')
  }

  // Retirada ou entrega
  let deliveryFee = 0
  if (input.fulfillment === 'PICKUP') {
    if (!s.pickupEnabled) throw new HttpError(409, 'Retirada no local não está disponível')
  } else {
    if (!s.deliveryEnabled) throw new HttpError(409, 'Entrega não está disponível')
    if (!input.address) throw new HttpError(400, 'Informe o endereço de entrega')
    const zone = await prisma.deliveryZone.findFirst({
      where: { neighborhood: { equals: input.address.neighborhood, mode: 'insensitive' }, active: true },
    })
    if (!zone) throw new HttpError(409, 'Ainda não entregamos nesse bairro')
    deliveryFee = num(zone.fee)
  }

  // Itens: preço sempre recalculado no servidor
  const products = await prisma.product.findMany({
    where: { id: { in: input.items.map((i) => i.productId) } },
    include: catalogInclude,
  })
  const catalog = new Map(products.map((p) => [p.id, toCatalogProduct(p, s.stockControlEnabled)]))
  let priced
  try {
    priced = priceCart(input.items, catalog)
  } catch (e) {
    if (e instanceof CartError) throw new HttpError(409, e.message)
    throw e
  }

  if (s.stockControlEnabled) {
    const recipes = new Map<string, RecipeWithItems | null>()
    for (const p of products) {
      recipes.set(p.id, p.recipe)
      for (const v of p.variations) recipes.set(v.id, v.recipe)
    }
    const shortage = await findShortage(
      priced.items.map((i) => ({ recipe: recipes.get(i.variationId ?? i.productId) ?? null, quantity: i.quantity })),
    )
    if (shortage) throw new HttpError(409, `Não temos ${shortage} suficiente para essa quantidade`)
  }

  if (s.minimumOrderValue && priced.subtotal < num(s.minimumOrderValue)) {
    throw new HttpError(409, `O pedido mínimo é de R$ ${num(s.minimumOrderValue).toFixed(2).replace('.', ',')}`)
  }

  if (!enabledPaymentMethods(s).includes(input.paymentMethod)) {
    throw new HttpError(409, 'Forma de pagamento indisponível')
  }

  const total = cents(priced.subtotal + deliveryFee)
  if (input.paymentMethod === 'CASH' && input.changeFor != null && input.changeFor < total) {
    throw new HttpError(400, 'O troco precisa ser para um valor maior que o total')
  }

  const order = await prisma.order.create({
    data: {
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      fulfillment: input.fulfillment,
      address: input.fulfillment === 'DELIVERY' ? (input.address ?? undefined) : undefined,
      scheduledFor,
      notes: input.notes?.trim() || null,
      subtotal: priced.subtotal,
      deliveryFee,
      total,
      paymentMethod: input.paymentMethod,
      changeFor: input.paymentMethod === 'CASH' ? (input.changeFor ?? null) : null,
      items: {
        create: priced.items.map((i) => ({
          productId: i.productId,
          variationId: i.variationId,
          name: i.name,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          notes: i.notes,
          addons: { create: i.addons },
        })),
      },
      statusHistory: { create: { status: 'RECEIVED' } },
    },
    include: orderInclude,
  })

  emitOrder({ type: 'created', orderId: order.id, publicToken: order.publicToken })
  return order
}

// Soma o que o pedido consome de cada item de estoque e devolve o nome do primeiro que falta
async function findShortage(lines: { recipe: RecipeWithItems | null; quantity: number }[]): Promise<string | null> {
  const need = new Map<string, { name: string; qty: number; available: number }>()
  for (const { recipe, quantity } of lines) {
    if (!recipe) continue
    const yieldQty = num(recipe.yieldQuantity)
    for (const ri of recipe.items) {
      const cur = need.get(ri.stockItemId) ?? { name: ri.stockItem.name, qty: 0, available: num(ri.stockItem.quantity) }
      cur.qty += (num(ri.quantity) / yieldQty) * quantity
      need.set(ri.stockItemId, cur)
    }
  }
  for (const n of need.values()) if (n.qty > n.available + 1e-9) return n.name
  return null
}

// Quanto cada item do pedido consome de estoque, pela ficha técnica
async function consumption(tx: Prisma.TransactionClient, order: OrderWithItems) {
  const totals = new Map<string, number>()
  for (const item of order.items) {
    const recipe = item.variationId
      ? await tx.recipe.findUnique({ where: { variationId: item.variationId }, include: recipeInclude })
      : item.productId
        ? await tx.recipe.findUnique({ where: { productId: item.productId }, include: recipeInclude })
        : null
    if (!recipe) continue
    const yieldQty = num(recipe.yieldQuantity)
    for (const ri of recipe.items) {
      totals.set(ri.stockItemId, (totals.get(ri.stockItemId) ?? 0) + (num(ri.quantity) / yieldQty) * item.quantity)
    }
  }
  return totals
}

export async function changeStatus(orderId: string, to: OrderStatus) {
  const updated = await prisma.$transaction(async (tx) => {
    // Trava a linha do pedido para dois cliques rápidos não baixarem o estoque duas vezes
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude })
    const from = order.status as OrderStatus
    if (!nextStatuses(from, order.fulfillment).includes(to)) {
      throw new HttpError(409, 'Mudança de status não permitida')
    }

    const action = stockAction(from, to, order.stockDeducted)
    if (action) {
      // Baixa: calcula pela ficha técnica. Devolução: desfaz exatamente o que foi baixado,
      // mesmo que a receita tenha mudado depois.
      const changes =
        action === 'deduct'
          ? [...(await consumption(tx, order))].map(([id, qty]) => [id, -qty] as const)
          : (
              await tx.stockMovement.groupBy({
                by: ['stockItemId'],
                where: { orderId, type: 'ORDER' },
                _sum: { quantity: true },
              })
            ).map((g) => [g.stockItemId, -num(g._sum.quantity)] as const)
      const note = action === 'deduct' ? `Pedido #${order.number}` : `Pedido #${order.number} cancelado`
      for (const [stockItemId, qty] of changes) {
        const q = Math.round(qty * 1000) / 1000
        if (q === 0) continue
        await tx.stockMovement.create({ data: { stockItemId, type: 'ORDER', quantity: q, orderId, note } })
        await tx.stockItem.update({ where: { id: stockItemId }, data: { quantity: { increment: q } } })
      }
    }

    return tx.order.update({
      where: { id: orderId },
      data: {
        status: to,
        stockDeducted: action === 'deduct' ? true : action === 'restore' ? false : undefined,
        statusHistory: { create: { status: to } },
      },
      include: orderInclude,
    })
  })
  emitOrder({ type: 'updated', orderId: updated.id, publicToken: updated.publicToken })
  return updated
}

export async function setPaymentStatus(orderId: string, paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED', mpPaymentId?: string) {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus, ...(mpPaymentId ? { mpPaymentId } : {}) },
    include: orderInclude,
  })
  emitOrder({ type: 'updated', orderId: order.id, publicToken: order.publicToken })
  return order
}
