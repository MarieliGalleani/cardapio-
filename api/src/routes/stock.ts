import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { toBaseUnit, type BaseUnit } from '../domain/pricing.js'
import { HttpError } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { num } from '../lib/serialize.js'
import { recipesBelowTarget } from '../services/recipes.js'

const itemFields = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(['INGREDIENT', 'PACKAGING']),
  minimum: z.coerce.number().nonnegative(),
  unitCost: z.coerce.number().nonnegative(),
})

const createBody = itemFields.extend({
  kind: itemFields.shape.kind.default('INGREDIENT'),
  unit: z.enum(['G', 'ML', 'UN']),
  minimum: itemFields.shape.minimum.default(0),
  unitCost: itemFields.shape.unitCost.default(0),
})

// Sem valores padrão: campos não enviados ficam como estão.
// A unidade base não muda depois de criada, para não bagunçar quantidades e receitas.
const updateBody = itemFields.partial()

const purchaseBody = z.object({
  quantity: z.coerce.number().positive(),
  unit: z.enum(['G', 'KG', 'ML', 'L', 'UN', 'DZ']),
  totalCost: z.coerce.number().nonnegative(),
  note: z.string().trim().nullish(),
})

const adjustBody = z.object({
  quantity: z.coerce.number().refine((n) => n !== 0, 'Informe uma quantidade diferente de zero'),
  note: z.string().trim().nullish(),
})

const idParam = z.object({ id: z.string() })

const withLowFlag = <T extends { quantity: unknown; minimum: unknown }>(item: T) => ({
  ...item,
  low: num(item.quantity as never) <= num(item.minimum as never),
})

export async function stockRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const items = await prisma.stockItem.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { recipeItems: true } } },
    })
    return items.map(withLowFlag)
  })

  // Itens no estoque mínimo ou abaixo dele (alerta de reposição)
  app.get('/alerts', async () => {
    const items = await prisma.stockItem.findMany({ orderBy: { name: 'asc' } })
    return items.map(withLowFlag).filter((i) => i.low)
  })

  app.post('/', async (req, reply) => {
    const item = await prisma.stockItem.create({ data: createBody.parse(req.body) })
    return reply.status(201).send(withLowFlag(item))
  })

  app.put('/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    const data = updateBody.parse(req.body)
    const before = await prisma.stockItem.findUniqueOrThrow({ where: { id } })
    const item = await prisma.stockItem.update({ where: { id }, data })
    const costChanged = data.unitCost !== undefined && data.unitCost !== num(before.unitCost)
    return {
      item: withLowFlag(item),
      belowTarget: costChanged ? await recipesBelowTarget([id]) : [],
    }
  })

  app.delete('/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params)
    await prisma.stockItem.delete({ where: { id } })
    return reply.status(204).send()
  })

  // Entrada por compra: soma a quantidade e atualiza o custo pelo preço pago.
  // A resposta traz as receitas que ficaram abaixo da margem com o novo custo.
  app.post('/:id/purchase', async (req) => {
    const { id } = idParam.parse(req.params)
    const body = purchaseBody.parse(req.body)
    const current = await prisma.stockItem.findUniqueOrThrow({ where: { id } })

    let baseQty: number
    try {
      baseQty = toBaseUnit(body.quantity, body.unit, current.unit as BaseUnit)
    } catch (e) {
      throw new HttpError(400, (e as Error).message)
    }
    const newUnitCost = body.totalCost / baseQty

    const item = await prisma.$transaction(async (tx) => {
      await tx.stockMovement.create({
        data: { stockItemId: id, type: 'PURCHASE', quantity: baseQty, totalCost: body.totalCost, note: body.note },
      })
      return tx.stockItem.update({
        where: { id },
        data: { quantity: { increment: baseQty }, unitCost: newUnitCost },
      })
    })

    const costChanged = Math.abs(newUnitCost - num(current.unitCost)) > 1e-9
    return {
      item: withLowFlag(item),
      belowTarget: costChanged ? await recipesBelowTarget([id]) : [],
    }
  })

  // Ajuste manual: positivo soma, negativo tira (perda, contagem)
  app.post('/:id/adjust', async (req) => {
    const { id } = idParam.parse(req.params)
    const { quantity, note } = adjustBody.parse(req.body)
    const item = await prisma.$transaction(async (tx) => {
      await tx.stockMovement.create({ data: { stockItemId: id, type: 'ADJUSTMENT', quantity, note } })
      return tx.stockItem.update({ where: { id }, data: { quantity: { increment: quantity } } })
    })
    return withLowFlag(item)
  })

  app.get('/:id/movements', async (req) => {
    const { id } = idParam.parse(req.params)
    return prisma.stockMovement.findMany({
      where: { stockItemId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { order: { select: { number: true } } },
    })
  })
}
