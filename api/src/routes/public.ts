import type { FastifyInstance } from 'fastify'
import type { StoreSettings } from '@prisma/client'
import { z } from 'zod'
import { buildPixPayload, type PixKeyType } from '../domain/pix.js'
import { HttpError } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { num } from '../lib/serialize.js'
import { catalogInclude, toCatalogProduct } from '../services/catalog.js'
import { events, type OrderEvent } from '../services/events.js'
import { createCheckout, getPayment, mapPaymentStatus } from '../services/mercadopago.js'
import { createOrder, orderInclude, setPaymentStatus, type OrderWithItems } from '../services/orders.js'
import { currentStatus, enabledPaymentMethods, getSettings } from '../services/store.js'

const phone = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length >= 10 && v.length <= 13, 'Telefone inválido')

const orderBody = z.object({
  customerName: z.string().trim().min(2, 'Informe seu nome').max(80),
  customerPhone: phone,
  fulfillment: z.enum(['PICKUP', 'DELIVERY']),
  address: z
    .object({
      street: z.string().trim().min(1, 'Informe a rua'),
      number: z.string().trim().min(1, 'Informe o número'),
      complement: z.string().trim().nullish(),
      neighborhood: z.string().trim().min(1, 'Informe o bairro'),
      reference: z.string().trim().nullish(),
    })
    .nullish(),
  scheduledFor: z.coerce.date().nullish(),
  paymentMethod: z.enum(['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH']),
  changeFor: z.coerce.number().positive().nullish(),
  notes: z.string().max(500).nullish(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        variationId: z.string().nullish(),
        quantity: z.number().int().min(1).max(999),
        addonIds: z.array(z.string()).default([]),
        notes: z.string().max(200).nullish(),
      }),
    )
    .min(1, 'A sacola está vazia')
    .max(100),
})

const tokenParam = z.object({ token: z.string().min(10) })

// O que o cliente vê do pedido. O acompanhamento de status só aparece se estiver ligado.
function presentOrder(o: OrderWithItems, s: StoreSettings) {
  const pixPending = o.paymentMethod === 'PIX' && o.paymentStatus === 'PENDING' && o.status !== 'CANCELED' && s.pixKey
  return {
    number: o.number,
    publicToken: o.publicToken,
    createdAt: o.createdAt,
    trackingEnabled: s.orderTrackingEnabled,
    status: s.orderTrackingEnabled || o.status === 'CANCELED' ? o.status : null,
    statusHistory: s.orderTrackingEnabled ? o.statusHistory.map((h) => ({ status: h.status, at: h.createdAt })) : [],
    fulfillment: o.fulfillment,
    scheduledFor: o.scheduledFor,
    customerName: o.customerName,
    address: o.address,
    pickupAddress: o.fulfillment === 'PICKUP' ? s.pickupAddress : null,
    items: o.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      notes: i.notes,
      addons: i.addons.map((a) => ({ name: a.name, price: a.price })),
    })),
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    changeFor: o.changeFor,
    pix: pixPending
      ? {
          payload: buildPixPayload({
            key: s.pixKey!,
            keyType: s.pixKeyType as PixKeyType | null,
            receiverName: s.pixReceiverName || s.name,
            city: s.pixCity || 'BRASIL',
            amount: num(o.total),
            txid: `PEDIDO${o.number}`,
          }),
          key: s.pixKey,
          receiverName: s.pixReceiverName || s.name,
        }
      : null,
    store: { name: s.name, whatsappPhone: s.whatsappPhone },
  }
}

async function findByToken(token: string) {
  const order = await prisma.order.findUnique({ where: { publicToken: token }, include: orderInclude })
  if (!order) throw new HttpError(404, 'Pedido não encontrado')
  return order
}

