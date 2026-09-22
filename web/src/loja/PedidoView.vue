<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { api } from '@/lib/api'
import { brl } from '@/lib/format'
import { notify, notifyError } from '@/lib/notify'
import { paymentLabel, type PaymentMethod } from './shop'

type Status = 'RECEIVED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'READY_FOR_PICKUP' | 'DELIVERED' | 'CANCELED'

interface PublicOrder {
  number: number
  publicToken: string
  createdAt: string
  trackingEnabled: boolean
  status: Status | null
  statusHistory: { status: Status; at: string }[]
  fulfillment: 'PICKUP' | 'DELIVERY'
  scheduledFor: string | null
  customerName: string
  address: { street: string; number: string; complement?: string; neighborhood: string } | null
  pickupAddress: string | null
  items: { name: string; quantity: number; unitPrice: number; notes: string | null; addons: { name: string; price: number }[] }[]
  subtotal: number
  deliveryFee: number
  total: number
  paymentMethod: PaymentMethod
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  changeFor: number | null
  pix: { payload: string; key: string; receiverName: string } | null
  store: { name: string; whatsappPhone: string | null }
}

const route = useRoute()
const router = useRouter()
const token = route.params.token as string
const order = ref<PublicOrder | null>(null)
const qr = ref('')
const error = ref('')
const paying = ref(false)
let stream: EventSource | null = null

async function load() {
  try {
    order.value = await api.get<PublicOrder>(`/public/orders/${token}`)
    if (order.value.pix) qr.value = await QRCode.toDataURL(order.value.pix.payload, { width: 240, margin: 1 })
  } catch (e) {
    error.value = (e as Error).message
  }
}

onMounted(async () => {
  // Volta do Mercado Pago: confirma o pagamento consultando o próprio Mercado Pago
  const paymentId = (route.query.payment_id ?? route.query.collection_id) as string | undefined
  if (paymentId && /^\d+$/.test(paymentId)) {
    try {
      await api.post(`/public/orders/${token}/payment/sync`, { paymentId })
    } catch {
      /* se falhar, o aviso automático do Mercado Pago ainda atualiza o pedido */
    }
    router.replace({ query: {} })
  }
  await load()
  stream = new EventSource(`/api/public/orders/${token}/stream`)
  stream.onmessage = () => load()
})

onBeforeUnmount(() => stream?.close())

const steps = computed(() => {
  const o = order.value
  if (!o) return []
  const middle: Status = o.fulfillment === 'DELIVERY' ? 'OUT_FOR_DELIVERY' : 'READY_FOR_PICKUP'
  return [
    { status: 'RECEIVED' as Status, label: 'Pedido recebido', icon: 'mdi-receipt-text-check-outline' },
    { status: 'PREPARING' as Status, label: 'Em preparo', icon: 'mdi-chef-hat' },
    {
      status: middle,
      label: o.fulfillment === 'DELIVERY' ? 'Saiu para entrega' : 'Pronto para retirar',
      icon: o.fulfillment === 'DELIVERY' ? 'mdi-moped' : 'mdi-storefront-outline',
    },
    { status: 'DELIVERED' as Status, label: o.fulfillment === 'DELIVERY' ? 'Entregue' : 'Retirado', icon: 'mdi-check-circle' },
  ]
})

const reachedAt = (s: Status) => order.value?.statusHistory.find((h) => h.status === s)?.at
const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '')

const needsCardPayment = computed(
  () =>
    order.value &&
    (order.value.paymentMethod === 'CREDIT_CARD' || order.value.paymentMethod === 'DEBIT_CARD') &&
    order.value.paymentStatus !== 'PAID' &&
    order.value.status !== 'CANCELED',
)

async function payWithCard() {
  paying.value = true
  try {
    const { url } = await api.post<{ url: string }>(`/public/orders/${token}/checkout`)
    window.location.href = url
  } catch (e) {
    notifyError(e)
    paying.value = false
  }
}

async function copyPix() {
  try {
    await navigator.clipboard.writeText(order.value!.pix!.payload)
    notify('Código Pix copiado')
  } catch {
    notify('Não foi possível copiar. Selecione o código e copie manualmente.', 'warning')
  }
}

const whatsappLink = computed(() => {
  const o = order.value
  if (!o?.store.whatsappPhone) return null
  const text = `Olá! Sobre o meu pedido #${o.number}:`
  return `https://wa.me/${o.store.whatsappPhone}?text=${encodeURIComponent(text)}`
})

const paymentStatusText = {
  PENDING: 'Aguardando pagamento',
  PAID: 'Pago',
  FAILED: 'Pagamento recusado',
  REFUNDED: 'Estornado',
}
</script>

