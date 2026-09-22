import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { nextStatuses, type OrderStatus } from '../domain/orderRules.js'
import { changeStatus, orderInclude, setPaymentStatus, type OrderWithItems } from '../services/orders.js'

const idParam = z.object({ id: z.string() })
const ACTIVE: OrderStatus[] = ['RECEIVED', 'PREPARING', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP']

const listQuery = z.object({
  scope: z.enum(['active', 'history']).default('active'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

const withActions = (o: OrderWithItems) => ({ ...o, nextStatuses: nextStatuses(o.status, o.fulfillment) })

export async function orderRoutes(app: FastifyInstance) {
  app.get('/', async (req) => {
    const q = listQuery.parse(req.query)
    const orders = await prisma.order.findMany({
      where:
        q.scope === 'active'
          ? { status: { in: ACTIVE } }
          : { createdAt: { gte: q.from, lt: q.to } },
      orderBy: { createdAt: q.scope === 'active' ? 'asc' : 'desc' },
      take: q.scope === 'active' ? undefined : 200,
      include: orderInclude,
    })
    return orders.map(withActions)
  })

  app.get('/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    return withActions(await prisma.order.findUniqueOrThrow({ where: { id }, include: orderInclude }))
  })

  app.post('/:id/status', async (req) => {
    const { id } = idParam.parse(req.params)
    const { status } = z
      .object({ status: z.enum(['PREPARING', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELED']) })
      .parse(req.body)
    return withActions(await changeStatus(id, status))
  })

  // Confirmação manual do pagamento (Pix e dinheiro) pelo dono
  app.post('/:id/payment', async (req) => {
    const { id } = idParam.parse(req.params)
    const { status } = z.object({ status: z.enum(['PENDING', 'PAID', 'REFUNDED']) }).parse(req.body)
    return withActions(await setPaymentStatus(id, status))
  })
}