// Rotas sem login, usadas pela loja do cliente.
export async function publicRoutes(app: FastifyInstance) {
  app.get('/store', async () => {
    const s = await getSettings()
    const zones = s.deliveryEnabled
      ? await prisma.deliveryZone.findMany({ where: { active: true }, orderBy: { neighborhood: 'asc' } })
      : []
    return {
      name: s.name,
      description: s.description,
      logoUrl: s.logoUrl,
      coverUrl: s.coverUrl,
      primaryColor: s.primaryColor,
      whatsappPhone: s.whatsappPhone,
      status: currentStatus(s),
      openingHours: s.openingHours,
      features: {
        checkout: s.checkoutEnabled,
        orderTracking: s.orderTrackingEnabled,
        coupons: s.couponsEnabled,
        reviews: s.reviewsEnabled,
        pickup: s.pickupEnabled,
        delivery: s.deliveryEnabled,
        preOrders: s.preOrdersEnabled,
      },
      pickupAddress: s.pickupEnabled ? s.pickupAddress : null,
      deliveryZones: zones.map((z) => ({ neighborhood: z.neighborhood, fee: z.fee })),
      minimumOrderValue: s.minimumOrderValue,
      preOrderMinHours: s.preOrderMinHours,
      paymentMethods: enabledPaymentMethods(s),
    }
  })

  app.get('/menu', async () => {
    const s = await getSettings()
    const categories = await prisma.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: { products: { orderBy: { sortOrder: 'asc' }, include: catalogInclude } },
    })
    return categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        products: c.products.map((p) => {
          const cp = toCatalogProduct(p, s.stockControlEnabled)
          return {
            ...cp,
            description: p.description,
            imageUrl: p.imageUrl,
            addonGroups: cp.addonGroups.map((g) => ({ ...g, addons: g.addons.filter((a) => a.available) })),
          }
        }),
      }))
      .filter((c) => c.products.length > 0)
  })

  app.post('/orders', async (req, reply) => {
    const body = orderBody.parse(req.body)
    const order = await createOrder({ ...body, address: body.address ?? null })
    return reply.status(201).send(presentOrder(order, await getSettings()))
  })

  app.get('/orders/:token', async (req) => {
    const { token } = tokenParam.parse(req.params)
    return presentOrder(await findByToken(token), await getSettings())
  })

  // Atualização em tempo real do acompanhamento (Server-Sent Events)
  app.get('/orders/:token/stream', async (req, reply) => {
    const { token } = tokenParam.parse(req.params)
    await findByToken(token)
    reply.hijack()
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'access-control-allow-origin': '*',
    })
    reply.raw.write(': conectado\n\n')
    const onOrder = (e: OrderEvent) => {
      if (e.publicToken === token) reply.raw.write(`data: ${JSON.stringify({ type: e.type })}\n\n`)
    }
    const ping = setInterval(() => reply.raw.write(': ping\n\n'), 25_000)
    events.on('order', onOrder)
    req.raw.on('close', () => {
      clearInterval(ping)
      events.off('order', onOrder)
    })
  })

  // Crédito/débito: cria a página de pagamento do Mercado Pago e devolve o link
  app.post('/orders/:token/checkout', async (req) => {
    const { token } = tokenParam.parse(req.params)
    const order = await findByToken(token)
    if (order.paymentMethod !== 'CREDIT_CARD' && order.paymentMethod !== 'DEBIT_CARD') {
      throw new HttpError(400, 'Este pedido não é pago com cartão')
    }
    if (order.paymentStatus === 'PAID') throw new HttpError(409, 'Este pedido já está pago')
    if (order.status === 'CANCELED') throw new HttpError(409, 'Este pedido foi cancelado')
    const s = await getSettings()
    const url = await createCheckout({
      orderId: order.id,
      orderNumber: order.number,
      publicToken: order.publicToken,
      total: num(order.total),
      storeName: s.name,
      customerName: order.customerName,
      allowCredit: order.paymentMethod === 'CREDIT_CARD',
      allowDebit: order.paymentMethod === 'DEBIT_CARD',
    })
    return { url }
  })

  // Ao voltar do Mercado Pago, o site confirma o pagamento consultando o próprio Mercado Pago
  app.post('/orders/:token/payment/sync', async (req) => {
    const { token } = tokenParam.parse(req.params)
    const { paymentId } = z.object({ paymentId: z.string().regex(/^\d+$/) }).parse(req.body)
    const order = await findByToken(token)
    const payment = await getPayment(paymentId)
    if (payment.external_reference !== order.id) throw new HttpError(400, 'Pagamento não pertence a este pedido')
    const updated = await setPaymentStatus(order.id, mapPaymentStatus(payment.status), String(payment.id))
    return presentOrder(updated, await getSettings())
  })

  // Aviso automático do Mercado Pago. Não confiamos no conteúdo: buscamos o pagamento na API deles.
  app.post('/mercadopago/webhook', async (req, reply) => {
    const q = req.query as Record<string, string | undefined>
    const body = (req.body ?? {}) as { type?: string; data?: { id?: string | number } }
    const type = body.type ?? q.type ?? q.topic
    const id = String(body.data?.id ?? q['data.id'] ?? q.id ?? '')
    if (type === 'payment' && /^\d+$/.test(id)) {
      try {
        const payment = await getPayment(id)
        const order = payment.external_reference
          ? await prisma.order.findUnique({ where: { id: payment.external_reference } })
          : null
        if (order) await setPaymentStatus(order.id, mapPaymentStatus(payment.status), String(payment.id))
      } catch (e) {
        req.log.error(e, 'Falha ao processar aviso do Mercado Pago')
      }
    }
    return reply.status(200).send({ ok: true })
  })
}
