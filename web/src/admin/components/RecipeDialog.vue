<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api } from '@/lib/api'
import { brl, pct, unitCostDisplay, unitSuffix } from '@/lib/format'
import { notify, notifyError } from '@/lib/notify'
import type { Product, Recipe, RecipeCost, StockItem } from '@/lib/types'

const props = defineProps<{ recipe: Recipe | null; products: Product[]; recipes: Recipe[]; stock: StockItem[] }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [] }>()

// Para quem é a receita: produto sem variação, ou cada variação
interface Target {
  key: string
  title: string
  productId: string | null
  variationId: string | null
}

const targets = computed<Target[]>(() => {
  const taken = new Set(
    props.recipes.filter((r) => r.id !== props.recipe?.id).map((r) => r.productId ?? r.variationId),
  )
  return props.products.flatMap((p): Target[] =>
    p.variations.length
      ? p.variations.map((v) => ({ key: `v:${v.id}`, title: `${p.name} — ${v.name}`, productId: null, variationId: v.id }))
      : [{ key: `p:${p.id}`, title: p.name, productId: p.id, variationId: null }],
  ).filter((t) => !taken.has(t.productId ?? t.variationId))
})

const empty = () => ({
  targetKey: null as string | null,
  yieldQuantity: 1,
  marginPct: 30,
  packagingCostPerUnit: 0,
  energyCost: 0,
  laborCost: 0,
  appFeePct: 0,
  notes: '',
  items: [] as { stockItemId: string | null; quantity: number }[],
})

const form = ref(empty())
const preview = ref<RecipeCost | null>(null)
const saving = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  preview.value = null
  const r = props.recipe
  form.value = r
    ? {
        targetKey: r.variationId ? `v:${r.variationId}` : `p:${r.productId}`,
        yieldQuantity: r.yieldQuantity,
        marginPct: +(r.targetMargin * 100).toFixed(2),
        packagingCostPerUnit: r.packagingCostPerUnit,
        energyCost: r.energyCost,
        laborCost: r.laborCost,
        appFeePct: +(r.appFeePercent * 100).toFixed(2),
        notes: r.notes ?? '',
        items: r.items.map((i) => ({ stockItemId: i.stockItemId, quantity: i.quantity })),
      }
    : { ...empty(), items: [{ stockItemId: null, quantity: 0 }] }
})

const stockById = computed(() => Object.fromEntries(props.stock.map((s) => [s.id, s])))

function body() {
  const f = form.value
  const target = targets.value.find((t) => t.key === f.targetKey)
  return {
    productId: target?.productId ?? null,
    variationId: target?.variationId ?? null,
    yieldQuantity: f.yieldQuantity,
    targetMargin: f.marginPct / 100,
    packagingCostPerUnit: f.packagingCostPerUnit || 0,
    energyCost: f.energyCost || 0,
    laborCost: f.laborCost || 0,
    appFeePercent: (f.appFeePct || 0) / 100,
    notes: f.notes || null,
    items: f.items.filter((i) => i.stockItemId && i.quantity > 0),
  }
}

// Recalcula o custo enquanto o dono digita (espera 400 ms depois da última mudança)
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  form,
  () => {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      const b = body()
      if (!b.items.length || !(b.yieldQuantity > 0) || (!b.productId && !b.variationId)) {
        preview.value = null
        return
      }
      try {
        preview.value = await api.post<RecipeCost>('/admin/recipes/preview', b)
      } catch {
        preview.value = null
      }
    }, 400)
  },
  { deep: true },
)

const lineCost = (i: { stockItemId: string | null; quantity: number }) => {
  const s = i.stockItemId ? stockById.value[i.stockItemId] : null
  return s ? s.unitCost * (i.quantity || 0) : 0
}

