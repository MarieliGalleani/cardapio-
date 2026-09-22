<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { brl, costFactor, costLabel, pct, qty, unitCostDisplay, unitSuffix, type BaseUnit } from '@/lib/format'
import { notify, notifyError } from '@/lib/notify'
import type { BelowTarget, StockItem, StockMovement } from '@/lib/types'

const items = ref<StockItem[]>([])
const loading = ref(true)
const search = ref('')
const onlyLow = ref(false)

async function load() {
  loading.value = true
  try {
    items.value = await api.get<StockItem[]>('/admin/stock')
  } catch (e) {
    notifyError(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const lowItems = computed(() => items.value.filter((i) => i.low))
const visible = computed(() => (onlyLow.value ? lowItems.value : items.value))

const headers = [
  { title: 'Item', key: 'name' },
  { title: 'Em estoque', key: 'quantity', align: 'end' as const },
  { title: 'Mínimo', key: 'minimum', align: 'end' as const },
  { title: 'Custo', key: 'unitCost', align: 'end' as const },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
]

const unitOptions = [
  { title: 'Gramas (g) — sólidos', value: 'G' },
  { title: 'Mililitros (ml) — líquidos', value: 'ML' },
  { title: 'Unidades (un)', value: 'UN' },
]

// ─── Cadastro ────────────────────────────────────────────────────────────────
const itemDialog = ref(false)
const itemForm = ref({ id: '', name: '', kind: 'INGREDIENT', unit: 'G' as BaseUnit, minimum: 0, displayCost: 0 })

function openItem(i?: StockItem) {
  itemForm.value = i
    ? { id: i.id, name: i.name, kind: i.kind, unit: i.unit, minimum: i.minimum, displayCost: +(i.unitCost * costFactor[i.unit]).toFixed(2) }
    : { id: '', name: '', kind: 'INGREDIENT', unit: 'G', minimum: 0, displayCost: 0 }
  itemDialog.value = true
}

async function saveItem() {
  const f = itemForm.value
  const body = { name: f.name, kind: f.kind, minimum: f.minimum, unitCost: f.displayCost / costFactor[f.unit] }
  try {
    if (f.id) {
      const res = await api.put<{ belowTarget: BelowTarget[] }>(`/admin/stock/${f.id}`, body)
      showBelowTarget(res.belowTarget)
    } else {
      await api.post('/admin/stock', { ...body, unit: f.unit })
    }
    notify('Item salvo')
    itemDialog.value = false
    load()
  } catch (e) {
    notifyError(e)
  }
}

async function removeItem(i: StockItem) {
  if (i._count?.recipeItems) {
    notify(`"${i.name}" está em ${i._count.recipeItems} ficha(s) técnica(s). Tire das receitas antes de excluir.`, 'warning')
    return
  }
  if (!confirm(`Excluir "${i.name}" do estoque?`)) return
  try {
    await api.del(`/admin/stock/${i.id}`)
    load()
  } catch (e) {
    notifyError(e)
  }
}

// ─── Compra (entrada) ────────────────────────────────────────────────────────
const purchaseDialog = ref(false)
const purchaseItem = ref<StockItem | null>(null)
const purchaseForm = ref({ quantity: 1, unit: 'KG', totalCost: 0, note: '' })

const purchaseUnits: Record<BaseUnit, { title: string; value: string }[]> = {
  G: [
    { title: 'kg', value: 'KG' },
    { title: 'g', value: 'G' },
  ],
  ML: [
    { title: 'L', value: 'L' },
    { title: 'ml', value: 'ML' },
  ],
  UN: [
    { title: 'unidades', value: 'UN' },
    { title: 'dúzias', value: 'DZ' },
  ],
}

function openPurchase(i: StockItem) {
  purchaseItem.value = i
  purchaseForm.value = { quantity: 1, unit: purchaseUnits[i.unit][0].value, totalCost: 0, note: '' }
  purchaseDialog.value = true
}

async function savePurchase() {
  try {
    const res = await api.post<{ belowTarget: BelowTarget[] }>(`/admin/stock/${purchaseItem.value!.id}/purchase`, purchaseForm.value)
    notify('Compra registrada')
    purchaseDialog.value = false
    showBelowTarget(res.belowTarget)
    load()
  } catch (e) {
    notifyError(e)
  }
}

// ─── Ajuste ──────────────────────────────────────────────────────────────────
const adjustDialog = ref(false)
const adjustItem = ref<StockItem | null>(null)
const adjustForm = ref({ direction: -1, quantity: 0, note: '' })

function openAdjust(i: StockItem) {
  adjustItem.value = i
  adjustForm.value = { direction: -1, quantity: 0, note: '' }
  adjustDialog.value = true
}

async function saveAdjust() {
  const f = adjustForm.value
  try {
    await api.post(`/admin/stock/${adjustItem.value!.id}/adjust`, { quantity: f.direction * f.quantity, note: f.note })
    notify('Estoque ajustado')
    adjustDialog.value = false
    load()
  } catch (e) {
    notifyError(e)
  }
}

// ─── Histórico ───────────────────────────────────────────────────────────────
const historyDialog = ref(false)
const historyItem = ref<StockItem | null>(null)
const movements = ref<StockMovement[]>([])
const movementLabel = { PURCHASE: 'Compra', ORDER: 'Pedido', ADJUSTMENT: 'Ajuste' }

async function openHistory(i: StockItem) {
  historyItem.value = i
  movements.value = []
  historyDialog.value = true
  try {
    movements.value = await api.get<StockMovement[]>(`/admin/stock/${i.id}/movements`)
  } catch (e) {
    notifyError(e)
  }
}

// ─── Produtos que ficaram abaixo da margem ──────────────────────────────────
const belowTarget = ref<BelowTarget[]>([])
const belowTargetDialog = ref(false)
function showBelowTarget(list: BelowTarget[]) {
  if (!list.length) return
  belowTarget.value = list
  belowTargetDialog.value = true
}
</script>

<template>
  <div class="d-flex align-center flex-wrap ga-2 mb-4">
    <h1 class="text-h5">Estoque</h1>
    <v-spacer />
    <v-btn color="primary" prepend-icon="mdi-plus" @click="openItem()">Novo item</v-btn>
  </div>

  <v-alert
    v-if="lowItems.length"
    type="warning"
    variant="tonal"
    class="mb-4"
    icon="mdi-alert-outline"
    :title="`${lowItems.length} ${lowItems.length === 1 ? 'item precisa' : 'itens precisam'} de reposição`"
  >
    {{ lowItems.map((i) => i.name).join(', ') }}
  </v-alert>

  <v-card>
    <v-card-text class="d-flex flex-wrap align-center ga-4 pb-0">
      <v-text-field
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        label="Buscar"
        hide-details
        density="compact"
        style="max-width: 320px"
      />
      <v-switch v-model="onlyLow" label="Só estoque baixo" color="warning" hide-details inset density="compact" />
    </v-card-text>
    <v-data-table
      :headers="headers"
      :items="visible"
      :search="search"
      :loading="loading"
      items-per-page="50"
      no-data-text="Nenhum item cadastrado"
      loading-text="Carregando…"
    >
      <template #[`item.name`]="{ item }">
        <div class="py-2">
          <div class="font-weight-medium">{{ item.name }}</div>
          <v-chip size="x-small" variant="tonal" class="mt-1">{{ item.kind === 'PACKAGING' ? 'Embalagem' : 'Ingrediente' }}</v-chip>
        </div>
      </template>
      <template #[`item.quantity`]="{ item }">
        <span :class="{ 'text-error font-weight-bold': item.low }">
          <v-icon v-if="item.low" icon="mdi-alert" size="small" color="error" />
          {{ qty(item.quantity, item.unit) }}
        </span>
      </template>
      <template #[`item.minimum`]="{ item }">{{ qty(item.minimum, item.unit) }}</template>
      <template #[`item.unitCost`]="{ item }">{{ unitCostDisplay(item.unitCost, item.unit) }}</template>
      <template #[`item.actions`]="{ item }">
        <div class="d-flex justify-end ga-1">
          <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-cart-plus" @click="openPurchase(item)">Compra</v-btn>
          <v-menu>
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-dots-vertical" variant="text" size="small" />
            </template>
            <v-list density="compact">
              <v-list-item prepend-icon="mdi-tune-variant" title="Ajustar quantidade" @click="openAdjust(item)" />
              <v-list-item prepend-icon="mdi-history" title="Histórico" @click="openHistory(item)" />
              <v-list-item prepend-icon="mdi-pencil-outline" title="Editar" @click="openItem(item)" />
              <v-list-item prepend-icon="mdi-delete-outline" title="Excluir" @click="removeItem(item)" />
            </v-list>
          </v-menu>
        </div>
      </template>
    </v-data-table>
  </v-card>

  <!-- Cadastro -->
  <v-dialog v-model="itemDialog" max-width="520">
    <v-card :title="itemForm.id ? 'Editar item' : 'Novo item de estoque'">
      <v-card-text>
        <v-form id="item-form" @submit.prevent="saveItem">
          <v-text-field v-model="itemForm.name" label="Nome" placeholder="Ex.: Leite condensado" />
          <v-btn-toggle v-model="itemForm.kind" mandatory color="primary" variant="outlined" divided class="mb-4">
            <v-btn value="INGREDIENT">Ingrediente</v-btn>
            <v-btn value="PACKAGING">Embalagem</v-btn>
          </v-btn-toggle>
          <v-select
            v-model="itemForm.unit"
            :items="unitOptions"
            label="Contar em"
            :disabled="Boolean(itemForm.id)"
            :hint="itemForm.id ? 'A unidade não muda depois de criada' : 'Compras em kg ou L são convertidas sozinhas'"
            persistent-hint
          />
          <v-row dense class="mt-2">
            <v-col cols="6">
              <v-text-field
                v-model.number="itemForm.minimum"
                label="Estoque mínimo"
                type="number"
                min="0"
                :suffix="unitSuffix[itemForm.unit]"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model.number="itemForm.displayCost"
                :label="`Custo por ${costLabel[itemForm.unit]}`"
                prefix="R$"
                type="number"
                step="0.01"
                min="0"
                hint="Atualiza sozinho a cada compra"
                persistent-hint
              />
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="itemDialog = false">Cancelar</v-btn>
        <v-btn color="primary" variant="flat" type="submit" form="item-form">Salvar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Compra -->
  <v-dialog v-model="purchaseDialog" max-width="480">
    <v-card v-if="purchaseItem" :title="`Compra de ${purchaseItem.name}`" subtitle="Soma ao estoque e atualiza o custo">
      <v-card-text>
        <v-form id="purchase-form" @submit.prevent="savePurchase">
          <v-row dense>
            <v-col cols="7">
              <v-text-field v-model.number="purchaseForm.quantity" label="Quantidade" type="number" step="0.001" min="0" />
            </v-col>
            <v-col cols="5">
              <v-select v-model="purchaseForm.unit" :items="purchaseUnits[purchaseItem.unit]" label="Unidade" />
            </v-col>
          </v-row>
          <v-text-field v-model.number="purchaseForm.totalCost" label="Valor pago (total)" prefix="R$" type="number" step="0.01" min="0" />
          <v-text-field v-model="purchaseForm.note" label="Observação" placeholder="Ex.: Atacadão" />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="purchaseDialog = false">Cancelar</v-btn>
        <v-btn color="primary" variant="flat" type="submit" form="purchase-form">Registrar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Ajuste -->
  <v-dialog v-model="adjustDialog" max-width="440">
    <v-card v-if="adjustItem" :title="`Ajustar ${adjustItem.name}`" :subtitle="`Hoje: ${qty(adjustItem.quantity, adjustItem.unit)}`">
      <v-card-text>
        <v-form id="adjust-form" @submit.prevent="saveAdjust">
          <v-btn-toggle v-model="adjustForm.direction" mandatory color="primary" variant="outlined" divided class="mb-4">
            <v-btn :value="-1" prepend-icon="mdi-minus">Tirar</v-btn>
            <v-btn :value="1" prepend-icon="mdi-plus">Somar</v-btn>
          </v-btn-toggle>
          <v-text-field
            v-model.number="adjustForm.quantity"
            label="Quantidade"
            type="number"
            min="0"
            :suffix="unitSuffix[adjustItem.unit]"
          />
          <v-text-field v-model="adjustForm.note" label="Motivo" placeholder="Ex.: perda, contagem" />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="adjustDialog = false">Cancelar</v-btn>
        <v-btn color="primary" variant="flat" type="submit" form="adjust-form">Salvar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Histórico -->
  <v-dialog v-model="historyDialog" max-width="600" scrollable>
    <v-card v-if="historyItem" :title="`Histórico — ${historyItem.name}`">
      <v-card-text>
        <v-list v-if="movements.length" density="compact">
          <v-list-item
            v-for="m in movements"
            :key="m.id"
            :title="`${movementLabel[m.type]}${m.order ? ` #${m.order.number}` : ''}${m.note ? ` — ${m.note}` : ''}`"
            :subtitle="new Date(m.createdAt).toLocaleString('pt-BR')"
          >
            <template #append>
              <div class="text-right">
                <div :class="m.quantity > 0 ? 'text-success' : 'text-error'">
                  {{ m.quantity > 0 ? '+' : '' }}{{ qty(m.quantity, historyItem.unit) }}
                </div>
                <div v-if="m.totalCost != null" class="text-caption">{{ brl(m.totalCost) }}</div>
              </div>
            </template>
          </v-list-item>
        </v-list>
        <p v-else class="text-medium-emphasis">Nenhuma movimentação ainda.</p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="historyDialog = false">Fechar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Aviso de margem -->
  <v-dialog v-model="belowTargetDialog" max-width="560">
    <v-card title="Margem abaixo da meta" prepend-icon="mdi-alert" color="surface">
      <v-card-text>
        <p class="mb-3">Com o novo custo, estes produtos ficaram abaixo da margem desejada:</p>
        <v-list density="compact">
          <v-list-item v-for="r in belowTarget" :key="r.id" :title="r.label">
            <template #subtitle>
              Margem {{ pct(r.actualMargin) }} (meta {{ pct(r.targetMargin) }}) · preço atual {{ brl(r.salePrice) }} · sugerido
              {{ brl(r.suggestedUnitPrice) }}
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="belowTargetDialog = false">Depois</v-btn>
        <v-btn color="primary" variant="flat" to="/admin/fichas">Ver fichas técnicas</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
