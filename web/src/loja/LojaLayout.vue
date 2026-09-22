<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { loadShop, shop } from './shop'

const theme = useTheme()
const error = ref('')

// A cor da loja vem das Configurações
watch(
  () => shop.store?.primaryColor,
  (color) => {
    if (color) theme.themes.value.loja.colors.primary = color
  },
)

watch(
  () => shop.store?.name,
  (name) => {
    if (name) document.title = name
  },
)

onMounted(async () => {
  try {
    await loadShop()
  } catch {
    error.value = 'Não foi possível carregar a loja. Verifique sua conexão e tente de novo.'
  }
})
</script>

<template>
  <v-theme-provider theme="loja" with-background class="loja">
    <v-main>
      <div class="loja-container">
        <v-alert v-if="error" type="error" variant="tonal" class="ma-4">{{ error }}</v-alert>
        <div v-else-if="!shop.loaded" class="d-flex justify-center pa-12">
          <v-progress-circular indeterminate color="primary" />
        </div>
        <router-view v-else />
      </div>
    </v-main>
  </v-theme-provider>
</template>

<style>
.loja {
  min-height: 100vh;
}
/* Vale também para diálogos, que o Vuetify desenha fora do container da loja */
.v-theme--loja .v-btn,
.v-btn.v-theme--loja {
  text-transform: none;
  letter-spacing: normal;
}
.loja-container {
  max-width: 640px;
  margin: 0 auto;
  min-height: 100vh;
  background: rgb(var(--v-theme-surface));
  position: relative;
}
</style>
