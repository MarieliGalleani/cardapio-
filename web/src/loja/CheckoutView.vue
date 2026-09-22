<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import { brl } from '@/lib/format'
import { canOrderNow, cartSubtotal, clearCart, paymentLabel, shop, type PaymentMethod } from './shop'

const router = useRouter()
const store = computed(() => shop.store!)

const CONTACT_KEY = 'cardapio.contato'
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem(CONTACT_KEY) ?? '{}')
  } catch {
    return {}
  }
})()

const fulfillment = ref<'PICKUP' | 'DELIVERY'>(store.value.features.pickup ? 'PICKUP' : 'DELIVERY')
const address = ref({ street: '', number: '', complement: '', neighborhood: '', reference: '', ...(saved.address ?? {}) })
const when = ref<'NOW' | 'SCHEDULE'>(canOrderNow.value ? 'NOW' : 'SCHEDULE')
const scheduledFor = ref('')
const paymentMethod = ref<PaymentMethod | null>(store.value.paymentMethods[0] ?? null)
const changeFor = ref<number | null>(null)
const customerName = ref<string>(saved.name ?? '')
const customerPhone = ref<string>(saved.phone ?? '')
const notes = ref('')
const error = ref('')
const sending = ref(false)
const form = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)

onMounted(() => {
  if (!shop.cart.length) router.replace('/sacola')
})

const zone = computed(() => store.value.deliveryZones.find((z) => z.neighborhood === address.value.neighborhood))
const deliveryFee = computed(() => (fulfillment.value === 'DELIVERY' ? (zone.value?.fee ?? 0) : 0))
const total = computed(() => Math.round((cartSubtotal.value + deliveryFee.value) * 100) / 100)

// Menor data/hora aceita para encomenda, no formato do campo datetime-local
const minSchedule = computed(() => {
  const d = new Date(Date.now() + store.value.preOrderMinHours * 3_600_000)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
})

const noFulfillment = computed(() => !store.value.features.pickup && !store.value.features.delivery)
const required = (v: unknown) => (v != null && String(v).trim() !== '') || 'Obrigatório'
const phoneRule = (v: string) => (v.replace(/\D/g, '').length >= 10 && v.replace(/\D/g, '').length <= 13) || 'Telefone com DDD'

