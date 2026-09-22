import Fastify, { type FastifyError } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { Prisma } from '@prisma/client'
import { mkdirSync } from 'node:fs'
import { ZodError } from 'zod'
import { HttpError } from './lib/http.js'
import { toPlain } from './lib/serialize.js'
import { authRoutes } from './routes/auth.js'
import { categoryRoutes } from './routes/categories.js'
import { productRoutes } from './routes/products.js'
import { addonRoutes } from './routes/addons.js'
import { stockRoutes } from './routes/stock.js'
import { recipeRoutes } from './routes/recipes.js'
import { settingsRoutes } from './routes/settings.js'
import { publicRoutes } from './routes/public.js'

import { UPLOAD_DIR } from './lib/uploads.js'

export async function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' })

  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) throw new Error('Defina JWT_SECRET no arquivo .env')

  await app.register(cors, { origin: true })
  await app.register(jwt, { secret: jwtSecret, sign: { expiresIn: '7d' } })
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } })

  mkdirSync(UPLOAD_DIR, { recursive: true })
  await app.register(fastifyStatic, { root: UPLOAD_DIR, prefix: '/uploads/' })

  app.addHook('preSerialization', async (_req, _reply, payload) => toPlain(payload))

  app.setErrorHandler((err: FastifyError, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: 'Dados inválidos', issues: err.issues })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') return reply.status(404).send({ error: 'Registro não encontrado' })
      if (err.code === 'P2002') return reply.status(409).send({ error: 'Já existe um registro com esse nome' })
      if (err.code === 'P2003') return reply.status(409).send({ error: 'Registro em uso, não pode ser removido' })
    }
    if (err.statusCode && err.statusCode < 500) {
      return reply.status(err.statusCode).send({ error: err.message })
    }
    app.log.error(err)
    return reply.status(500).send({ error: 'Erro interno' })
  })

  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(publicRoutes, { prefix: '/api/public' })

  // Tudo em /api/admin exige login do dono
  await app.register(
    async (admin) => {
      admin.addHook('onRequest', async (req) => {
        try {
          await req.jwtVerify()
        } catch {
          throw new HttpError(401, 'Faça login para continuar')
        }
      })
      await admin.register(categoryRoutes, { prefix: '/categories' })
      await admin.register(productRoutes, { prefix: '/products' })
      await admin.register(addonRoutes, { prefix: '/addon-groups' })
      await admin.register(stockRoutes, { prefix: '/stock' })
      await admin.register(recipeRoutes, { prefix: '/recipes' })
      await admin.register(settingsRoutes, { prefix: '/settings' })
    },
    { prefix: '/api/admin' },
  )

  return app
}
