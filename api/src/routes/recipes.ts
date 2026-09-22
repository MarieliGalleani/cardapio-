import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { HttpError } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'

import { recipeInclude, recipeLabel, recipesBelowTarget, summarizeRecipe, type RecipeWithItems } from '../services/recipes.js'

const percent = z.coerce.number().min(0).max(0.99)

const recipeBody = z
  .object({
    productId: z.string().nullish(),
    variationId: z.string().nullish(),
    yieldQuantity: z.coerce.number().positive(),
    targetMargin: percent,
    packagingCostPerUnit: z.coerce.number().nonnegative().default(0),
    energyCost: z.coerce.number().nonnegative().default(0),
    laborCost: z.coerce.number().nonnegative().default(0),
    appFeePercent: percent.default(0),
    notes: z.string().trim().nullish(),
    items: z
      .array(z.object({ stockItemId: z.string(), quantity: z.coerce.number().positive() }))
      .min(1, 'Adicione pelo menos um ingrediente'),
  })
  .refine((r) => Boolean(r.productId) !== Boolean(r.variationId), {
    message: 'A receita precisa ser de um produto ou de uma variação',
  })
  .refine((r) => r.targetMargin + r.appFeePercent < 1, {
    message: 'Margem + taxa do app precisam somar menos de 100%',
  })
  .refine((r) => new Set(r.items.map((i) => i.stockItemId)).size === r.items.length, {
    message: 'Cada ingrediente só pode aparecer uma vez',
  })

const idParam = z.object({ id: z.string() })

function present(r: RecipeWithItems) {
  return { ...r, label: recipeLabel(r), cost: summarizeRecipe(r) }
}

export async function recipeRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const recipes = await prisma.recipe.findMany({ include: recipeInclude })
    return recipes.map(present).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  })

  // Produtos com margem real abaixo da desejada
  app.get('/below-target', async () => recipesBelowTarget())

  app.get('/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    return present(await prisma.recipe.findUniqueOrThrow({ where: { id }, include: recipeInclude }))
  })

  // Pré-visualização: calcula sem salvar, para o formulário mostrar o custo enquanto o dono digita
  app.post('/preview', async (req) => {
    const body = recipeBody.parse(req.body)
    const stock = await prisma.stockItem.findMany({ where: { id: { in: body.items.map((i) => i.stockItemId) } } })
    const product = body.productId
      ? await prisma.product.findUnique({ where: { id: body.productId }, select: { id: true, name: true, price: true } })
      : null
    const variation = body.variationId
      ? await prisma.productVariation.findUnique({
          where: { id: body.variationId },
          select: { id: true, name: true, price: true, product: { select: { id: true, name: true } } },
        })
      : null
    const fake = {
      ...body,
      items: body.items.map((i) => {
        const stockItem = stock.find((s) => s.id === i.stockItemId)
        if (!stockItem) throw new HttpError(400, 'Ingrediente não encontrado no estoque')
        return { ...i, stockItem }
      }),
      product,
      variation,
    } as unknown as RecipeWithItems
    return summarizeRecipe(fake)
  })

  app.post('/', async (req, reply) => {
    const { items, ...data } = recipeBody.parse(req.body)
    const recipe = await prisma.recipe.create({
      data: { ...data, items: { create: items } },
      include: recipeInclude,
    })
    return reply.status(201).send(present(recipe))
  })

  app.put('/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    const { items, ...data } = recipeBody.parse(req.body)
    const recipe = await prisma.$transaction(async (tx) => {
      await tx.recipeItem.deleteMany({ where: { recipeId: id } })
      return tx.recipe.update({
        where: { id },
        data: { ...data, items: { create: items } },
        include: recipeInclude,
      })
    })
    return present(recipe)
  })

  // Aplica o preço sugerido no cardápio (produto ou variação)
  app.post('/:id/apply-price', async (req) => {
    const { id } = idParam.parse(req.params)
    const recipe = await prisma.recipe.findUniqueOrThrow({ where: { id }, include: recipeInclude })
    const { suggestedUnitPrice } = summarizeRecipe(recipe)
    if (suggestedUnitPrice === null) throw new HttpError(400, 'Não há preço sugerido para esta receita')
    if (recipe.variationId) {
      await prisma.productVariation.update({ where: { id: recipe.variationId }, data: { price: suggestedUnitPrice } })
    } else if (recipe.productId) {
      await prisma.product.update({ where: { id: recipe.productId }, data: { price: suggestedUnitPrice } })
    }
    const updated = await prisma.recipe.findUniqueOrThrow({ where: { id }, include: recipeInclude })
    return present(updated)
  })

  app.delete('/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params)
    await prisma.recipe.delete({ where: { id } })
    return reply.status(204).send()
  })
}

