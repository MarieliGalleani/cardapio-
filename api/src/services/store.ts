import type { StoreSettings } from '@prisma/client'
import { storeStatus, type OpeningHour } from '../domain/storeStatus.js'
import { prisma } from '../lib/prisma.js'
import { mpConfigured } from './mercadopago.js'

export const getSettings = () => prisma.storeSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })

export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH'

// Só aparecem as formas ativas e completas: Pix precisa de chave; cartão precisa do Mercado Pago configurado
export function enabledPaymentMethods(s: StoreSettings): PaymentMethod[] {
  const mpReady = mpConfigured() && Boolean(s.mpPublicKey)
  return [
    ...(s.pixEnabled && s.pixKey ? (['PIX'] as const) : []),
    ...(s.creditEnabled && mpReady ? (['CREDIT_CARD'] as const) : []),
    ...(s.debitEnabled && mpReady ? (['DEBIT_CARD'] as const) : []),
    ...(s.cashEnabled ? (['CASH'] as const) : []),
  ]
}

export const currentStatus = (s: StoreSettings, now = new Date()) =>
  storeStatus({ isOpen: s.isOpen, pausedUntil: s.pausedUntil, openingHours: s.openingHours as unknown as OpeningHour[] }, now)