async function submit() {
  error.value = ''
  const { valid } = (await form.value?.validate()) ?? { valid: false }
  if (!valid) {
    error.value = 'Confira os campos destacados'
    return
  }
  if (!paymentMethod.value) return
  sending.value = true
  try {
    try {
      localStorage.setItem(
        CONTACT_KEY,
        JSON.stringify({ name: customerName.value, phone: customerPhone.value, address: address.value }),
      )
    } catch {
      /* sem armazenamento: só não lembra os dados na próxima vez */
    }
    const order = await api.post<{ publicToken: string }>('/public/orders', {
      customerName: customerName.value,
      customerPhone: customerPhone.value,
      fulfillment: fulfillment.value,
      address: fulfillment.value === 'DELIVERY' ? address.value : null,
      scheduledFor: when.value === 'SCHEDULE' && scheduledFor.value ? new Date(scheduledFor.value).toISOString() : null,
      paymentMethod: paymentMethod.value,
      changeFor: paymentMethod.value === 'CASH' ? changeFor.value || null : null,
      notes: notes.value || null,
      items: shop.cart.map((i) => ({
        productId: i.productId,
        variationId: i.variationId,
        quantity: i.quantity,
        addonIds: i.addons.map((a) => a.id),
        notes: i.notes || null,
      })),
    })
    clearCart()

    if (paymentMethod.value === 'CREDIT_CARD' || paymentMethod.value === 'DEBIT_CARD') {
      try {
        const { url } = await api.post<{ url: string }>(`/public/orders/${order.publicToken}/checkout`)
        window.location.href = url
        return
      } catch {
        // O pedido já foi criado: a página do pedido oferece tentar pagar de novo
      }
    }
    router.replace(`/pedido/${order.publicToken}`)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <v-toolbar color="surface" density="comfortable" class="border-b">
    <v-btn icon="mdi-arrow-left" aria-label="Voltar" @click="router.push('/sacola')" />
    <v-toolbar-title>Finalizar pedido</v-toolbar-title>
  </v-toolbar>

  <v-form ref="form" class="pa-4" @submit.prevent="submit">
    <v-alert v-if="noFulfillment" type="warning" variant="tonal" class="mb-4">
      A loja não está aceitando retirada nem entrega no momento.
    </v-alert>

    <!-- Retirada ou entrega -->
    <h2 class="section-title">Como você quer receber?</h2>
    <v-btn-toggle v-model="fulfillment" mandatory color="primary" variant="outlined" divided class="w-100 mb-3">
      <v-btn v-if="store.features.pickup" value="PICKUP" class="flex-grow-1" prepend-icon="mdi-storefront-outline">Retirar</v-btn>
      <v-btn v-if="store.features.delivery" value="DELIVERY" class="flex-grow-1" prepend-icon="mdi-moped-outline">Entrega</v-btn>
    </v-btn-toggle>

    <p v-if="fulfillment === 'PICKUP' && store.pickupAddress" class="text-body-2 mb-4">
      <v-icon icon="mdi-map-marker-outline" size="small" /> Retirada em: {{ store.pickupAddress }}
    </p>

    <template v-if="fulfillment === 'DELIVERY'">
      <v-select
        v-model="address.neighborhood"
        :items="store.deliveryZones"
        item-title="neighborhood"
        item-value="neighborhood"
        label="Bairro"
        :rules="[required]"
        no-data-text="Nenhum bairro cadastrado"
      >
        <template #item="{ props: itemProps, item }">
          <v-list-item v-bind="itemProps">
            <template #append>{{ item.raw.fee ? brl(item.raw.fee) : 'Grátis' }}</template>
          </v-list-item>
        </template>
      </v-select>
      <v-row dense>
        <v-col cols="8"><v-text-field v-model="address.street" label="Rua" :rules="[required]" autocomplete="address-line1" /></v-col>
        <v-col cols="4"><v-text-field v-model="address.number" label="Número" :rules="[required]" /></v-col>
      </v-row>
      <v-text-field v-model="address.complement" label="Complemento" placeholder="Apto, bloco…" />
      <v-text-field v-model="address.reference" label="Ponto de referência" />
    </template>

    <!-- Quando -->
    <template v-if="store.features.preOrders">
      <h2 class="section-title">Quando?</h2>
      <v-btn-toggle v-model="when" mandatory color="primary" variant="outlined" divided class="w-100 mb-3">
        <v-btn value="NOW" class="flex-grow-1" :disabled="!canOrderNow">Agora</v-btn>
        <v-btn value="SCHEDULE" class="flex-grow-1" prepend-icon="mdi-calendar">Agendar</v-btn>
      </v-btn-toggle>
      <v-text-field
        v-if="when === 'SCHEDULE'"
        v-model="scheduledFor"
        type="datetime-local"
        label="Data e horário"
        :min="minSchedule"
        :rules="[required]"
        :hint="`Encomendas com pelo menos ${store.preOrderMinHours} h de antecedência`"
        persistent-hint
      />
    </template>

    <!-- Pagamento -->
    <h2 class="section-title">Pagamento</h2>
    <v-alert v-if="!store.paymentMethods.length" type="warning" variant="tonal" density="compact">
      A loja ainda não configurou as formas de pagamento.
    </v-alert>
    <v-radio-group v-model="paymentMethod" hide-details>
      <v-radio v-for="m in store.paymentMethods" :key="m" :value="m" :label="paymentLabel[m]" color="primary" />
    </v-radio-group>
    <p v-if="paymentMethod === 'PIX'" class="text-caption text-medium-emphasis mt-1">
      Depois de confirmar, você recebe o código Pix para pagar.
    </p>
    <p v-if="paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT_CARD'" class="text-caption text-medium-emphasis mt-1">
      Você será levado ao Mercado Pago para pagar com segurança.
    </p>
    <v-text-field
      v-if="paymentMethod === 'CASH'"
      v-model.number="changeFor"
      class="mt-3"
      label="Troco para quanto?"
      prefix="R$"
      type="number"
      hint="Deixe vazio se não precisar de troco"
      persistent-hint
    />

    <!-- Contato -->
    <h2 class="section-title">Seus dados</h2>
    <v-text-field v-model="customerName" label="Nome" :rules="[required]" autocomplete="name" />
    <v-text-field
      v-model="customerPhone"
      label="WhatsApp"
      type="tel"
      placeholder="(16) 99999-9999"
      :rules="[required, phoneRule]"
      autocomplete="tel"
    />
    <v-textarea v-model="notes" label="Observações do pedido" rows="2" auto-grow />

    <!-- Resumo -->
    <v-card variant="tonal" class="mt-2 mb-4">
      <v-card-text>
        <div class="d-flex"><span>Subtotal</span><v-spacer />{{ brl(cartSubtotal) }}</div>
        <div v-if="fulfillment === 'DELIVERY'" class="d-flex">
          <span>Entrega</span><v-spacer />{{ zone ? (zone.fee ? brl(zone.fee) : 'Grátis') : '—' }}
        </div>
        <div class="d-flex text-subtitle-1 font-weight-bold mt-2"><span>Total</span><v-spacer />{{ brl(total) }}</div>
      </v-card-text>
    </v-card>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-btn
      type="submit"
      block
      size="x-large"
      color="primary"
      :loading="sending"
      :disabled="noFulfillment || !paymentMethod"
    >
      Fazer pedido · {{ brl(total) }}
    </v-btn>
  </v-form>
</template>

<style scoped>
.section-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 20px 0 10px;
}
</style>
