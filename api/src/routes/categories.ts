import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const body = z.object({ name: z.string().trim().min(1), active: z.boolean().optional() })
const idParam = z.object({ id: z.string() })
const orderBody = z.object({ ids: z.array(z.string()).min(1) })

export async function categoryRoutes(app: FastifyInstance) {
  app.get('/', async () =>
    prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    }),
  )

  app.post('/', async (req, reply) => {
    const data = body.parse(req.body)
    const last = await prisma.category.aggregate({ _max: { sortOrder: true } })
    const category = await prisma.category.create({
      data: { ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    })
    return reply.status(201).send(category)
  })

  app.put('/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    return prisma.category.update({ where: { id }, data: body.partial().parse(req.body) })
  })

  app.delete('/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params)
    await prisma.category.delete({ where: { id } })
    return reply.status(204).send()
  })

  // Arrastar e soltar: recebe os ids na nova ordem
  app.put('/order', async (req) => {
    const { ids } = orderBody.parse(req.body)
    await prisma.$transaction(ids.map((id, i) => prisma.category.update({ where: { id }, data: { sortOrder: i } })))
    return { ok: true }
  })
}
