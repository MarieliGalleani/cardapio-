import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { storeStatus, type OpeningHour } from '../domain/storeStatus.js'
import { prisma } from '../lib/prisma.js'
import { hasStockForOneUnit, recipeInclude } from '../services/recipes.js'
import { getSettings } from './settings.js'

// Rotas sem login, usadas pela loja do cliente.
export async function publicRoutes(app: FastifyInstance) {
  app.get('/store', async () => {
    const s = await getSettings()
    const mpReady = Boolean(process.env.MP_ACCESS_TOKEN && s.mpPublicKey)
    return {
      name: s.name,
      description: s.description,
      logoUrl: s.logoUrl,
      coverUrl: s.coverUrl,
      primaryColor: s.primaryColor,
      whatsappPhone: s.whatsappPhone,
      status: storeStatus({
        isOpen: s.isOpen,
        pausedUntil: s.pausedUntil,
        openingHours: z.array(z.any()).parse(s.openingHours) as OpeningHour[],
      }),
      openingHours: s.openingHours,
      features: {
        checkout: s.checkoutEnabled,
        orderTracking: s.orderTrackingEnabled,
        coupons: s.couponsEnabled,
        reviews: s.reviewsEnabled,
        pickup: s.pickupEnabled,
        delivery: s.deliveryEnabled,
        preOrders: s.preOrdersEnabled,
      },
      pickupAddress: s.pickupEnabled ? s.pickupAddress : null,
      minimumOrderValue: s.minimumOrderValue,
      preOrderMinHours: s.preOrderMinHours,
      // Só aparecem as formas ativas. Cartão depende do Mercado Pago configurado.
      paymentMethods: [
        ...(s.pixEnabled && s.pixKey ? ['PIX'] : []),
        ...(s.creditEnabled && mpReady ? ['CREDIT_CARD'] : []),
        ...(s.debitEnabled && mpReady ? ['DEBIT_CARD'] : []),
        ...(s.cashEnabled ? ['CASH'] : []),
      ],
      mpPublicKey: mpReady ? s.mpPublicKey : null,
    }
  })

  app.get('/menu', async () => {
    const s = await getSettings()
    const categories = await prisma.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          orderBy: { sortOrder: 'asc' },
          include: {
            recipe: { include: recipeInclude },
            variations: { orderBy: { sortOrder: 'asc' }, include: { recipe: { include: recipeInclude } } },
            addonGroups: {
              orderBy: { sortOrder: 'asc' },
              include: { group: { include: { addons: { where: { available: true }, orderBy: { sortOrder: 'asc' } } } } },
            },
          },
        },
      },
    })

    const inStock = (r: Parameters<typeof hasStockForOneUnit>[0]) => !s.stockControlEnabled || hasStockForOneUnit(r)

    return categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        products: c.products.map((p) => {
          const variations = p.variations.map((v) => ({
            id: v.id,
            name: v.name,
            price: v.price,
            available: v.available && inStock(v.recipe),
          }))
          // Produto com variações fica disponível se ao menos uma variação estiver
          const available =
            p.available && inStock(p.recipe) && (variations.length === 0 || variations.some((v) => v.available))
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            imageUrl: p.imageUrl,
            price: p.price,
            promoPrice: p.promoPrice,
            available,
            variations,
            addonGroups: p.addonGroups.map(({ group }) => ({
              id: group.id,
              name: group.name,
              minSelect: group.minSelect,
              maxSelect: group.maxSelect,
              addons: group.addons.map((a) => ({ id: a.id, name: a.name, price: a.price })),
            })),
          }
        }),
      }))
      .filter((c) => c.products.length > 0)
  })
}
