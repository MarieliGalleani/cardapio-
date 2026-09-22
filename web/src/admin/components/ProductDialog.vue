<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api } from '@/lib/api'
import { notify, notifyError } from '@/lib/notify'
import type { AddonGroup, Category, Product, Variation } from '@/lib/types'

const props = defineProps<{ product: Product | null; categories: Category[]; addonGroups: AddonGroup[] }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [] }>()

const empty = () => ({
  categoryId: props.categories[0]?.id ?? '',
  name: '',
  description: '',
  price: 0 as number,
  promoPrice: null as number | null,
  available: true,
  variations: [] as Variation[],
  addonGroupIds: [] as string[],
})

const form = ref(empty())
const image = ref<File | File[] | null>(null)
const saving = ref(false)
const isEdit = computed(() => Boolean(props.product))

watch(open, (isOpen) => {
  if (!isOpen) return
  image.value = null
  const p = props.product
  form.value = p
    ? {
        categoryId: p.categoryId,
        name: p.name,
        description: p.description ?? '',
        price: p.price,
        promoPrice: p.promoPrice,
        available: p.available,
        variations: p.variations.map((v) => ({ id: v.id, name: v.name, price: v.price, available: v.available })),
        addonGroupIds: p.addonGroups.map((g) => g.groupId),
      }
    : empty()
})

const required = (v: unknown) => (v !== '' && v != null) || 'Obrigatório'

function addVariation() {
  form.value.variations.push({ name: '', price: form.value.price, available: true })
}

async function save() {
  saving.value = true
  try {
    const body = { ...form.value, promoPrice: form.value.promoPrice || null }
    const saved = isEdit.value
      ? await api.put<Product>(`/admin/products/${props.product!.id}`, body)
      : await api.post<Product>('/admin/products', body)

    const file = Array.isArray(image.value) ? image.value[0] : image.value
    if (file) {
      const data = new FormData()
      data.append('file', file)
      await api.post(`/admin/products/${saved.id}/image`, data)
    }
    notify(isEdit.value ? 'Produto atualizado' : 'Produto criado')
    open.value = false
    emit('saved')
  } catch (e) {
    notifyError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="720" scrollable>
    <v-card :title="isEdit ? 'Editar produto' : 'Novo produto'">
      <v-card-text>
        <v-form id="product-form" @submit.prevent="save">
          <v-row dense>
            <v-col cols="12" sm="8">
              <v-text-field v-model="form.name" label="Nome" :rules="[required]" />
            </v-col>
            <v-col cols="12" sm="4">
              <v-select
                v-model="form.categoryId"
                :items="categories"
                item-title="name"
                item-value="id"
                label="Categoria"
                :rules="[required]"
              />
            </v-col>
            <v-col cols="12">
              <v-textarea v-model="form.description" label="Descrição" rows="2" auto-grow />
            </v-col>
            <v-col cols="6" sm="4">
              <v-text-field v-model.number="form.price" label="Preço" prefix="R$" type="number" step="0.01" min="0" />
            </v-col>
            <v-col cols="6" sm="4">
              <v-text-field
                v-model.number="form.promoPrice"
                label="Preço promocional"
                prefix="R$"
                type="number"
                step="0.01"
                min="0"
                hint="Deixe vazio se não houver"
                persistent-hint
              />
            </v-col>
            <v-col cols="12" sm="4">
              <v-switch v-model="form.available" label="Disponível" color="primary" inset hide-details />
            </v-col>
            <v-col cols="12">
              <v-file-input
                v-model="image"
                label="Foto"
                accept="image/jpeg,image/png,image/webp"
                prepend-icon=""
                prepend-inner-icon="mdi-camera"
                :hint="product?.imageUrl ? 'Já tem foto. Escolha outra para trocar.' : 'JPG, PNG ou WEBP até 5 MB'"
                persistent-hint
              />
            </v-col>
          </v-row>

          <div class="d-flex align-center mt-4 mb-2">
            <div>
              <div class="text-subtitle-1 font-weight-medium">Variações</div>
              <div class="text-caption text-medium-emphasis">Tamanhos ou sabores. O preço da variação substitui o do produto.</div>
            </div>
            <v-spacer />
            <v-btn variant="tonal" size="small" prepend-icon="mdi-plus" @click="addVariation">Variação</v-btn>
          </div>
          <v-row v-for="(v, i) in form.variations" :key="i" dense align="center">
            <v-col cols="12" sm="6">
              <v-text-field v-model="v.name" label="Nome" placeholder="Ex.: Inteiro 1 kg" :rules="[required]" hide-details="auto" />
            </v-col>
            <v-col cols="6" sm="3">
              <v-text-field v-model.number="v.price" label="Preço" prefix="R$" type="number" step="0.01" hide-details />
            </v-col>
            <v-col cols="4" sm="2">
              <v-switch v-model="v.available" color="primary" density="compact" hide-details inset />
            </v-col>
            <v-col cols="2" sm="1">
              <v-btn icon="mdi-delete-outline" variant="text" size="small" @click="form.variations.splice(i, 1)" />
            </v-col>
          </v-row>

          <v-autocomplete
            v-model="form.addonGroupIds"
            class="mt-4"
            :items="addonGroups"
            item-title="name"
            item-value="id"
            label="Grupos de adicionais"
            multiple
            chips
            closable-chips
            hint="Crie os grupos na aba Adicionais"
            persistent-hint
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancelar</v-btn>
        <v-btn color="primary" variant="flat" type="submit" form="product-form" :loading="saving">Salvar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
