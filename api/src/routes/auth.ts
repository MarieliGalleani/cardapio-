import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { verifyPassword } from '../lib/password.js'
import { HttpError } from '../lib/http.js'

const loginBody = z.object({ email: z.string().email(), password: z.string().min(1) })

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (req) => {
    const { email, password } = loginBody.parse(req.body)
    const user = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } })
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(401, 'E-mail ou senha incorretos')
    }
    const token = app.jwt.sign({ sub: user.id })
    return { token, user: { id: user.id, email: user.email, name: user.name } }
  })
}
