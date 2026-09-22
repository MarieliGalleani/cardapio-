<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { brl } from '@/lib/format'
import { canOrderNow, canPreOrder, cartSubtotal, shop, statusText, whatsappOrderLink } from './shop'

const router = useRouter()
const store = computed(() => shop.store!)

// Pedido pelo WhatsApp (checkout desligado)
const name = ref('')
const notes = ref('')
const waLink = computed(() => whatsappOrderLink(name.value.trim(), notes.value.trim()))

const belowMinimum = computed(() => store.value.minimumOrderValue != null && cartSubtotal.value < store.value.minimumOrderValue)
const blockedByStatus = computed(() => !canOrderNow.value && !canPreOrder.value)

function changeQty(i: number, delta: number) {
  const item = shop.cart[i]
  item.quantity += delta
  if (item.quantity <= 0) shop.cart.splice(i, 1)
}
</script>

<template>
  <v-toolbar color="surface" density="comfortable" class="border-b">
    <v-btn icon="mdi-arrow-left" aria-label="Voltar" @click="router.push('/')" />
    <v-toolbar-title>Sacola</v-toolbar-title>
  </v-toolbar>

  <div v-if="!shop.cart.length" class="pa-8 text-center">
    <v-icon icon="mdi-shopping-outline" size="64" color="medium-emphasis" />
    <p class="mt-4 text-medium-emphasis">Sua sacola está vazia.</p>
    <v-btn class="mt-4" color="primary" variant="tonal" to="/">Ver cardápio</v-btn>
  </div>

  <template v-else>
    <v-list lines="three" class="py-0">
      <v-list-item v-for="(item, i) in shop.cart" :key="item.key" class="border-b py-3">
        <v-list-item-title class="font-weight-medium text-wrap">{{ item.name }}</v-list-item-title>
        <div v-if="item.addons.length" class="text-body-2 text-medium-emphasis">+ {{ item.addons.map((a) => a.name).join(', ') }}</div>
        <div v-if="item.notes" class="text-body-2 text-medium-emphasis">Obs.: {{ item.notes }}</div>
        <div class="font-weight-medium mt-1">{{ brl(item.unitPrice * item.quantity) }}</div>
        <template #append>
          <div class="d-flex align-center ga-1">
            <v-btn
              :icon="item.quantity === 1 ? 'mdi-delete-outline' : 'mdi-minus'"
              variant="text"
              size="small"
              :aria-label="item.quantity === 1 ? 'Remover' : 'Menos'"
              @click="changeQty(i, -1)"
            />
            <span class="font-weight-bold">{{ item.quantity }}</span>
            <v-btn icon="mdi-plus" variant="text" size="small" color="primary" aria-label="Mais" @click="changeQty(i, 1)" />
          </div>
        </template>
      </v-list-item>
    </v-list>

    <div class="pa-4">
      <v-btn variant="text" color="primary" prepend-icon="mdi-plus" to="/" class="px-0">Adicionar mais itens</v-btn>

      <div class="d-flex text-subtitle-1 font-weight-bold mt-4">
        <span>Subtotal</span>
        <v-spacer />
        <span>{{ brl(cartSubtotal) }}</span>
      </div>
      <p v-if="store.features.checkout && store.features.delivery" class="text-caption text-medium-emphasis">
        A taxa de entrega é calculada no próximo passo.
      </p>

      <v-alert v-if="belowMinimum" type="warning" variant="tonal" density="compact" class="mt-4">
        O pedido mínimo é de {{ brl(store.minimumOrderValue) }}.
      </v-alert>
      <v-alert v-if="blockedByStatus" type="info" variant="tonal" density="compact" class="mt-4">
        {{ statusText }}. Volte mais tarde para fazer o pedido.
      </v-alert>

      <!-- Checkout ligado -->
      <v-btn
        v-if="store.features.checkout"
        class="mt-6"
        block
        size="x-large"
        color="primary"
        :disabled="belowMinimum || blockedByStatus"
        @click="router.push('/checkout')"
      >
        Continuar
      </v-btn>

      <!-- Checkout desligado: a sacola vira mensagem de WhatsApp -->
      <template v-else>
        <v-divider class="my-6" />
        <h2 class="text-subtitle-1 font-weight-bold mb-3">Finalizar pelo WhatsApp</h2>
        <v-text-field v-model="name" label="Seu nome" autocomplete="name" />
        <v-textarea v-model="notes" label="Observações (entrega, horário, etc.)" rows="2" auto-grow />
        <v-btn
          v-if="waLink"
          block
          size="x-large"
          color="#25D366"
          class="text-white"
          prepend-icon="mdi-whatsapp"
          :href="waLink"
          target="_blank"
          rel="noopener"
          :disabled="belowMinimum"
        >
          Pedir pelo WhatsApp
        </v-btn>
        <v-alert v-else type="warning" variant="tonal">A loja ainda não cadastrou o WhatsApp.</v-alert>
      </template>
    </div>
  </template>
</template>
