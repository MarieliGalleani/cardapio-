import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:MM')
const money = z.coerce.number().nonnegative()

const settingsBody = z
  .object({
    name: z.string().trim().min(1),
    description: z.string().trim().nullable(),
    logoUrl: z.string().nullable(),
    coverUrl: z.string().nullable(),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    whatsappPhone: z.string().regex(/^\d{12,13}$/, 'Use só números, com 55 + DDD').nullable(),

    isOpen: z.boolean(),
    pausedUntil: z.coerce.date().nullable(),
    openingHours: z.array(z.object({ day: z.number().int().min(0).max(6), open: hhmm, close: hhmm })),

    checkoutEnabled: z.boolean(),
    orderTrackingEnabled: z.boolean(),
    whatsappNotifications: z.boolean(),
    whatsappMessages: z.record(z.string(), z.string()),
    stockControlEnabled: z.boolean(),
    couponsEnabled: z.boolean(),
    reviewsEnabled: z.boolean(),

    pickupEnabled: z.boolean(),
    pickupAddress: z.string().trim().nullable(),

    deliveryEnabled: z.boolean(),
    deliveryFeeMode: z.enum(['BY_NEIGHBORHOOD', 'BY_KM']),
    deliveryFeePerKm: money.nullable(),
    deliveryMaxKm: money.nullable(),
    minimumOrderValue: money.nullable(),

    preOrdersEnabled: z.boolean(),
    preOrderMinHours: z.number().int().min(0),
    preOrderDailyLimit: z.number().int().positive().nullable(),

    pixEnabled: z.boolean(),
    pixKey: z.string().trim().nullable(),
    pixKeyType: z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']).nullable(),
    pixReceiverName: z.string().trim().max(25).nullable(),
    pixCity: z.string().trim().max(15).nullable(),
    creditEnabled: z.boolean(),
    debitEnabled: z.boolean(),
    mpPublicKey: z.string().trim().nullable(),
    cashEnabled: z.boolean(),
  })
  .partial()

export const getSettings = () => prisma.storeSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/', async () => ({
    ...(await getSettings()),
    // Só informa se o token existe; o valor nunca sai do servidor
    mercadoPagoConfigured: Boolean(process.env.MP_ACCESS_TOKEN),
  }))

  app.put('/', async (req) => {
    const data = settingsBody.parse(req.body)
    await getSettings()
    return prisma.storeSettings.update({ where: { id: 1 }, data })
  })
}
