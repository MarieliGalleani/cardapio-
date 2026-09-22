<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { brl, pct, qty } from '@/lib/format'
import { notifyError } from '@/lib/notify'
import type { BelowTarget, StockItem } from '@/lib/types'

interface Period {
  orders: number
  revenue: number
  averageTicket: number
}
interface Dashboard {
  today: Period
  week: Period
  month: Period
  topProducts: { name: string; quantity: number; revenue: number }[]
  margin: number | null
}

const data = ref<Dashboard | null>(null)
const lowStock = ref<StockItem[]>([])
const belowTarget = ref<BelowTarget[]>([])

onMounted(async () => {
  try {
    ;[data.value, lowStock.value, belowTarget.value] = await Promise.all([
      api.get<Dashboard>('/admin/dashboard'),
      api.get<StockItem[]>('/admin/stock/alerts'),
      api.get<BelowTarget[]>('/admin/recipes/below-target'),
    ])
  } catch (e) {
    notifyError(e)
  }
})

const periods = [
  { key: 'today' as const, label: 'Hoje' },
  { key: 'week' as const, label: 'Últimos 7 dias' },
  { key: 'month' as const, label: 'Este mês' },
]
</script>

<template>
  <h1 class="text-h5 mb-4">Dashboard</h1>

  <v-row v-if="data">
    <v-col v-for="p in periods" :key="p.key" cols="12" sm="6" md="3">
      <v-card class="h-100">
        <v-card-text>
          <div class="text-caption text-medium-emphasis">Vendas · {{ p.label }}</div>
          <div class="text-h5 font-weight-bold mt-1">{{ brl(data[p.key].revenue) }}</div>
          <div class="text-body-2 text-medium-emphasis mt-1">
            {{ data[p.key].orders }} {{ data[p.key].orders === 1 ? 'pedido' : 'pedidos' }} · ticket médio
            {{ brl(data[p.key].averageTicket) }}
          </div>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="12" sm="6" md="3">
      <v-card class="h-100">
        <v-card-text>
          <div class="text-caption text-medium-emphasis">Margem estimada · Este mês</div>
          <div class="text-h5 font-weight-bold mt-1">{{ pct(data.margin) }}</div>
          <div class="text-body-2 text-medium-emphasis mt-1">Pelos produtos com ficha técnica, com o custo de hoje</div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>

  <v-row>
    <v-col cols="12" md="4">
      <v-card class="h-100">
        <v-card-item prepend-icon="mdi-trophy-outline" title="Mais vendidos" subtitle="Este mês" />
        <v-list v-if="data?.topProducts.length" density="compact">
          <v-list-item v-for="(p, i) in data.topProducts" :key="p.name" :title="`${i + 1}. ${p.name}`" :subtitle="brl(p.revenue)">
            <template #append>
              <span class="font-weight-medium">{{ p.quantity }} un</span>
            </template>
          </v-list-item>
        </v-list>
        <v-card-text v-else class="text-medium-emphasis">Ainda sem vendas este mês.</v-card-text>
      </v-card>
    </v-col>
    <v-col cols="12" md="4">
      <v-card class="h-100">
        <v-card-item prepend-icon="mdi-package-variant-closed" title="Estoque baixo" :subtitle="`${lowStock.length} itens`" />
        <v-list v-if="lowStock.length" density="compact">
          <v-list-item v-for="i in lowStock" :key="i.id" :title="i.name">
            <template #append>
              <span class="text-error">{{ qty(i.quantity, i.unit) }}</span>
              <span class="text-medium-emphasis ml-1">/ mín. {{ qty(i.minimum, i.unit) }}</span>
            </template>
          </v-list-item>
        </v-list>
        <v-card-text v-else class="text-medium-emphasis">Tudo em dia.</v-card-text>
        <v-card-actions><v-btn to="/admin/estoque" variant="text" color="primary">Abrir estoque</v-btn></v-card-actions>
      </v-card>
    </v-col>
    <v-col cols="12" md="4">
      <v-card class="h-100">
        <v-card-item prepend-icon="mdi-trending-down" title="Margem abaixo da meta" :subtitle="`${belowTarget.length} produtos`" />
        <v-list v-if="belowTarget.length" density="compact">
          <v-list-item
            v-for="r in belowTarget"
            :key="r.id"
            :title="r.label"
            :subtitle="`Preço ${brl(r.salePrice)} · sugerido ${brl(r.suggestedUnitPrice)}`"
          >
            <template #append>
              <span class="text-error">{{ pct(r.actualMargin) }}</span>
            </template>
          </v-list-item>
        </v-list>
        <v-card-text v-else class="text-medium-emphasis">Todos os produtos estão na meta.</v-card-text>
        <v-card-actions><v-btn to="/admin/fichas" variant="text" color="primary">Abrir fichas técnicas</v-btn></v-card-actions>
      </v-card>
    </v-col>
  </v-row>
</template>