async function save() {
  saving.value = true
  try {
    if (props.recipe) await api.put(`/admin/recipes/${props.recipe.id}`, body())
    else await api.post('/admin/recipes', body())
    notify('Ficha técnica salva')
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
  <v-dialog v-model="open" max-width="960" scrollable>
    <v-card :title="recipe ? `Ficha técnica — ${recipe.label}` : 'Nova ficha técnica'">
      <v-card-text>
        <v-form id="recipe-form" @submit.prevent="save">
          <v-row>
            <v-col cols="12" md="7">
              <v-autocomplete
                v-model="form.targetKey"
                :items="targets"
                item-title="title"
                item-value="key"
                label="Produto"
                :disabled="Boolean(recipe)"
                no-data-text="Todos os produtos já têm ficha técnica"
              />
              <v-row dense>
                <v-col cols="6">
                  <v-text-field
                    v-model.number="form.yieldQuantity"
                    label="Rendimento"
                    type="number"
                    min="0"
                    step="0.01"
                    suffix="unidades"
                    hint="Quantas unidades a receita rende"
                    persistent-hint
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model.number="form.marginPct"
                    label="Margem desejada"
                    type="number"
                    min="0"
                    max="99"
                    suffix="%"
                    hint="Sobre o preço de venda"
                    persistent-hint
                  />
                </v-col>
              </v-row>

              <div class="text-subtitle-1 font-weight-medium mt-6 mb-2">Ingredientes e embalagens</div>
              <v-row v-for="(item, i) in form.items" :key="i" dense align="center">
                <v-col cols="12" sm="6">
                  <v-autocomplete
                    v-model="item.stockItemId"
                    :items="stock"
                    item-title="name"
                    item-value="id"
                    label="Item do estoque"
                    hide-details
                    no-data-text="Cadastre o item no Estoque primeiro"
                  />
                </v-col>
                <v-col cols="6" sm="3">
                  <v-text-field
                    v-model.number="item.quantity"
                    label="Qtd."
                    type="number"
                    min="0"
                    step="0.001"
                    :suffix="item.stockItemId ? unitSuffix[stockById[item.stockItemId]?.unit] : ''"
                    hide-details
                  />
                </v-col>
                <v-col cols="4" sm="2" class="text-right text-body-2">{{ brl(lineCost(item)) }}</v-col>
                <v-col cols="2" sm="1">
                  <v-btn icon="mdi-delete-outline" variant="text" size="small" @click="form.items.splice(i, 1)" />
                </v-col>
                <v-col v-if="item.stockItemId && stockById[item.stockItemId]" cols="12" class="pt-0">
                  <span class="text-caption text-medium-emphasis">
                    Custo atual: {{ unitCostDisplay(stockById[item.stockItemId].unitCost, stockById[item.stockItemId].unit) }}
                  </span>
                </v-col>
              </v-row>
              <v-btn
                class="mt-2"
                variant="tonal"
                size="small"
                prepend-icon="mdi-plus"
                @click="form.items.push({ stockItemId: null, quantity: 0 })"
              >
                Item
              </v-btn>

              <v-expansion-panels class="mt-6" variant="accordion">
                <v-expansion-panel title="Custos indiretos (opcional)">
                  <v-expansion-panel-text>
                    <v-row dense>
                      <v-col cols="6">
                        <v-text-field
                          v-model.number="form.energyCost"
                          label="Gás / energia"
                          prefix="R$"
                          type="number"
                          step="0.01"
                          hint="Por receita"
                          persistent-hint
                        />
                      </v-col>
                      <v-col cols="6">
                        <v-text-field
                          v-model.number="form.laborCost"
                          label="Mão de obra"
                          prefix="R$"
                          type="number"
                          step="0.01"
                          hint="Por receita"
                          persistent-hint
                        />
                      </v-col>
                      <v-col cols="6">
                        <v-text-field
                          v-model.number="form.packagingCostPerUnit"
                          label="Embalagem"
                          prefix="R$"
                          type="number"
                          step="0.01"
                          hint="Por unidade (se não estiver no estoque)"
                          persistent-hint
                        />
                      </v-col>
                      <v-col cols="6">
                        <v-text-field
                          v-model.number="form.appFeePct"
                          label="Taxa do app de delivery"
                          suffix="%"
                          type="number"
                          step="0.1"
                          hint="% sobre o preço de venda"
                          persistent-hint
                        />
                      </v-col>
                    </v-row>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>

              <v-textarea v-model="form.notes" class="mt-4" label="Anotações da receita" rows="2" auto-grow />
            </v-col>

            <v-col cols="12" md="5">
              <v-card variant="tonal" color="primary" class="position-sticky" style="top: 0">
                <v-card-title class="text-subtitle-1">Resultado</v-card-title>
                <v-card-text v-if="preview">
                  <v-table density="compact" class="bg-transparent">
                    <tbody>
                      <tr><td>Ingredientes</td><td class="text-right">{{ brl(preview.ingredientsCost) }}</td></tr>
                      <tr><td>Custos indiretos</td><td class="text-right">{{ brl(preview.indirectCost) }}</td></tr>
                      <tr class="font-weight-bold"><td>Custo da receita</td><td class="text-right">{{ brl(preview.totalCost) }}</td></tr>
                      <tr class="font-weight-bold"><td>Custo por unidade</td><td class="text-right">{{ brl(preview.unitCost) }}</td></tr>
                    </tbody>
                  </v-table>
                  <v-divider class="my-3" />
                  <div class="text-caption">Preço sugerido por unidade</div>
                  <div class="text-h4 font-weight-bold">{{ brl(preview.suggestedUnitPrice) }}</div>
                  <div class="text-body-2">Receita inteira: {{ brl(preview.suggestedBatchPrice) }}</div>
                  <v-divider class="my-3" />
                  <div v-if="preview.salePrice" class="text-body-2">
                    Preço atual no cardápio: <strong>{{ brl(preview.salePrice) }}</strong><br />
                    Margem real: <strong :class="preview.belowTarget ? 'text-error' : ''">{{ pct(preview.actualMargin) }}</strong>
                    <v-chip v-if="preview.belowTarget" size="x-small" color="error" class="ml-1">abaixo da meta</v-chip>
                  </div>
                  <p class="text-caption mt-3">Preço = custo por unidade ÷ (1 − margem{{ form.appFeePct ? ' − taxa do app' : '' }})</p>
                </v-card-text>
                <v-card-text v-else class="text-body-2">
                  Escolha o produto, o rendimento e pelo menos um ingrediente para ver o custo e o preço sugerido.
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancelar</v-btn>
        <v-btn color="primary" variant="flat" type="submit" form="recipe-form" :loading="saving">Salvar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
