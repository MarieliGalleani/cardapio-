import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { z } from 'zod'
import { UPLOAD_DIR } from '../lib/uploads.js'
import { HttpError } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { recipeInclude, summarizeRecipe } from '../services/recipes.js'

const money = z.coerce.number().nonnegative()

const variationSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  price: money,
  available: z.boolean().default(true),
})

const productBody = z.object({
  categoryId: z.string(),
  name: z.string().trim().min(1),
  description: z.string().trim().nullish(),
  price: money,
  promoPrice: money.nullish(),
  available: z.boolean().default(true),
  variations: z.array(variationSchema).default([]),
  addonGroupIds: z.array(z.string()).default([]),
})

const idParam = z.object({ id: z.string() })
const orderBody = z.object({ ids: z.array(z.string()).min(1) })

const productInclude = {
  category: { select: { id: true, name: true } },
  variations: { orderBy: { sortOrder: 'asc' as const } },
  addonGroups: { orderBy: { sortOrder: 'asc' as const }, include: { group: { include: { addons: true } } } },
  recipe: { include: recipeInclude },
}

export async function productRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const products = await prisma.product.findMany({
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      include: productInclude,
    })
    return products.map(({ recipe, ...p }) => ({
      ...p,
      recipe: recipe ? { id: recipe.id, ...summarizeRecipe(recipe) } : null,
    }))
  })

  app.get('/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    return prisma.product.findUniqueOrThrow({ where: { id }, include: productInclude })
  })

  app.post('/', async (req, reply) => {
    const { variations, addonGroupIds, ...data } = productBody.parse(req.body)
    const last = await prisma.product.aggregate({
      where: { categoryId: data.categoryId },
      _max: { sortOrder: true },
    })
    const product = await prisma.product.create({
      data: {
        ...data,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
        variations: { create: variations.map(({ id: _id, ...v }, i) => ({ ...v, sortOrder: i })) },
        addonGroups: { create: addonGroupIds.map((groupId, i) => ({ groupId, sortOrder: i })) },
      },
      include: productInclude,
    })
    return reply.status(201).send(product)
  })

  app.put('/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    const { variations, addonGroupIds, ...data } = productBody.parse(req.body)

    return prisma.$transaction(async (tx) => {
      // Variações: atualiza as que vieram com id, cria as novas e remove as que sumiram.
      // Remover apaga a ficha técnica da variação junto (cascade).
      const keepIds = variations.flatMap((v) => (v.id ? [v.id] : []))
      await tx.productVariation.deleteMany({ where: { productId: id, id: { notIn: keepIds } } })
      for (const [i, { id: variationId, ...v }] of variations.entries()) {
        if (variationId) {
          await tx.productVariation.update({ where: { id: variationId, productId: id }, data: { ...v, sortOrder: i } })
        } else {
          await tx.productVariation.create({ data: { ...v, productId: id, sortOrder: i } })
        }
      }

      await tx.productAddonGroup.deleteMany({ where: { productId: id } })
      await tx.productAddonGroup.createMany({
        data: addonGroupIds.map((groupId, i) => ({ productId: id, groupId, sortOrder: i })),
      })

      return tx.product.update({ where: { id }, data, include: productInclude })
    })
  })

  // Liga/desliga disponibilidade sem abrir o formulário inteiro
  app.patch('/:id/availability', async (req) => {
    const { id } = idParam.parse(req.params)
    const { available } = z.object({ available: z.boolean() }).parse(req.body)
    return prisma.product.update({ where: { id }, data: { available } })
  })

  app.delete('/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params)
    await prisma.product.delete({ where: { id } })
    return reply.status(204).send()
  })

  // Arrastar e soltar dentro de uma categoria
  app.put('/order', async (req) => {
    const { ids } = orderBody.parse(req.body)
    await prisma.$transaction(ids.map((id, i) => prisma.product.update({ where: { id }, data: { sortOrder: i } })))
    return { ok: true }
  })

  app.post('/:id/image', async (req) => {
    const { id } = idParam.parse(req.params)
    const file = await req.file()
    if (!file) throw new HttpError(400, 'Envie uma imagem')
    const ext = extname(file.filename).toLowerCase()
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      throw new HttpError(400, 'Use uma imagem JPG, PNG ou WEBP')
    }
    const name = `${randomUUID()}${ext}`
    await pipeline(file.file, createWriteStream(join(UPLOAD_DIR, name)))
    if (file.file.truncated) throw new HttpError(413, 'A imagem pode ter no máximo 5 MB')
    const base = process.env.PUBLIC_API_URL ?? ''
    return prisma.product.update({ where: { id }, data: { imageUrl: `${base}/uploads/${name}` } })
  })
}