<template>
  <v-toolbar color="surface" density="comfortable" class="border-b">
    <v-btn icon="mdi-home-outline" aria-label="Voltar ao cardápio" to="/" />
    <v-toolbar-title>{{ order ? `Pedido #${order.number}` : 'Pedido' }}</v-toolbar-title>
  </v-toolbar>

  <v-alert v-if="error" type="error" variant="tonal" class="ma-4">{{ error }}</v-alert>

  <div v-else-if="order" class="pa-4">
    <!-- Cancelado -->
    <v-alert v-if="order.status === 'CANCELED'" type="error" variant="tonal" class="mb-4" title="Pedido cancelado">
      Fale com a loja se tiver alguma dúvida.
    </v-alert>

    <!-- Acompanhamento ligado -->
    <template v-else-if="order.trackingEnabled && order.status">
      <v-timeline side="end" density="compact" align="start" truncate-line="both" class="mb-4">
        <v-timeline-item
          v-for="step in steps"
          :key="step.status"
          :dot-color="reachedAt(step.status) ? 'primary' : 'grey-lighten-2'"
          :icon="step.icon"
          size="small"
        >
          <div :class="reachedAt(step.status) ? 'font-weight-bold' : 'text-medium-emphasis'">{{ step.label }}</div>
          <div class="text-caption">{{ time(reachedAt(step.status)) }}</div>
        </v-timeline-item>
      </v-timeline>
    </template>

    <!-- Acompanhamento desligado: só a confirmação -->
    <v-alert v-else type="success" variant="tonal" class="mb-4" title="Pedido enviado!">
      A loja recebeu seu pedido e vai entrar em contato pelo WhatsApp.
    </v-alert>

    <p v-if="order.scheduledFor" class="text-body-2 mb-4">
      <v-icon icon="mdi-calendar" size="small" /> Encomenda para
      <strong>{{ new Date(order.scheduledFor).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' }) }}</strong>
    </p>

    <!-- Pix -->
    <v-card v-if="order.pix" variant="outlined" class="mb-4 text-center">
      <v-card-item title="Pague com Pix" :subtitle="`${brl(order.total)} para ${order.pix.receiverName}`" />
      <v-card-text>
        <img v-if="qr" :src="qr" alt="QR Code Pix" width="220" height="220" class="d-block mx-auto" />
        <p class="text-caption text-medium-emphasis mt-2">Abra o app do banco, escolha Pix e leia o QR Code ou use o código abaixo.</p>
        <div class="pix-code mt-3">{{ order.pix.payload }}</div>
        <v-btn class="mt-3" color="primary" block size="large" prepend-icon="mdi-content-copy" @click="copyPix">
          Copiar código Pix
        </v-btn>
        <p class="text-caption mt-3">Chave: {{ order.pix.key }}. A loja confirma o pagamento assim que ele cair.</p>
      </v-card-text>
    </v-card>

    <!-- Cartão pendente -->
    <v-card v-if="needsCardPayment" variant="outlined" class="mb-4">
      <v-card-item
        :title="order.paymentStatus === 'FAILED' ? 'O pagamento não foi aprovado' : 'Falta pagar'"
        :subtitle="paymentLabel[order.paymentMethod]"
      />
      <v-card-text>
        <v-btn color="primary" block size="large" :loading="paying" prepend-icon="mdi-credit-card-outline" @click="payWithCard">
          {{ order.paymentStatus === 'FAILED' ? 'Tentar de novo' : 'Pagar agora' }} · {{ brl(order.total) }}
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- Resumo -->
    <h2 class="text-subtitle-1 font-weight-bold mb-2">Resumo</h2>
    <div v-for="(item, i) in order.items" :key="i" class="d-flex py-1 text-body-2">
      <div>
        <strong>{{ item.quantity }}x</strong> {{ item.name }}
        <div v-if="item.addons.length" class="text-medium-emphasis">+ {{ item.addons.map((a) => a.name).join(', ') }}</div>
        <div v-if="item.notes" class="text-medium-emphasis">Obs.: {{ item.notes }}</div>
      </div>
      <v-spacer />
      <span class="ml-2">{{ brl((item.unitPrice + item.addons.reduce((s, a) => s + a.price, 0)) * item.quantity) }}</span>
    </div>
    <v-divider class="my-2" />
    <div class="d-flex text-body-2"><span>Subtotal</span><v-spacer />{{ brl(order.subtotal) }}</div>
    <div v-if="order.fulfillment === 'DELIVERY'" class="d-flex text-body-2">
      <span>Entrega</span><v-spacer />{{ order.deliveryFee ? brl(order.deliveryFee) : 'Grátis' }}
    </div>
    <div class="d-flex font-weight-bold mt-1"><span>Total</span><v-spacer />{{ brl(order.total) }}</div>

    <v-list density="compact" class="mt-4 px-0">
      <v-list-item
        prepend-icon="mdi-wallet-outline"
        :title="paymentLabel[order.paymentMethod]"
        :subtitle="paymentStatusText[order.paymentStatus] + (order.changeFor ? ` · troco para ${brl(order.changeFor)}` : '')"
      />
      <v-list-item
        v-if="order.fulfillment === 'DELIVERY' && order.address"
        prepend-icon="mdi-map-marker-outline"
        title="Entrega"
        :subtitle="`${order.address.street}, ${order.address.number}${order.address.complement ? ` — ${order.address.complement}` : ''} · ${order.address.neighborhood}`"
      />
      <v-list-item
        v-else
        prepend-icon="mdi-storefront-outline"
        title="Retirada na loja"
        :subtitle="order.pickupAddress ?? ''"
      />
    </v-list>

    <v-btn
      v-if="whatsappLink"
      class="mt-4"
      block
      variant="tonal"
      prepend-icon="mdi-whatsapp"
      :href="whatsappLink"
      target="_blank"
      rel="noopener"
    >
      Falar com a loja
    </v-btn>
  </div>

  <div v-else class="d-flex justify-center pa-12"><v-progress-circular indeterminate color="primary" /></div>
</template>

<style scoped>
.pix-code {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
  padding: 8px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  user-select: all;
}
</style>
