import type { FastifyInstance } from 'fastify'
import { localDayRange } from '../domain/orderRules.js'
import { prisma } from '../lib/prisma.js'
import { num } from '../lib/serialize.js'
import { recipeInclude, summarizeRecipe } from '../services/recipes.js'

// Números do painel. Pedidos cancelados não contam.
export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const now = new Date()
    const today = localDayRange(now)
    const weekStart = new Date(today.start.getTime() - 6 * 86_400_000) // últimos 7 dias, contando hoje
    const spNow = new Date(now.getTime() - 3 * 3_600_000)
    const monthStart = new Date(Date.UTC(spNow.getUTCFullYear(), spNow.getUTCMonth(), 1) + 3 * 3_600_000)

    const orders = await prisma.order.findMany({
      where: { status: { not: 'CANCELED' }, createdAt: { gte: weekStart < monthStart ? weekStart : monthStart } },
      include: { items: { include: { addons: true } } },
    })

    const summary = (from: Date) => {
      const list = orders.filter((o) => o.createdAt >= from)
      const revenue = list.reduce((s, o) => s + num(o.total), 0)
      return {
        orders: list.length,
        revenue: Math.round(revenue * 100) / 100,
        averageTicket: list.length ? Math.round((revenue / list.length) * 100) / 100 : 0,
      }
    }

    // Mais vendidos do mês
    const monthOrders = orders.filter((o) => o.createdAt >= monthStart)
    const byName = new Map<string, { name: string; quantity: number; revenue: number }>()
    for (const o of monthOrders) {
      for (const i of o.items) {
        const addons = i.addons.reduce((s, a) => s + num(a.price), 0)
        const cur = byName.get(i.name) ?? { name: i.name, quantity: 0, revenue: 0 }
        cur.quantity += i.quantity
        cur.revenue += (num(i.unitPrice) + addons) * i.quantity
        byName.set(i.name, cur)
      }
    }
    const topProducts = [...byName.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
      .map((p) => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }))

    // Margem estimada do mês: vendas dos itens com ficha técnica menos o custo atual das receitas
    const recipes = await prisma.recipe.findMany({ include: recipeInclude })
    const unitCost = new Map<string, number>()
    for (const r of recipes) unitCost.set((r.variationId ?? r.productId)!, summarizeRecipe(r).unitCost)
    let costedRevenue = 0
    let cost = 0
    for (const o of monthOrders) {
      for (const i of o.items) {
        const c = unitCost.get(i.variationId ?? i.productId ?? '')
        if (c === undefined) continue
        costedRevenue += num(i.unitPrice) * i.quantity
        cost += c * i.quantity
      }
    }

    return {
      today: summary(today.start),
      week: summary(weekStart),
      month: summary(monthStart),
      topProducts,
      margin: costedRevenue > 0 ? Math.round(((costedRevenue - cost) / costedRevenue) * 10000) / 10000 : null,
    }
  })
}
