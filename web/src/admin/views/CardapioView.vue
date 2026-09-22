<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import draggable from 'vuedraggable'
import { api } from '@/lib/api'
import { brl, pct } from '@/lib/format'
import { notify, notifyError } from '@/lib/notify'
import type { AddonGroup, Category, Product } from '@/lib/types'
import ProductDialog from '../components/ProductDialog.vue'
import AddonGroupsPanel from '../components/AddonGroupsPanel.vue'

const tab = ref('produtos')
const categories = ref<Category[]>([])
const products = ref<Product[]>([])
const addonGroups = ref<AddonGroup[]>([])
const loading = ref(true)

const productDialog = ref(false)
const editingProduct = ref<Product | null>(null)

const categoryDialog = ref(false)
const categoryForm = ref({ id: '', name: '' })

// Produtos agrupados por categoria, na ordem salva. Cada lista é editada pelo arrastar e soltar.
const productsByCategory = ref<Record<string, Product[]>>({})

async function load() {
  loading.value = true
  try {
    const [c, p, g] = await Promise.all([
      api.get<Category[]>('/admin/categories'),
      api.get<Product[]>('/admin/products'),
      api.get<AddonGroup[]>('/admin/addon-groups'),
    ])
    categories.value = c
    products.value = p
    addonGroups.value = g
    productsByCategory.value = Object.fromEntries(c.map((cat) => [cat.id, p.filter((x) => x.categoryId === cat.id)]))
  } catch (e) {
    notifyError(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)

const hasCategories = computed(() => categories.value.length > 0)

async function saveCategoryOrder() {
  try {
    await api.put('/admin/categories/order', { ids: categories.value.map((c) => c.id) })
  } catch (e) {
    notifyError(e)
    load()
  }
}

async function saveProductOrder(categoryId: string) {
  try {
    await api.put('/admin/products/order', { ids: productsByCategory.value[categoryId].map((p) => p.id) })
  } catch (e) {
    notifyError(e)
    load()
  }
}

function openCategory(c?: Category) {
  categoryForm.value = { id: c?.id ?? '', name: c?.name ?? '' }
  categoryDialog.value = true
}

async function saveCategory() {
  try {
    const { id, name } = categoryForm.value
    if (id) await api.put(`/admin/categories/${id}`, { name })
    else await api.post('/admin/categories', { name })
    categoryDialog.value = false
    load()
  } catch (e) {
    notifyError(e)
  }
}

async function toggleCategory(c: Category) {
  try {
    await api.put(`/admin/categories/${c.id}`, { active: !c.active })
    c.active = !c.active
  } catch (e) {
    notifyError(e)
  }
}

async function removeCategory(c: Category) {
  if (productsByCategory.value[c.id]?.length) {
    notify('Mova ou exclua os produtos desta categoria antes', 'warning')
    return
  }
  if (!confirm(`Excluir a categoria "${c.name}"?`)) return
  try {
    await api.del(`/admin/categories/${c.id}`)
    load()
  } catch (e) {
    notifyError(e)
  }
}

function openProduct(p?: Product) {
  editingProduct.value = p ?? null
  productDialog.value = true
}

async function toggleAvailable(p: Product) {
  try {
    await api.patch(`/admin/products/${p.id}/availability`, { available: !p.available })
    p.available = !p.available
  } catch (e) {
    notifyError(e)
  }
}

async function removeProduct(p: Product) {
  if (!confirm(`Excluir "${p.name}"? A ficha técnica dele também será apagada.`)) return
  try {
    await api.del(`/admin/products/${p.id}`)
    notify('Produto excluído')
    load()
  } catch (e) {
    notifyError(e)
  }
}

const priceLabel = (p: Product) => {
  if (p.variations.length) {
    const prices = p.variations.map((v) => v.price)
    return `a partir de ${brl(Math.min(...prices))}`
  }
  return p.promoPrice ? `${brl(p.promoPrice)} (de ${brl(p.price)})` : brl(p.price)
}
</script>

<template>
  <div class="d-flex align-center flex-wrap ga-2 mb-4">
    <h1 class="text-h5">Cardápio</h1>
    <v-spacer />
    <template v-if="tab === 'produtos'">
      <v-btn variant="tonal" prepend-icon="mdi-shape-plus-outline" @click="openCategory()">Categoria</v-btn>
      <v-btn color="primary" prepend-icon="mdi-plus" :disabled="!hasCategories" @click="openProduct()">Produto</v-btn>
    </template>
  </div>

  <v-tabs v-model="tab" color="primary" class="mb-4">
    <v-tab value="produtos">Produtos</v-tab>
    <v-tab value="adicionais">Adicionais</v-tab>
  </v-tabs>

  <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

  <v-window v-model="tab">
    <v-window-item value="produtos">
      <v-alert v-if="!loading && !hasCategories" type="info" variant="tonal">
        Comece criando uma categoria, como "Bolos" ou "Doces".
      </v-alert>

      <p v-if="hasCategories" class="text-caption text-medium-emphasis mb-2">
        <v-icon icon="mdi-drag" size="small" /> Arraste para mudar a ordem das categorias e dos produtos na loja.
      </p>

      <draggable v-model="categories" item-key="id" handle=".cat-handle" @end="saveCategoryOrder">
        <template #item="{ element: c }">
          <v-card class="mb-4" :class="{ 'opacity-60': !c.active }">
            <v-card-item>
              <template #prepend>
                <v-icon icon="mdi-drag" class="cat-handle" style="cursor: grab" />
              </template>
              <v-card-title>
                {{ c.name }}
                <v-chip v-if="!c.active" size="x-small" class="ml-2">oculta</v-chip>
              </v-card-title>
              <template #append>
                <v-btn
                  :icon="c.active ? 'mdi-eye-outline' : 'mdi-eye-off-outline'"
                  variant="text"
                  size="small"
                  :title="c.active ? 'Ocultar da loja' : 'Mostrar na loja'"
                  @click="toggleCategory(c)"
                />
                <v-btn icon="mdi-pencil-outline" variant="text" size="small" @click="openCategory(c)" />
                <v-btn icon="mdi-delete-outline" variant="text" size="small" @click="removeCategory(c)" />
              </template>
            </v-card-item>

            <v-divider />

            <div v-if="!productsByCategory[c.id]?.length" class="pa-4 text-medium-emphasis text-body-2">
              Nenhum produto nesta categoria.
            </div>

            <draggable
              v-model="productsByCategory[c.id]"
              item-key="id"
              handle=".prod-handle"
              tag="div"
              @end="saveProductOrder(c.id)"
            >
              <template #item="{ element: p }">
                <div class="d-flex align-center pa-3 ga-3 product-row">
                  <v-icon icon="mdi-drag" class="prod-handle" style="cursor: grab" />
                  <v-avatar rounded="lg" size="56" color="grey-lighten-3">
                    <v-img v-if="p.imageUrl" :src="p.imageUrl" cover />
                    <v-icon v-else icon="mdi-cupcake" color="grey" />
                  </v-avatar>
                  <div class="flex-grow-1" style="min-width: 0">
                    <div class="font-weight-medium text-truncate" :class="{ 'text-disabled': !p.available }">{{ p.name }}</div>
                    <div class="text-body-2 text-medium-emphasis">{{ priceLabel(p) }}</div>
                    <div class="d-flex flex-wrap ga-1 mt-1">
                      <v-chip v-if="p.variations.length" size="x-small" variant="tonal">
                        {{ p.variations.length }} variações
                      </v-chip>
                      <v-chip
                        v-if="p.recipe"
                        size="x-small"
                        variant="tonal"
                        :color="p.recipe.belowTarget ? 'error' : 'success'"
                        :prepend-icon="p.recipe.belowTarget ? 'mdi-alert' : 'mdi-check'"
                      >
                        margem {{ pct(p.recipe.actualMargin) }}
                      </v-chip>
                      <v-chip v-else-if="!p.variations.length" size="x-small" variant="tonal" color="warning">
                        sem ficha técnica
                      </v-chip>
                    </div>
                  </div>
                  <v-switch
                    :model-value="p.available"
                    color="primary"
                    density="compact"
                    inset
                    hide-details
                    title="Disponível na loja"
                    @update:model-value="toggleAvailable(p)"
                  />
                  <v-btn icon="mdi-pencil-outline" variant="text" size="small" @click="openProduct(p)" />
                  <v-btn icon="mdi-delete-outline" variant="text" size="small" @click="removeProduct(p)" />
                </div>
              </template>
            </draggable>
          </v-card>
        </template>
      </draggable>
    </v-window-item>

    <v-window-item value="adicionais">
      <AddonGroupsPanel :groups="addonGroups" @changed="load" />
    </v-window-item>
  </v-window>

  <ProductDialog
    v-model="productDialog"
    :product="editingProduct"
    :categories="categories"
    :addon-groups="addonGroups"
    @saved="load"
  />

  <v-dialog v-model="categoryDialog" max-width="420">
    <v-card :title="categoryForm.id ? 'Renomear categoria' : 'Nova categoria'">
      <v-card-text>
        <v-form id="category-form" @submit.prevent="saveCategory">
          <v-text-field v-model="categoryForm.name" label="Nome" autofocus />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="categoryDialog = false">Cancelar</v-btn>
        <v-btn color="primary" variant="flat" type="submit" form="category-form">Salvar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.product-row + .product-row {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
</style>
