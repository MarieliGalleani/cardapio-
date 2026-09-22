<script setup lang="ts">
import { ref } from 'vue'
import { api } from '@/lib/api'
import { brl } from '@/lib/format'
import { notifyError } from '@/lib/notify'
import {
  actionLabel,
  defaultMessages,
  paymentLabel,
  paymentStatusLabel,
  statusColor,
  statusLabel,
  whatsappToCustomer,
  type AdminOrder,
  type OrderStatus,
} from '@/lib/orders'

const props = defineProps<{ order: AdminOrder | null; messages: Partial<Record<OrderStatus, string>>; storeName: string }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ changed: [AdminOrder] }>()
const busy = ref(false)

async function move(to: OrderStatus) {
  if (to === 'CANCELED' && !confirm(`Cancelar o pedido #${props.order!.number}?`)) return
  busy.value = true
  try {
    emit('changed', await api.post<AdminOrder>(`/admin/orders/${props.order!.id}/status`, { status: to }))
  } catch (e) {
    notifyError(e)
  } finally {
    busy.value = false
  }
}

async function setPayment(status: 'PAID' | 'PENDING') {
  busy.value = true
  try {
    emit('changed', await api.post<AdminOrder>(`/admin/orders/${props.order!.id}/payment`, { status }))
  } catch (e) {
    notifyError(e)
  } finally {
    busy.value = false
  }
}

const waLink = (o: AdminOrder) => whatsappToCustomer(o, props.messages[o.status] || defaultMessages[o.status], props.storeName)
const time = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const addonsTotal = (i: AdminOrder['items'][number]) => i.addons.reduce((s, a) => s + a.price, 0)
</script>

<template>
  <v-dialog v-model="open" max-width="640" scrollable>
    <v-card v-if="order">
      <v-card-item>
        <v-card-title class="d-flex align-center ga-2">
          Pedido #{{ order.number }}
          <v-chip size="small" :color="statusColor[order.status]" variant="flat">{{ statusLabel[order.status] }}</v-chip>
        </v-card-title>
        <v-card-subtitle>{{ time(order.createdAt) }}</v-card-subtitle>
        <template #append><v-btn icon="mdi-close" variant="text" @click="open = false" /></template>
      </v-card-item>

      <v-card-text>
        <v-alert v-if="order.scheduledFor" type="info" variant="tonal" density="compact" class="mb-3" icon="mdi-calendar">
          Encomenda para <strong>{{ time(order.scheduledFor) }}</strong>
        </v-alert>

        <div class="d-flex flex-wrap ga-4 mb-4">
          <div>
            <div class="text-caption text-medium-emphasis">Cliente</div>
            <div class="font-weight-medium">{{ order.customerName }}</div>
            <div class="text-body-2">{{ order.customerPhone }}</div>
          </div>
          <div>
            <div class="text-caption text-medium-emphasis">{{ order.fulfillment === 'DELIVERY' ? 'Entrega' : 'Retirada' }}</div>
            <div v-if="order.address" class="text-body-2">
              {{ order.address.street }}, {{ order.address.number }}
              <template v-if="order.address.complement"> — {{ order.address.complement }}</template><br />
              {{ order.address.neighborhood }}
              <template v-if="order.address.reference"><br />Ref.: {{ order.address.reference }}</template>
            </div>
            <div v-else class="text-body-2">Cliente retira na loja</div>
          </div>
        </div>

        <v-table density="compact">
          <tbody>
            <tr v-for="i in order.items" :key="i.id">
              <td class="py-2">
                <strong>{{ i.quantity }}x</strong> {{ i.name }}
                <div v-if="i.addons.length" class="text-caption">+ {{ i.addons.map((a) => a.name).join(', ') }}</div>
                <div v-if="i.notes" class="text-caption text-warning font-weight-bold">Obs.: {{ i.notes }}</div>
              </td>
              <td class="text-right">{{ brl((i.unitPrice + addonsTotal(i)) * i.quantity) }}</td>
            </tr>
            <tr v-if="order.deliveryFee">
              <td>Entrega</td>
              <td class="text-right">{{ brl(order.deliveryFee) }}</td>
            </tr>
            <tr class="font-weight-bold">
              <td>Total</td>
              <td class="text-right">{{ brl(order.total) }}</td>
            </tr>
          </tbody>
        </v-table>

        <v-alert v-if="order.notes" type="warning" variant="tonal" density="compact" class="mt-3" icon="mdi-note-text-outline">
          {{ order.notes }}
        </v-alert>

        <div class="d-flex align-center flex-wrap ga-2 mt-4">
          <v-chip prepend-icon="mdi-wallet-outline" variant="tonal">{{ paymentLabel[order.paymentMethod] }}</v-chip>
          <v-chip :color="order.paymentStatus === 'PAID' ? 'success' : 'warning'" variant="flat" size="small">
            {{ paymentStatusLabel[order.paymentStatus] }}
          </v-chip>
          <span v-if="order.changeFor" class="text-body-2">Troco para {{ brl(order.changeFor) }} ({{ brl(order.changeFor - order.total) }})</span>
          <v-spacer />
          <v-btn
            v-if="order.paymentStatus !== 'PAID' && order.status !== 'CANCELED'"
            size="small"
            color="success"
            variant="tonal"
            prepend-icon="mdi-check"
            :loading="busy"
            @click="setPayment('PAID')"
          >
            Marcar como pago
          </v-btn>
          <v-btn v-else-if="order.paymentStatus === 'PAID'" size="small" variant="text" :loading="busy" @click="setPayment('PENDING')">
            Desfazer pago
          </v-btn>
        </div>
      </v-card-text>

      <v-card-actions class="flex-wrap ga-2 pa-4">
        <v-btn :href="waLink(order)" target="_blank" rel="noopener" prepend-icon="mdi-whatsapp" color="#25D366" variant="tonal">
          Avisar cliente
        </v-btn>
        <v-spacer />
        <v-btn
          v-for="s in order.nextStatuses"
          :key="s"
          :color="s === 'CANCELED' ? 'error' : 'primary'"
          :variant="s === 'CANCELED' ? 'text' : 'flat'"
          :loading="busy"
          @click="move(s)"
        >
          {{ actionLabel[s] }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
