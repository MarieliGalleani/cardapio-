<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { api, auth } from '@/lib/api'
import { brl } from '@/lib/format'
import { notify, notifyError } from '@/lib/notify'
import {
  beep,
  paymentLabel,
  paymentStatusLabel,
  statusColor,
  statusLabel,
  type AdminOrder,
  type OrderStatus,
} from '@/lib/orders'
import OrderDialog from '../components/OrderDialog.vue'

const tab = ref<'active' | 'history'>('active')
const active = ref<AdminOrder[]>([])
const history = ref<AdminOrder[]>([])
const historyDate = ref(new Date().toLocaleDateString('sv-SE')) // AAAA-MM-DD no fuso do navegador
const loading = ref(true)
const settings = ref<{ name: string; whatsappMessages: Partial<Record<OrderStatus, string>> }>({ name: '', whatsappMessages: {} })

const SOUND_KEY = 'cardapio.som'
const soundOn = ref(readSound())
function readSound() {
  try {
    return localStorage.getItem(SOUND_KEY) === '1'
  } catch {
    return false
  }
}
function toggleSound() {
  soundOn.value = !soundOn.value
  try {
    localStorage.setItem(SOUND_KEY, soundOn.value ? '1' : '0')
  } catch {
    /* preferência vale só nesta aba */
  }
  if (soundOn.value) beep() // o clique libera o áudio no navegador
}

const selected = ref<AdminOrder | null>(null)
const dialog = ref(false)

async function loadActive() {
  active.value = await api.get<AdminOrder[]>('/admin/orders?scope=active')
  if (selected.value) {
    const fresh = active.value.find((o) => o.id === selected.value!.id)
    if (fresh) selected.value = fresh
  }
}

async function loadHistory() {
  const from = new Date(`${historyDate.value}T00:00:00`)
  const to = new Date(from.getTime() + 86_400_000)
  history.value = await api.get<AdminOrder[]>(`/admin/orders?scope=history&from=${from.toISOString()}&to=${to.toISOString()}`)
}

