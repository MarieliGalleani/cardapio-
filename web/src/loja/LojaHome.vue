<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { brl } from '@/lib/format'
import { cartCount, cartSubtotal, isOpen, shop, statusText, type MenuProduct } from './shop'
import ProductSheet from './components/ProductSheet.vue'

const router = useRouter()
const selected = ref<MenuProduct | null>(null)
const sheet = ref(false)
const activeCategory = ref<string | null>(null)

const store = computed(() => shop.store!)

function open(p: MenuProduct) {
  if (!p.available) return
  selected.value = p
  sheet.value = true
}

function scrollTo(id: string) {
  activeCategory.value = id
  document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const priceText = (p: MenuProduct) => {
  if (p.variations.length) {
    const available = p.variations.filter((v) => v.available).map((v) => v.price)
    return `a partir de ${brl(Math.min(...(available.length ? available : p.variations.map((v) => v.price))))}`
  }
  return brl(p.promoPrice ?? p.price)
}
</script>

<template>
  <header>
    <div class="cover" :style="store.coverUrl ? { backgroundImage: `url(${store.coverUrl})` } : {}" />
    <div class="px-4 pb-4 d-flex align-end ga-3" style="margin-top: -40px">
      <v-avatar size="80" class="logo elevation-2" color="surface">
        <v-img v-if="store.logoUrl" :src="store.logoUrl" cover />
        <v-icon v-else icon="mdi-cake-variant" size="40" color="primary" />
      </v-avatar>
      <div class="pb-1" style="min-width: 0">
        <h1 class="text-h6 font-weight-bold text-truncate">{{ store.name }}</h1>
        <v-chip
          size="small"
          :color="isOpen ? 'success' : store.status.state === 'PAUSED' ? 'warning' : 'error'"
          variant="flat"
          :prepend-icon="isOpen ? 'mdi-clock-outline' : 'mdi-clock-remove-outline'"
        >
          {{ statusText }}
        </v-chip>
      </div>
    </div>
    <p v-if="store.description" class="px-4 pb-3 text-body-2 text-medium-emphasis">{{ store.description }}</p>
    <v-alert
      v-if="!isOpen && store.features.checkout && store.features.preOrders"
      type="info"
      variant="tonal"
      density="compact"
      class="mx-4 mb-3"
    >
      Você pode fazer uma encomenda para outro dia.
    </v-alert>
  </header>

  <nav v-if="shop.menu.length > 1" class="categories">
    <v-chip-group :model-value="activeCategory" selected-class="text-primary" mandatory="force">
      <v-chip v-for="c in shop.menu" :key="c.id" :value="c.id" variant="tonal" @click="scrollTo(c.id)">{{ c.name }}</v-chip>
    </v-chip-group>
  </nav>

  <p v-if="!shop.menu.length" class="pa-8 text-center text-medium-emphasis">O cardápio ainda está sendo preparado.</p>

  <section v-for="c in shop.menu" :id="`cat-${c.id}`" :key="c.id" class="category">
    <h2 class="text-subtitle-1 font-weight-bold px-4 pt-4 pb-1">{{ c.name }}</h2>
    <button
      v-for="p in c.products"
      :key="p.id"
      type="button"
      class="product"
      :class="{ unavailable: !p.available }"
      :disabled="!p.available"
      @click="open(p)"
    >
      <div class="flex-grow-1 text-left" style="min-width: 0">
        <div class="font-weight-medium">{{ p.name }}</div>
        <div v-if="p.description" class="text-body-2 text-medium-emphasis description">{{ p.description }}</div>
        <div class="mt-1">
          <template v-if="!p.available"><span class="text-medium-emphasis">Indisponível</span></template>
          <template v-else>
            <span class="font-weight-medium" :class="{ 'text-success': p.promoPrice && !p.variations.length }">{{ priceText(p) }}</span>
            <span v-if="p.promoPrice && !p.variations.length" class="text-decoration-line-through text-medium-emphasis ml-2 text-body-2">
              {{ brl(p.price) }}
            </span>
          </template>
        </div>
      </div>
      <v-avatar v-if="p.imageUrl" rounded="lg" size="88">
        <v-img :src="p.imageUrl" cover />
      </v-avatar>
    </button>
  </section>

  <div style="height: 96px" />

  <div v-if="cartCount > 0" class="cart-bar">
    <v-btn block size="x-large" color="primary" rounded="lg" @click="router.push('/sacola')">
      <div class="d-flex align-center w-100">
        <v-badge :content="cartCount" color="surface" inline />
        <span class="flex-grow-1">Ver sacola</span>
        <span>{{ brl(cartSubtotal) }}</span>
      </div>
    </v-btn>
  </div>

  <ProductSheet v-model="sheet" :product="selected" />
</template>

<style scoped>
.cover {
  height: 160px;
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)), rgba(var(--v-theme-primary), 0.55));
  background-size: cover;
  background-position: center;
}
.logo {
  border: 3px solid rgb(var(--v-theme-surface));
  flex-shrink: 0;
}
.categories {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgb(var(--v-theme-surface));
  padding: 0 12px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.category {
  scroll-margin-top: 56px;
}
.product {
  display: flex;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.product:hover:not(:disabled) {
  background: rgba(var(--v-theme-on-surface), 0.03);
}
.product.unavailable {
  opacity: 0.5;
  cursor: default;
}
.description {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cart-bar :deep(.v-btn__content) {
  width: 100%;
}
.cart-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 640px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
  z-index: 3;
}
</style>
