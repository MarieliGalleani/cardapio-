import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const body = z.object({
  neighborhood: z.string().trim().min(1),
  fee: z.coerce.number().nonnegative(),
  active: z.boolean().default(true),
})
const idParam = z.object({ id: z.string() })

export async function deliveryZoneRoutes(app: FastifyInstance) {
  app.get('/', async () => prisma.deliveryZone.findMany({ orderBy: { neighborhood: 'asc' } }))

  app.post('/', async (req, reply) => reply.status(201).send(await prisma.deliveryZone.create({ data: body.parse(req.body) })))

  app.put('/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    return prisma.deliveryZone.update({ where: { id }, data: body.parse(req.body) })
  })

  app.delete('/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params)
    await prisma.deliveryZone.delete({ where: { id } })
    return reply.status(204).send()
  })
}