// Colunas do quadro
const columns = computed(() => [
  { title: 'Novos', statuses: ['RECEIVED'] as OrderStatus[], color: 'info' },
  { title: 'Em preparo', statuses: ['PREPARING'] as OrderStatus[], color: 'warning' },
  { title: 'Prontos / a caminho', statuses: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'] as OrderStatus[], color: 'purple' },
])
const inColumn = (statuses: OrderStatus[]) => active.value.filter((o) => statuses.includes(o.status))

let stream: EventSource | null = null
function connect() {
  stream?.close()
  stream = new EventSource(`/api/admin-stream/orders?token=${encodeURIComponent(auth.token ?? '')}`)
  stream.onmessage = async (msg) => {
    const event = JSON.parse(msg.data) as { type: 'created' | 'updated' }
    if (event.type === 'created') {
      notify('Pedido novo!', 'success')
      if (soundOn.value) beep()
    }
    try {
      await loadActive()
      if (tab.value === 'history') await loadHistory()
    } catch {
      /* a próxima atualização tenta de novo */
    }
  }
}

onMounted(async () => {
  try {
    const [s] = await Promise.all([api.get<typeof settings.value>('/admin/settings'), loadActive()])
    settings.value = s
  } catch (e) {
    notifyError(e)
  } finally {
    loading.value = false
  }
  connect()
})
onBeforeUnmount(() => stream?.close())

function openOrder(o: AdminOrder) {
  selected.value = o
  dialog.value = true
}

async function onChanged(o: AdminOrder) {
  selected.value = o
  await loadActive()
  if (tab.value === 'history') await loadHistory()
}

const since = (iso: string) => {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const historyHeaders = [
  { title: '#', key: 'number' },
  { title: 'Hora', key: 'createdAt' },
  { title: 'Cliente', key: 'customerName' },
  { title: 'Status', key: 'status' },
  { title: 'Pagamento', key: 'paymentMethod' },
  { title: 'Total', key: 'total', align: 'end' as const },
]
</script>

<template>
  <div class="d-flex align-center flex-wrap ga-2 mb-4">
    <h1 class="text-h5">Pedidos</h1>
    <v-spacer />
    <v-btn
      :prepend-icon="soundOn ? 'mdi-volume-high' : 'mdi-volume-off'"
      :color="soundOn ? 'primary' : undefined"
      variant="tonal"
      @click="toggleSound"
    >
      Som {{ soundOn ? 'ligado' : 'desligado' }}
    </v-btn>
  </div>

  <v-tabs v-model="tab" color="primary" class="mb-4" @update:model-value="tab === 'history' && loadHistory()">
    <v-tab value="active">Em andamento <v-badge v-if="active.length" :content="active.length" inline color="primary" /></v-tab>
    <v-tab value="history">Histórico</v-tab>
  </v-tabs>

  <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

  <v-window v-model="tab">
    <v-window-item value="active">
      <v-row>
        <v-col v-for="col in columns" :key="col.title" cols="12" md="4">
          <div class="d-flex align-center mb-2">
            <v-icon icon="mdi-circle" :color="col.color" size="x-small" class="mr-2" />
            <span class="font-weight-medium">{{ col.title }}</span>
            <v-chip size="x-small" class="ml-2">{{ inColumn(col.statuses).length }}</v-chip>
          </div>
          <v-card
            v-for="o in inColumn(col.statuses)"
            :key="o.id"
            class="mb-3"
            :class="{ 'new-order': o.status === 'RECEIVED' }"
            @click="openOrder(o)"
          >
            <v-card-item>
              <v-card-title class="d-flex align-center text-subtitle-1">
                #{{ o.number }} · {{ o.customerName }}
                <v-spacer />
                <span class="text-caption text-medium-emphasis">{{ since(o.createdAt) }}</span>
              </v-card-title>
              <v-card-subtitle class="text-wrap">
                {{ o.items.map((i) => `${i.quantity}x ${i.name}`).join(', ') }}
              </v-card-subtitle>
            </v-card-item>
            <v-card-text class="d-flex flex-wrap align-center ga-1 pt-0">
              <v-chip size="x-small" variant="tonal" :prepend-icon="o.fulfillment === 'DELIVERY' ? 'mdi-moped' : 'mdi-storefront-outline'">
                {{ o.fulfillment === 'DELIVERY' ? o.address?.neighborhood : 'Retirada' }}
              </v-chip>
              <v-chip v-if="o.scheduledFor" size="x-small" color="info" variant="tonal" prepend-icon="mdi-calendar">
                {{ new Date(o.scheduledFor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) }}
              </v-chip>
              <v-chip size="x-small" :color="o.paymentStatus === 'PAID' ? 'success' : 'warning'" variant="tonal">
                {{ paymentLabel[o.paymentMethod] }} · {{ paymentStatusLabel[o.paymentStatus] }}
              </v-chip>
              <v-spacer />
              <strong>{{ brl(o.total) }}</strong>
            </v-card-text>
          </v-card>
          <p v-if="!inColumn(col.statuses).length" class="text-body-2 text-medium-emphasis pa-2">Nenhum pedido.</p>
        </v-col>
      </v-row>
    </v-window-item>

    <v-window-item value="history">
      <v-text-field
        v-model="historyDate"
        type="date"
        label="Dia"
        density="compact"
        style="max-width: 220px"
        @update:model-value="loadHistory"
      />
      <v-card>
        <v-data-table
          :headers="historyHeaders"
          :items="history"
          items-per-page="50"
          no-data-text="Nenhum pedido nesse dia"
          hover
          @click:row="(_e: unknown, { item }: { item: AdminOrder }) => openOrder(item)"
        >
          <template #[`item.createdAt`]="{ item }">
            {{ new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}
          </template>
          <template #[`item.status`]="{ item }">
            <v-chip size="small" :color="statusColor[item.status]" variant="tonal">{{ statusLabel[item.status] }}</v-chip>
          </template>
          <template #[`item.paymentMethod`]="{ item }">
            {{ paymentLabel[item.paymentMethod] }} · {{ paymentStatusLabel[item.paymentStatus] }}
          </template>
          <template #[`item.total`]="{ item }">{{ brl(item.total) }}</template>
        </v-data-table>
      </v-card>
    </v-window-item>
  </v-window>

  <OrderDialog
    v-model="dialog"
    :order="selected"
    :messages="settings.whatsappMessages"
    :store-name="settings.name"
    @changed="onChanged"
  />
</template>

<style scoped>
.new-order {
  border-left: 4px solid rgb(var(--v-theme-info));
}
</style>
