import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const addonSchema = z.object({
  name: z.string().trim().min(1),
  price: z.coerce.number().nonnegative().default(0),
  available: z.boolean().default(true),
})

const groupBody = z
  .object({
    name: z.string().trim().min(1),
    minSelect: z.number().int().min(0).default(0),
    maxSelect: z.number().int().min(1).default(1),
    addons: z.array(addonSchema).default([]),
  })
  .refine((g) => g.maxSelect >= g.minSelect, { message: 'O máximo precisa ser maior ou igual ao mínimo' })

const idParam = z.object({ id: z.string() })
const include = { addons: { orderBy: { sortOrder: 'asc' as const } } }

export async function addonRoutes(app: FastifyInstance) {
  app.get('/', async () => prisma.addonGroup.findMany({ orderBy: { name: 'asc' }, include }))

  app.post('/', async (req, reply) => {
    const { addons, ...data } = groupBody.parse(req.body)
    const group = await prisma.addonGroup.create({
      data: { ...data, addons: { create: addons.map((a, i) => ({ ...a, sortOrder: i })) } },
      include,
    })
    return reply.status(201).send(group)
  })

  // Os adicionais do grupo são substituídos pela lista enviada
  app.put('/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    const { addons, ...data } = groupBody.parse(req.body)
    return prisma.$transaction(async (tx) => {
      await tx.addon.deleteMany({ where: { groupId: id } })
      return tx.addonGroup.update({
        where: { id },
        data: { ...data, addons: { create: addons.map((a, i) => ({ ...a, sortOrder: i })) } },
        include,
      })
    })
  })

  app.delete('/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params)
    await prisma.addonGroup.delete({ where: { id } })
    return reply.status(204).send()
  })
}
