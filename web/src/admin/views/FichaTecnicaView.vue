<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { brl, pct } from '@/lib/format'
import { notify, notifyError } from '@/lib/notify'
import type { Product, Recipe, StockItem } from '@/lib/types'
import RecipeDialog from '../components/RecipeDialog.vue'

const recipes = ref<Recipe[]>([])
const products = ref<Product[]>([])
const stock = ref<StockItem[]>([])
const loading = ref(true)

const dialog = ref(false)
const editing = ref<Recipe | null>(null)

async function load() {
  loading.value = true
  try {
    const [r, p, s] = await Promise.all([
      api.get<Recipe[]>('/admin/recipes'),
      api.get<Product[]>('/admin/products'),
      api.get<StockItem[]>('/admin/stock'),
    ])
    recipes.value = r
    products.value = p
    stock.value = s
  } catch (e) {
    notifyError(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const belowTarget = computed(() => recipes.value.filter((r) => r.cost.belowTarget))

const headers = [
  { title: 'Produto', key: 'label' },
  { title: 'Rende', key: 'yieldQuantity', align: 'end' as const },
  { title: 'Custo/un', key: 'cost.unitCost', align: 'end' as const },
  { title: 'Sugerido', key: 'cost.suggestedUnitPrice', align: 'end' as const },
  { title: 'Preço atual', key: 'cost.salePrice', align: 'end' as const },
  { title: 'Margem real / meta', key: 'cost.actualMargin', align: 'end' as const },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
]

function openDialog(r?: Recipe) {
  editing.value = r ?? null
  dialog.value = true
}

async function applyPrice(r: Recipe) {
  if (!confirm(`Mudar o preço de "${r.label}" no cardápio para ${brl(r.cost.suggestedUnitPrice)}?`)) return
  try {
    await api.post(`/admin/recipes/${r.id}/apply-price`)
    notify('Preço atualizado no cardápio')
    load()
  } catch (e) {
    notifyError(e)
  }
}

async function remove(r: Recipe) {
  if (!confirm(`Excluir a ficha técnica de "${r.label}"?`)) return
  try {
    await api.del(`/admin/recipes/${r.id}`)
    load()
  } catch (e) {
    notifyError(e)
  }
}
</script>

<template>
  <div class="d-flex align-center flex-wrap ga-2 mb-4">
    <div>
      <h1 class="text-h5">Ficha técnica e precificação</h1>
      <p class="text-body-2 text-medium-emphasis">O custo vem do estoque e se atualiza sozinho quando o preço de um ingrediente muda.</p>
    </div>
    <v-spacer />
    <v-btn color="primary" prepend-icon="mdi-plus" @click="openDialog()">Nova ficha técnica</v-btn>
  </div>

  <v-alert
    v-if="belowTarget.length"
    type="error"
    variant="tonal"
    class="mb-4"
    :title="`${belowTarget.length} ${belowTarget.length === 1 ? 'produto está' : 'produtos estão'} abaixo da margem desejada`"
  >
    {{ belowTarget.map((r) => r.label).join(', ') }}. Use "Aplicar preço sugerido" ou revise a receita.
  </v-alert>

  <v-alert v-if="!loading && !stock.length" type="info" variant="tonal" class="mb-4">
    Cadastre os ingredientes no <router-link to="/admin/estoque">Estoque</router-link> antes de montar as fichas técnicas.
  </v-alert>

  <v-card>
    <v-data-table
      :headers="headers"
      :items="recipes"
      :loading="loading"
      items-per-page="50"
      no-data-text="Nenhuma ficha técnica ainda"
      loading-text="Carregando…"
    >
      <template #[`item.label`]="{ item }">
        <span class="font-weight-medium">{{ item.label }}</span>
      </template>
      <template #[`item.yieldQuantity`]="{ item }">{{ item.yieldQuantity }} un</template>
      <template #[`item.cost.unitCost`]="{ item }">{{ brl(item.cost.unitCost) }}</template>
      <template #[`item.cost.suggestedUnitPrice`]="{ item }">
        <strong>{{ brl(item.cost.suggestedUnitPrice) }}</strong>
      </template>
      <template #[`item.cost.salePrice`]="{ item }">{{ brl(item.cost.salePrice) }}</template>
      <template #[`item.cost.actualMargin`]="{ item }">
        <v-chip size="small" variant="tonal" :color="item.cost.belowTarget ? 'error' : 'success'">
          {{ pct(item.cost.actualMargin) }} / {{ pct(item.targetMargin) }}
        </v-chip>
      </template>
      <template #[`item.actions`]="{ item }">
        <div class="d-flex justify-end ga-1">
          <v-btn
            v-if="item.cost.belowTarget && item.cost.suggestedUnitPrice"
            size="small"
            variant="tonal"
            color="primary"
            @click="applyPrice(item)"
          >
            Aplicar preço sugerido
          </v-btn>
          <v-btn icon="mdi-pencil-outline" variant="text" size="small" @click="openDialog(item)" />
          <v-btn icon="mdi-delete-outline" variant="text" size="small" @click="remove(item)" />
        </div>
      </template>
    </v-data-table>
  </v-card>

  <RecipeDialog v-model="dialog" :recipe="editing" :products="products" :recipes="recipes" :stock="stock" @saved="load" />
</template>
