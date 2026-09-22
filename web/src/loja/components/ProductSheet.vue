<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { brl } from '@/lib/format'
import { notify } from '@/lib/notify'
import { addToCart, type MenuProduct } from '../shop'

const props = defineProps<{ product: MenuProduct | null }>()
const open = defineModel<boolean>({ required: true })
const { smAndDown } = useDisplay()

const variationId = ref<string | null>(null)
const picked = ref<Record<string, string[]>>({}) // grupo → adicionais escolhidos
const notes = ref('')
const quantity = ref(1)

watch(open, (isOpen) => {
  if (!isOpen || !props.product) return
  const p = props.product
  variationId.value = p.variations.find((v) => v.available)?.id ?? null
  picked.value = Object.fromEntries(p.addonGroups.map((g) => [g.id, []]))
  notes.value = ''
  quantity.value = 1
})

const basePrice = computed(() => {
  const p = props.product
  if (!p) return 0
  if (p.variations.length) return p.variations.find((v) => v.id === variationId.value)?.price ?? 0
  return p.promoPrice ?? p.price
})

const chosenAddons = computed(() =>
  (props.product?.addonGroups ?? []).flatMap((g) => g.addons.filter((a) => picked.value[g.id]?.includes(a.id))),
)

const unitPrice = computed(() => basePrice.value + chosenAddons.value.reduce((s, a) => s + a.price, 0))

// O que ainda falta escolher para liberar o botão
const missing = computed(() => {
  const p = props.product
  if (!p) return null
  if (p.variations.length && !variationId.value) return 'Escolha uma opção'
  for (const g of p.addonGroups) {
    if ((picked.value[g.id]?.length ?? 0) < g.minSelect) return `Escolha em "${g.name}"`
  }
  return null
})

function toggle(groupId: string, addonId: string, max: number) {
  const list = picked.value[groupId]
  const i = list.indexOf(addonId)
  if (i >= 0) list.splice(i, 1)
  else if (max === 1) picked.value[groupId] = [addonId]
  else if (list.length < max) list.push(addonId)
}

const groupHint = (g: MenuProduct['addonGroups'][number]) => {
  if (g.minSelect > 0 && g.minSelect === g.maxSelect) return `Escolha ${g.minSelect}`
  if (g.minSelect > 0) return `Escolha de ${g.minSelect} a ${g.maxSelect}`
  return g.maxSelect === 1 ? 'Opcional' : `Opcional · até ${g.maxSelect}`
}

function add() {
  const p = props.product!
  const variation = p.variations.find((v) => v.id === variationId.value)
  addToCart({
    productId: p.id,
    variationId: variationId.value,
    name: variation ? `${p.name} — ${variation.name}` : p.name,
    imageUrl: p.imageUrl,
    unitPrice: unitPrice.value,
    quantity: quantity.value,
    addons: chosenAddons.value,
    notes: notes.value.trim(),
  })
  notify('Adicionado à sacola')
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" :fullscreen="smAndDown" max-width="560" scrollable transition="dialog-bottom-transition">
    <v-card v-if="product" rounded="lg">
      <div class="position-relative">
        <v-img v-if="product.imageUrl" :src="product.imageUrl" height="240" cover />
        <v-btn
          icon="mdi-close"
          size="small"
          :variant="product.imageUrl ? 'flat' : 'text'"
          class="close"
          aria-label="Fechar"
          @click="open = false"
        />
      </div>

      <v-card-text class="pt-4">
        <h2 class="text-h6 font-weight-bold pr-8">{{ product.name }}</h2>
        <p v-if="product.description" class="text-body-2 text-medium-emphasis mt-1" style="white-space: pre-line">
          {{ product.description }}
        </p>

        <section v-if="product.variations.length" class="mt-4">
          <div class="group-title">
            <span>Opções</span>
            <v-chip size="x-small" color="primary" variant="flat">Obrigatório</v-chip>
          </div>
          <v-list density="compact" class="py-0">
            <v-list-item
              v-for="v in product.variations"
              :key="v.id"
              class="px-0"
              :disabled="!v.available"
              role="radio"
              :aria-checked="variationId === v.id"
              @click="variationId = v.id"
            >
              <template #prepend>
                <v-icon
                  :icon="variationId === v.id ? 'mdi-radiobox-marked' : 'mdi-radiobox-blank'"
                  :color="variationId === v.id ? 'primary' : undefined"
                />
              </template>
              <v-list-item-title>{{ v.name }}</v-list-item-title>
              <template #append>
                <span class="text-body-2">{{ v.available ? brl(v.price) : 'Indisponível' }}</span>
              </template>
            </v-list-item>
          </v-list>
        </section>

        <section v-for="g in product.addonGroups" :key="g.id" class="mt-4">
          <div class="group-title">
            <span>{{ g.name }}</span>
            <v-chip size="x-small" :color="g.minSelect ? 'primary' : undefined" variant="flat">{{ groupHint(g) }}</v-chip>
          </div>
          <v-list density="compact" class="py-0">
            <v-list-item
              v-for="a in g.addons"
              :key="a.id"
              class="px-0"
              :disabled="g.maxSelect > 1 && !picked[g.id]?.includes(a.id) && (picked[g.id]?.length ?? 0) >= g.maxSelect"
              @click="toggle(g.id, a.id, g.maxSelect)"
            >
              <template #prepend>
                <v-icon
                  :icon="
                    g.maxSelect === 1
                      ? picked[g.id]?.includes(a.id)
                        ? 'mdi-radiobox-marked'
                        : 'mdi-radiobox-blank'
                      : picked[g.id]?.includes(a.id)
                        ? 'mdi-checkbox-marked'
                        : 'mdi-checkbox-blank-outline'
                  "
                  :color="picked[g.id]?.includes(a.id) ? 'primary' : undefined"
                />
              </template>
              <v-list-item-title>{{ a.name }}</v-list-item-title>
              <template #append>
                <span class="text-body-2">{{ a.price ? `+ ${brl(a.price)}` : '' }}</span>
              </template>
            </v-list-item>
          </v-list>
        </section>

        <v-textarea
          v-model="notes"
          class="mt-4"
          label="Alguma observação?"
          placeholder="Ex.: escrever 'Parabéns, Ana' no bolo"
          rows="2"
          auto-grow
          counter="200"
          maxlength="200"
        />
      </v-card-text>

      <v-card-actions class="pa-4 ga-3 actions">
        <div class="stepper">
          <v-btn icon="mdi-minus" variant="text" size="small" :disabled="quantity <= 1" aria-label="Menos" @click="quantity--" />
          <span class="text-subtitle-1 font-weight-bold">{{ quantity }}</span>
          <v-btn icon="mdi-plus" variant="text" size="small" color="primary" aria-label="Mais" @click="quantity++" />
        </div>
        <v-btn class="flex-grow-1" color="primary" variant="flat" size="large" :disabled="Boolean(missing)" @click="add">
          <template v-if="missing">{{ missing }}</template>
          <template v-else>Adicionar · {{ brl(unitPrice * quantity) }}</template>
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.close {
  position: absolute;
  top: 8px;
  right: 8px;
}
.group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  padding: 8px 12px;
  margin: 0 -12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.actions {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.stepper {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
}
</style>
