<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { brl } from '@/lib/format'
import { notify, notifyError } from '@/lib/notify'
import { defaultMessages, statusLabel, type OrderStatus } from '@/lib/orders'

interface OpeningHour {
  day: number
  open: string
  close: string
}

interface Settings {
  name: string
  description: string | null
  logoUrl: string | null
  coverUrl: string | null
  primaryColor: string
  whatsappPhone: string | null
  isOpen: boolean
  pausedUntil: string | null
  openingHours: OpeningHour[]
  checkoutEnabled: boolean
  orderTrackingEnabled: boolean
  whatsappNotifications: boolean
  whatsappMessages: Partial<Record<OrderStatus, string>>
  stockControlEnabled: boolean
  pickupEnabled: boolean
  pickupAddress: string | null
  deliveryEnabled: boolean
  minimumOrderValue: number | null
  preOrdersEnabled: boolean
  preOrderMinHours: number
  preOrderDailyLimit: number | null
  pixEnabled: boolean
  pixKeyType: string | null
  pixKey: string | null
  pixReceiverName: string | null
  pixCity: string | null
  creditEnabled: boolean
  debitEnabled: boolean
  mpPublicKey: string | null
  cashEnabled: boolean
  mercadoPagoConfigured: boolean
}

interface Zone {
  id: string
  neighborhood: string
  fee: number
  active: boolean
}

const tab = ref('funcionamento')
const s = ref<Settings | null>(null)
const zones = ref<Zone[]>([])
const saving = ref(false)

// Horários: uma faixa por dia
const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const week = ref(DAYS.map((_, day) => ({ day, enabled: false, open: '09:00', close: '18:00' })))

const pixKeyTypes = [
  { title: 'CPF', value: 'CPF' },
  { title: 'CNPJ', value: 'CNPJ' },
  { title: 'E-mail', value: 'EMAIL' },
  { title: 'Celular', value: 'PHONE' },
  { title: 'Chave aleatória', value: 'RANDOM' },
]

