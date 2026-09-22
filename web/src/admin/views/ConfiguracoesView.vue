<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { notify, notifyError } from '@/lib/notify'

interface Settings {
  name: string
  whatsappPhone: string | null
  pixEnabled: boolean
  pixKeyType: string | null
  pixKey: string | null
  pixReceiverName: string | null
  pixCity: string | null
  creditEnabled: boolean
  debitEnabled: boolean
  mpPublicKey: string | null
  stockControlEnabled: boolean
  mercadoPagoConfigured: boolean
}

const s = ref<Settings | null>(null)
const saving = ref(false)

const pixKeyTypes = [
  { title: 'CPF', value: 'CPF' },
  { title: 'CNPJ', value: 'CNPJ' },
  { title: 'E-mail', value: 'EMAIL' },
  { title: 'Celular', value: 'PHONE' },
  { title: 'Chave aleatória', value: 'RANDOM' },
]

onMounted(async () => {
  try {
    s.value = await api.get<Settings>('/admin/settings')
  } catch (e) {
    notifyError(e)
  }
})

async function save() {
  if (!s.value) return
  saving.value = true
  const { mercadoPagoConfigured: _, ...body } = s.value
  const blank = (v: string | null) => (v?.trim() ? v.trim() : null)
  try {
    await api.put('/admin/settings', {
      ...body,
      whatsappPhone: blank(body.whatsappPhone),
      pixKey: blank(body.pixKey),
      pixReceiverName: blank(body.pixReceiverName),
      pixCity: blank(body.pixCity),
      mpPublicKey: blank(body.mpPublicKey),
    })
    notify('Configurações salvas. A loja já mostra as mudanças.')
  } catch (e) {
    notifyError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="d-flex align-center mb-4">
    <h1 class="text-h5">Configurações</h1>
    <v-spacer />
    <v-btn color="primary" :loading="saving" :disabled="!s" @click="save">Salvar</v-btn>
  </div>

  <v-alert type="info" variant="tonal" class="mb-4">
    Horários, entrega, checkout, encomendas, cupons e aparência entram nas próximas etapas.
  </v-alert>

  <template v-if="s">
    <v-card class="mb-4" title="Loja">
      <v-card-text>
        <v-row dense>
          <v-col cols="12" md="6"><v-text-field v-model="s.name" label="Nome da confeitaria" /></v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="s.whatsappPhone"
              label="WhatsApp da loja"
              placeholder="5516999999999"
              hint="Só números: 55 + DDD + número"
              persistent-hint
            />
          </v-col>
        </v-row>
        <v-switch
          v-model="s.stockControlEnabled"
          color="primary"
          inset
          label="Controle de estoque no cardápio"
          hint="Ligado: produto sem ingrediente suficiente fica indisponível sozinho"
          persistent-hint
        />
      </v-card-text>
    </v-card>

    <v-card class="mb-4">
      <v-card-item prepend-icon="mdi-qrcode" title="Pix" subtitle="O cliente paga direto na chave Pix da loja" />
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
      </v-card-text>
    </v-card>

    <v-card>
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
        <v-alert
          class="mt-4"
          density="compact"
          variant="tonal"
          :type="s.mercadoPagoConfigured ? 'success' : 'warning'"
        >
          <template v-if="s.mercadoPagoConfigured">Access token do Mercado Pago configurado no servidor.</template>
          <template v-else>
            Falta o access token do Mercado Pago no servidor (variável MP_ACCESS_TOKEN). Por segurança ele não é digitado aqui.
            Enquanto faltar, cartão não aparece para o cliente.
          </template>
        </v-alert>
      </v-card-text>
    </v-card>
  </template>
</template>
