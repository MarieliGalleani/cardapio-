import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { HttpError } from '../lib/http.js'
import { events, type OrderEvent } from '../services/events.js'

// Pedidos em tempo real para o painel. O navegador (EventSource) não envia
// cabeçalhos, então o token de login vem na URL.
export async function adminStreamRoutes(app: FastifyInstance) {
  app.get('/orders', async (req, reply) => {
    const { token } = z.object({ token: z.string() }).parse(req.query)
    try {
      app.jwt.verify(token)
    } catch {
      throw new HttpError(401, 'Faça login para continuar')
    }
    reply.hijack()
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'access-control-allow-origin': '*',
    })
    reply.raw.write(': conectado\n\n')
    const onOrder = (e: OrderEvent) => reply.raw.write(`data: ${JSON.stringify({ type: e.type, orderId: e.orderId })}\n\n`)
    const ping = setInterval(() => reply.raw.write(': ping\n\n'), 25_000)
    events.on('order', onOrder)
    req.raw.on('close', () => {
      clearInterval(ping)
      events.off('order', onOrder)
    })
  })
}