const messageStatuses: OrderStatus[] = ['RECEIVED', 'PREPARING', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELED']

async function load() {
  try {
    const [settings, z] = await Promise.all([api.get<Settings>('/admin/settings'), api.get<Zone[]>('/admin/delivery-zones')])
    s.value = settings
    zones.value = z
    week.value = DAYS.map((_, day) => {
      const h = settings.openingHours.find((x) => x.day === day)
      return { day, enabled: Boolean(h), open: h?.open ?? '09:00', close: h?.close ?? '18:00' }
    })
    for (const st of messageStatuses) settings.whatsappMessages[st] ||= defaultMessages[st]
  } catch (e) {
    notifyError(e)
  }
}
onMounted(load)

const blank = (v: string | null) => (v?.trim() ? v.trim() : null)
const numOrNull = (v: number | string | null) => (v === '' || v == null ? null : Number(v))

async function save() {
  if (!s.value) return
  const bad = week.value.find((d) => d.enabled && d.open >= d.close)
  if (bad) {
    notify(`${DAYS[bad.day]}: o horário de fechar precisa ser depois do de abrir`, 'error')
    tab.value = 'funcionamento'
    return
  }
  saving.value = true
  const v = s.value
  try {
    await api.put('/admin/settings', {
      name: v.name,
      description: blank(v.description),
      primaryColor: v.primaryColor,
      whatsappPhone: blank(v.whatsappPhone)?.replace(/\D/g, '') || null,
      isOpen: v.isOpen,
      openingHours: week.value.filter((d) => d.enabled).map(({ day, open, close }) => ({ day, open, close })),
      checkoutEnabled: v.checkoutEnabled,
      orderTrackingEnabled: v.orderTrackingEnabled,
      whatsappNotifications: v.whatsappNotifications,
      whatsappMessages: v.whatsappMessages,
      stockControlEnabled: v.stockControlEnabled,
      pickupEnabled: v.pickupEnabled,
      pickupAddress: blank(v.pickupAddress),
      deliveryEnabled: v.deliveryEnabled,
      minimumOrderValue: numOrNull(v.minimumOrderValue),
      preOrdersEnabled: v.preOrdersEnabled,
      preOrderMinHours: Number(v.preOrderMinHours) || 0,
      preOrderDailyLimit: numOrNull(v.preOrderDailyLimit),
      pixEnabled: v.pixEnabled,
      pixKeyType: v.pixKeyType,
      pixKey: blank(v.pixKey),
      pixReceiverName: blank(v.pixReceiverName),
      pixCity: blank(v.pixCity),
      creditEnabled: v.creditEnabled,
      debitEnabled: v.debitEnabled,
      mpPublicKey: blank(v.mpPublicKey),
      cashEnabled: v.cashEnabled,
    })
    notify('Configurações salvas. A loja já mostra as mudanças.')
  } catch (e) {
    notifyError(e)
  } finally {
    saving.value = false
  }
}

// ─── Pausa rápida (salva na hora) ───────────────────────────────────────────
const paused = computed(() => s.value?.pausedUntil && new Date(s.value.pausedUntil) > new Date())
async function pause(minutes: number | null) {
  const pausedUntil = minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : null
  try {
    await api.put('/admin/settings', { pausedUntil })
    s.value!.pausedUntil = pausedUntil
    notify(minutes ? `Loja pausada por ${minutes} min` : 'Loja recebendo pedidos de novo')
  } catch (e) {
    notifyError(e)
  }
}

// ─── Bairros de entrega (salvam na hora) ────────────────────────────────────
const zoneForm = ref({ neighborhood: '', fee: 0 })
async function addZone() {
  try {
    await api.post('/admin/delivery-zones', zoneForm.value)
    zoneForm.value = { neighborhood: '', fee: 0 }
    zones.value = await api.get<Zone[]>('/admin/delivery-zones')
  } catch (e) {
    notifyError(e)
  }
}
async function updateZone(z: Zone) {
  try {
    await api.put(`/admin/delivery-zones/${z.id}`, { neighborhood: z.neighborhood, fee: z.fee, active: z.active })
  } catch (e) {
    notifyError(e)
  }
}
async function removeZone(z: Zone) {
  if (!confirm(`Remover o bairro ${z.neighborhood}?`)) return
  try {
    await api.del(`/admin/delivery-zones/${z.id}`)
    zones.value = zones.value.filter((x) => x.id !== z.id)
  } catch (e) {
    notifyError(e)
  }
}

// ─── Logo e capa (salvam na hora) ───────────────────────────────────────────
async function upload(field: 'logo' | 'cover', files: File | File[] | null) {
  const file = Array.isArray(files) ? files[0] : files
  if (!file) return
  const data = new FormData()
  data.append('file', file)
  try {
    const res = await api.post<Settings>(`/admin/settings/image/${field}`, data)
    s.value!.logoUrl = res.logoUrl
    s.value!.coverUrl = res.coverUrl
    notify(field === 'logo' ? 'Logo atualizado' : 'Capa atualizada')
  } catch (e) {
    notifyError(e)
  }
}
</script>

<template>
  <div class="d-flex align-center mb-4">
    <h1 class="text-h5">Configurações</h1>
    <v-spacer />
    <v-btn color="primary" :loading="saving" :disabled="!s" prepend-icon="mdi-content-save" @click="save">Salvar</v-btn>
  </div>

  <template v-if="s">
    <v-tabs v-model="tab" color="primary" show-arrows class="mb-4">
      <v-tab value="funcionamento">Funcionamento</v-tab>
      <v-tab value="pedidos">Pedidos</v-tab>
      <v-tab value="entrega">Retirada e entrega</v-tab>
      <v-tab value="pagamentos">Pagamentos</v-tab>
      <v-tab value="aparencia">Aparência</v-tab>
      <v-tab value="whatsapp">WhatsApp</v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <!-- Funcionamento -->
      <v-window-item value="funcionamento">
        <v-card class="mb-4">
          <v-card-text>
            <v-switch
              v-model="s.isOpen"
              color="success"
              inset
              :label="s.isOpen ? 'Loja aberta' : 'Loja fechada'"
              hint="Desligado: a loja fica fechada, mesmo dentro do horário"
              persistent-hint
            />
            <v-divider class="my-4" />
            <div class="text-subtitle-2 mb-2">Pausa temporária</div>
            <p class="text-body-2 text-medium-emphasis mb-3">Para de receber pedidos por um tempo, sem mexer nos horários.</p>
            <v-alert v-if="paused" type="warning" variant="tonal" density="compact" class="mb-3">
              Pausada até {{ new Date(s.pausedUntil!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}
            </v-alert>
            <div class="d-flex flex-wrap ga-2">
              <v-btn v-for="m in [15, 30, 60]" :key="m" variant="tonal" prepend-icon="mdi-pause" @click="pause(m)">
                {{ m < 60 ? `${m} min` : '1 hora' }}
              </v-btn>
              <v-btn v-if="paused" color="success" variant="flat" prepend-icon="mdi-play" @click="pause(null)">Retomar agora</v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-card title="Horários de funcionamento" subtitle="Sem nenhum dia marcado, vale só a chave Loja aberta/fechada">
          <v-card-text>
            <v-row v-for="d in week" :key="d.day" dense align="center">
              <v-col cols="12" sm="4">
                <v-switch v-model="d.enabled" :label="DAYS[d.day]" color="primary" inset hide-details density="compact" />
              </v-col>
              <v-col cols="6" sm="4">
                <v-text-field v-model="d.open" type="time" label="Abre" :disabled="!d.enabled" hide-details density="compact" />
              </v-col>
              <v-col cols="6" sm="4">
                <v-text-field v-model="d.close" type="time" label="Fecha" :disabled="!d.enabled" hide-details density="compact" />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-window-item>

      <!-- Pedidos -->
      <v-window-item value="pedidos">
        <v-card>
          <v-card-text>
            <v-switch
              v-model="s.checkoutEnabled"
              color="primary"
              inset
              label="Checkout online"
              hint="Desligado: o cardápio vira vitrine e o pedido segue pelo WhatsApp com a sacola já escrita"
              persistent-hint
            />
            <v-switch
              v-model="s.orderTrackingEnabled"
              class="mt-4"
              color="primary"
              inset
              label="Acompanhamento do pedido"
              hint="Desligado: o cliente recebe só a confirmação, sem a tela de status"
              persistent-hint
            />
            <v-switch
              v-model="s.stockControlEnabled"
              class="mt-4"
              color="primary"
              inset
              label="Controle de estoque no cardápio"
              hint="Ligado: produto sem ingrediente suficiente fica indisponível sozinho"
              persistent-hint
            />
            <v-text-field
              v-model.number="s.minimumOrderValue"
              class="mt-6"
              label="Pedido mínimo"
              prefix="R$"
              type="number"
              min="0"
              step="0.01"
              hint="Deixe vazio para não ter mínimo"
              persistent-hint
              style="max-width: 280px"
            />
            <v-divider class="my-6" />
            <v-switch
              v-model="s.preOrdersEnabled"
              color="primary"
              inset
              label="Encomendas"
              hint="O cliente escolhe data e horário futuros (também funciona com a loja fechada)"
              persistent-hint
            />
            <v-row v-if="s.preOrdersEnabled" class="mt-2">
              <v-col cols="12" sm="6">
                <v-text-field v-model.number="s.preOrderMinHours" label="Antecedência mínima" suffix="horas" type="number" min="0" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model.number="s.preOrderDailyLimit"
                  label="Limite de encomendas por dia"
                  type="number"
                  min="1"
                  hint="Vazio = sem limite"
                  persistent-hint
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
        <v-alert type="info" variant="tonal" class="mt-4">Cupons e avaliações entram na próxima etapa.</v-alert>
      </v-window-item>

      <!-- Retirada e entrega -->
      <v-window-item value="entrega">
        <v-card class="mb-4">
          <v-card-text>
            <v-switch v-model="s.pickupEnabled" color="primary" inset label="Retirada no local" hide-details />
            <v-text-field
              v-if="s.pickupEnabled"
              v-model="s.pickupAddress"
              class="mt-4"
              label="Endereço de retirada"
              placeholder="Rua, número, bairro"
            />
          </v-card-text>
        </v-card>

        <v-card>
          <v-card-text>
            <v-switch v-model="s.deliveryEnabled" color="primary" inset label="Entrega" hide-details />
            <template v-if="s.deliveryEnabled">
              <p class="text-body-2 text-medium-emphasis my-3">
                Taxa por bairro. O cliente só consegue pedir entrega para os bairros ativos abaixo. (Taxa por km fica para uma
                próxima etapa, porque precisa de um serviço de mapas.)
              </p>
              <v-alert v-if="!zones.length" type="warning" variant="tonal" density="compact" class="mb-3">
                Cadastre pelo menos um bairro para a entrega aparecer para o cliente.
              </v-alert>
              <v-row v-for="z in zones" :key="z.id" dense align="center">
                <v-col cols="12" sm="5">
                  <v-text-field v-model="z.neighborhood" density="compact" hide-details @change="updateZone(z)" />
                </v-col>
                <v-col cols="6" sm="3">
                  <v-text-field
                    v-model.number="z.fee"
                    density="compact"
                    prefix="R$"
                    type="number"
                    step="0.50"
                    hide-details
                    @change="updateZone(z)"
                  />
                </v-col>
                <v-col cols="4" sm="3">
                  <v-switch
                    v-model="z.active"
                    color="primary"
                    density="compact"
                    inset
                    hide-details
                    :label="z.active ? 'Ativo' : 'Pausado'"
                    @update:model-value="updateZone(z)"
                  />
                </v-col>
                <v-col cols="2" sm="1"><v-btn icon="mdi-delete-outline" variant="text" size="small" @click="removeZone(z)" /></v-col>
              </v-row>
              <v-form class="mt-2" @submit.prevent="addZone">
                <v-row dense align="center">
                  <v-col cols="12" sm="5">
                    <v-text-field v-model="zoneForm.neighborhood" label="Novo bairro" density="compact" hide-details />
                  </v-col>
                  <v-col cols="8" sm="3">
                    <v-text-field v-model.number="zoneForm.fee" label="Taxa" prefix="R$" type="number" step="0.50" density="compact" hide-details />
                  </v-col>
                  <v-col cols="4" sm="4">
                    <v-btn type="submit" variant="tonal" prepend-icon="mdi-plus" :disabled="!zoneForm.neighborhood.trim()">Bairro</v-btn>
                  </v-col>
                </v-row>
              </v-form>
              <p class="text-caption text-medium-emphasis mt-2">
                Bairros e taxas são salvos na hora. {{ zones.filter((z) => z.active).length }} ativos · menor taxa
                {{ zones.length ? brl(Math.min(...zones.map((z) => z.fee))) : '—' }}
              </p>
            </template>
          </v-card-text>
        </v-card>
      </v-window-item>

      <!-- Pagamentos -->
      <v-window-item value="pagamentos">
        <v-card class="mb-4">
          <v-card-item prepend-icon="mdi-qrcode" title="Pix" subtitle="O cliente recebe o QR Code com o valor e paga direto na chave da loja" />
          <v-card-text>
            <v-switch v-model="s.pixEnabled" color="primary" inset label="Aceitar Pix" hide-details class="mb-2" />
            <v-row v-if="s.pixEnabled" dense>
              <v-col cols="12" md="4"><v-select v-model="s.pixKeyType" :items="pixKeyTypes" label="Tipo de chave" /></v-col>
              <v-col cols="12" md="8"><v-text-field v-model="s.pixKey" label="Chave Pix" /></v-col>
              <v-col cols="12" md="8">
                <v-text-field v-model="s.pixReceiverName" label="Nome do recebedor" counter="25" maxlength="25" />
              </v-col>
              <v-col cols="12" md="4"><v-text-field v-model="s.pixCity" label="Cidade" counter="15" maxlength="15" /></v-col>
            </v-row>
            <v-alert v-if="s.pixEnabled && !s.pixKey" type="warning" variant="tonal" density="compact">
              Sem chave cadastrada, o Pix não aparece para o cliente.
            </v-alert>
            <p v-if="s.pixEnabled" class="text-caption text-medium-emphasis mt-2">
              O Pix cai direto na sua conta. Confira o recebimento no app do banco e marque o pedido como pago.
            </p>
          </v-card-text>
        </v-card>

        <v-card class="mb-4">
          <v-card-item prepend-icon="mdi-credit-card-outline" title="Cartão de crédito e débito" subtitle="Pelo Mercado Pago" />
          <v-card-text>
            <v-row dense>
              <v-col cols="12" sm="6"><v-switch v-model="s.creditEnabled" color="primary" inset label="Crédito" hide-details /></v-col>
              <v-col cols="12" sm="6"><v-switch v-model="s.debitEnabled" color="primary" inset label="Débito" hide-details /></v-col>
            </v-row>
            <v-text-field
              v-model="s.mpPublicKey"
              class="mt-4"
              label="Public key do Mercado Pago"
              placeholder="APP_USR-..."
              hint="Mercado Pago → Suas integrações → Credenciais de produção"
              persistent-hint
            />
            <v-alert class="mt-4" density="compact" variant="tonal" :type="s.mercadoPagoConfigured ? 'success' : 'warning'">
              <template v-if="s.mercadoPagoConfigured">Access token do Mercado Pago configurado no servidor.</template>
              <template v-else>
                Falta o access token do Mercado Pago no servidor (variável MP_ACCESS_TOKEN). Por segurança ele não é digitado aqui.
                Enquanto faltar, cartão não aparece para o cliente.
              </template>
            </v-alert>
          </v-card-text>
        </v-card>

        <v-card>
          <v-card-item prepend-icon="mdi-cash" title="Dinheiro na entrega" />
          <v-card-text>
            <v-switch v-model="s.cashEnabled" color="primary" inset label="Aceitar dinheiro (com troco)" hide-details />
          </v-card-text>
        </v-card>
      </v-window-item>

      <!-- Aparência -->
      <v-window-item value="aparencia">
        <v-card>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6"><v-text-field v-model="s.name" label="Nome da confeitaria" /></v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="s.primaryColor" label="Cor principal" placeholder="#E85D75">
                  <template #append-inner>
                    <input v-model="s.primaryColor" type="color" class="color-input" aria-label="Escolher cor" />
                  </template>
                </v-text-field>
              </v-col>
              <v-col cols="12">
                <v-textarea v-model="s.description" label="Descrição curta" rows="2" auto-grow counter="160" maxlength="160" />
              </v-col>
              <v-col cols="12" md="6">
                <div class="text-subtitle-2 mb-2">Logo</div>
                <div class="d-flex align-center ga-3">
                  <v-avatar size="72" color="grey-lighten-3">
                    <v-img v-if="s.logoUrl" :src="s.logoUrl" cover />
                    <v-icon v-else icon="mdi-image-outline" />
                  </v-avatar>
                  <v-file-input
                    label="Trocar logo"
                    accept="image/jpeg,image/png,image/webp"
                    prepend-icon=""
                    hide-details
                    @update:model-value="upload('logo', $event)"
                  />
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="text-subtitle-2 mb-2">Capa</div>
                <div class="d-flex align-center ga-3">
                  <v-img
                    :src="s.coverUrl ?? undefined"
                    width="120"
                    height="72"
                    cover
                    class="rounded bg-grey-lighten-3 flex-grow-0"
                  />
                  <v-file-input
                    label="Trocar capa"
                    accept="image/jpeg,image/png,image/webp"
                    prepend-icon=""
                    hide-details
                    @update:model-value="upload('cover', $event)"
                  />
                </div>
              </v-col>
            </v-row>
            <p class="text-caption text-medium-emphasis mt-4">Logo e capa são salvos assim que você escolhe a imagem.</p>
          </v-card-text>
        </v-card>
      </v-window-item>

      <!-- WhatsApp -->
      <v-window-item value="whatsapp">
        <v-card class="mb-4">
          <v-card-text>
            <v-text-field
              v-model="s.whatsappPhone"
              label="WhatsApp da loja"
              placeholder="5516999999999"
              hint="Só números: 55 + DDD + número. Recebe os pedidos quando o checkout está desligado."
              persistent-hint
            />
          </v-card-text>
        </v-card>
        <v-card title="Mensagens para o cliente" subtitle="Usadas no botão Avisar cliente de cada pedido">
          <v-card-text>
            <p class="text-body-2 text-medium-emphasis mb-4">
              Use <code>{nome}</code>, <code>{numero}</code> e <code>{loja}</code> para preencher automaticamente. O envio
              totalmente automático precisa de uma API de WhatsApp paga e fica para uma próxima etapa.
            </p>
            <v-textarea
              v-for="st in messageStatuses"
              :key="st"
              v-model="s.whatsappMessages[st]"
              :label="statusLabel[st]"
              rows="2"
              auto-grow
            />
          </v-card-text>
        </v-card>
      </v-window-item>
    </v-window>
  </template>
</template>

<style scoped>
.color-input {
  width: 32px;
  height: 32px;
  border: 0;
  padding: 0;
  background: none;
  cursor: pointer;
}
</style>
