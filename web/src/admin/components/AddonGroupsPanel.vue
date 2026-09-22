<script setup lang="ts">
import { ref } from 'vue'
import { api } from '@/lib/api'
import { brl } from '@/lib/format'
import { notify, notifyError } from '@/lib/notify'
import type { Addon, AddonGroup } from '@/lib/types'

defineProps<{ groups: AddonGroup[] }>()
const emit = defineEmits<{ changed: [] }>()

const dialog = ref(false)
const editingId = ref<string | null>(null)
const form = ref({ name: '', minSelect: 0, maxSelect: 1, addons: [] as Addon[] })
const saving = ref(false)

function openDialog(group?: AddonGroup) {
  editingId.value = group?.id ?? null
  form.value = group
    ? { name: group.name, minSelect: group.minSelect, maxSelect: group.maxSelect, addons: group.addons.map((a) => ({ ...a })) }
    : { name: '', minSelect: 0, maxSelect: 1, addons: [{ name: '', price: 0, available: true }] }
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    const body = { ...form.value, addons: form.value.addons.map(({ name, price, available }) => ({ name, price, available })) }
    if (editingId.value) await api.put(`/admin/addon-groups/${editingId.value}`, body)
    else await api.post('/admin/addon-groups', body)
    notify('Grupo salvo')
    dialog.value = false
    emit('changed')
  } catch (e) {
    notifyError(e)
  } finally {
    saving.value = false
  }
}

async function remove(group: AddonGroup) {
  if (!confirm(`Excluir o grupo "${group.name}"? Ele sai de todos os produtos.`)) return
  try {
    await api.del(`/admin/addon-groups/${group.id}`)
    emit('changed')
  } catch (e) {
    notifyError(e)
  }
}
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <p class="text-medium-emphasis">Grupos como "Coberturas" ou "Velas", que você liga aos produtos.</p>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openDialog()">Novo grupo</v-btn>
    </div>

    <v-alert v-if="groups.length === 0" type="info" variant="tonal">Nenhum grupo de adicionais ainda.</v-alert>

    <v-row>
      <v-col v-for="g in groups" :key="g.id" cols="12" md="6">
        <v-card variant="outlined">
          <v-card-item>
            <v-card-title>{{ g.name }}</v-card-title>
            <v-card-subtitle>Escolher de {{ g.minSelect }} a {{ g.maxSelect }}</v-card-subtitle>
            <template #append>
              <v-btn icon="mdi-pencil-outline" variant="text" size="small" @click="openDialog(g)" />
              <v-btn icon="mdi-delete-outline" variant="text" size="small" @click="remove(g)" />
            </template>
          </v-card-item>
          <v-list density="compact">
            <v-list-item v-for="a in g.addons" :key="a.id" :title="a.name" :class="{ 'text-disabled': !a.available }">
              <template #append>{{ a.price ? `+ ${brl(a.price)}` : 'grátis' }}</template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="dialog" max-width="600" scrollable>
      <v-card :title="editingId ? 'Editar grupo' : 'Novo grupo de adicionais'">
        <v-card-text>
          <v-form id="addon-form" @submit.prevent="save">
            <v-text-field v-model="form.name" label="Nome do grupo" placeholder="Ex.: Coberturas" />
            <v-row dense>
              <v-col cols="6">
                <v-text-field v-model.number="form.minSelect" label="Mínimo" type="number" min="0" hint="0 = opcional" persistent-hint />
              </v-col>
              <v-col cols="6">
                <v-text-field v-model.number="form.maxSelect" label="Máximo" type="number" min="1" />
              </v-col>
            </v-row>
            <div class="text-subtitle-2 mt-4 mb-2">Opções</div>
            <v-row v-for="(a, i) in form.addons" :key="i" dense align="center">
              <v-col cols="12" sm="6"><v-text-field v-model="a.name" label="Nome" hide-details /></v-col>
              <v-col cols="6" sm="3">
                <v-text-field v-model.number="a.price" label="Preço" prefix="R$" type="number" step="0.01" hide-details />
              </v-col>
              <v-col cols="4" sm="2"><v-switch v-model="a.available" color="primary" density="compact" inset hide-details /></v-col>
              <v-col cols="2" sm="1">
                <v-btn icon="mdi-delete-outline" variant="text" size="small" @click="form.addons.splice(i, 1)" />
              </v-col>
            </v-row>
            <v-btn
              class="mt-2"
              variant="tonal"
              size="small"
              prepend-icon="mdi-plus"
              @click="form.addons.push({ name: '', price: 0, available: true })"
            >
              Opção
            </v-btn>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" type="submit" form="addon-form" :loading="saving">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
