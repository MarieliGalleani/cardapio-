<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { brl } from '@/lib/format'

interface MenuProduct {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  price: number
  promoPrice: number | null
  available: boolean
  variations: { id: string; name: string; price: number; available: boolean }[]
}

interface Store {
  name: string
  status: { state: string }
}
interface MenuCategory {
  id: string
  name: string
  products: MenuProduct[]
}

const store = ref<Store | null>(null)
const menu = ref<MenuCategory[]>([])

onMounted(async () => {
  ;[store.value, menu.value] = await Promise.all([api.get<Store>('/public/store'), api.get<MenuCategory[]>('/public/menu')])
})

const statusLabel: Record<string, string> = { OPEN: 'Aberta', CLOSED: 'Fechada', PAUSED: 'Pausada' }
const price = (p: MenuProduct) =>
  p.variations.length ? `a partir de ${brl(Math.min(...p.variations.map((v) => v.price)))}` : brl(p.promoPrice ?? p.price)
</script>

<!-- Prévia da loja. A vitrine completa (sacola, checkout, WhatsApp) vem nas próximas etapas. -->
<template>
  <v-main class="bg-background">
    <v-container style="max-width: 640px">
      <div v-if="store" class="d-flex align-center mb-4">
        <h1 class="text-h5">{{ store.name }}</h1>
        <v-spacer />
        <v-chip :color="store.status.state === 'OPEN' ? 'success' : 'error'" variant="flat" size="small">
          {{ statusLabel[store.status.state] }}
        </v-chip>
      </div>
      <section v-for="c in menu" :key="c.id" class="mb-6">
        <h2 class="text-h6 mb-2">{{ c.name }}</h2>
        <v-card v-for="p in c.products" :key="p.id" class="mb-2" :disabled="!p.available" variant="flat">
          <div class="d-flex pa-3 ga-3">
            <div class="flex-grow-1">
              <div class="font-weight-medium">{{ p.name }}</div>
              <div class="text-body-2 text-medium-emphasis">{{ p.description }}</div>
              <div class="mt-1">{{ p.available ? price(p) : 'Indisponível' }}</div>
            </div>
            <v-avatar v-if="p.imageUrl" rounded="lg" size="80"><v-img :src="p.imageUrl" cover /></v-avatar>
          </div>
        </v-card>
      </section>
    </v-container>
  </v-main>
</template>
