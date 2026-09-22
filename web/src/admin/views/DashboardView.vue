<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { brl, pct, qty } from '@/lib/format'
import { notifyError } from '@/lib/notify'
import type { BelowTarget, StockItem } from '@/lib/types'

const lowStock = ref<StockItem[]>([])
const belowTarget = ref<BelowTarget[]>([])

onMounted(async () => {
  try {
    ;[lowStock.value, belowTarget.value] = await Promise.all([
      api.get<StockItem[]>('/admin/stock/alerts'),
      api.get<BelowTarget[]>('/admin/recipes/below-target'),
    ])
  } catch (e) {
    notifyError(e)
  }
})
</script>

<template>
  <h1 class="text-h5 mb-4">Dashboard</h1>

  <v-alert type="info" variant="tonal" class="mb-6">
    Vendas do dia, semana e mês, ticket médio e mais vendidos aparecem aqui quando o módulo de Pedidos estiver pronto.
  </v-alert>

  <v-row>
    <v-col cols="12" md="6">
      <v-card>
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
    <v-col cols="12" md="6">
      <v-card>
        <v-card-item prepend-icon="mdi-trending-down" title="Margem abaixo da meta" :subtitle="`${belowTarget.length} produtos`" />
        <v-list v-if="belowTarget.length" density="compact">
          <v-list-item v-for="r in belowTarget" :key="r.id" :title="r.label" :subtitle="`Preço ${brl(r.salePrice)} · sugerido ${brl(r.suggestedUnitPrice)}`">
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
