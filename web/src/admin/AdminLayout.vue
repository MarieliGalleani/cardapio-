<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { auth } from '@/lib/api'

const { mdAndUp } = useDisplay()
const drawer = ref(mdAndUp.value)
const router = useRouter()

const menu = [
  { title: 'Dashboard', icon: 'mdi-view-dashboard-outline', to: '/admin' },
  { title: 'Pedidos', icon: 'mdi-receipt-text-outline', to: '/admin/pedidos' },
  { title: 'Cardápio', icon: 'mdi-cupcake', to: '/admin/cardapio' },
  { title: 'Estoque', icon: 'mdi-package-variant-closed', to: '/admin/estoque' },
  { title: 'Ficha técnica', icon: 'mdi-calculator-variant-outline', to: '/admin/fichas' },
  { title: 'Configurações', icon: 'mdi-cog-outline', to: '/admin/configuracoes' },
]

function logout() {
  auth.token = null
  router.push('/admin/login')
}
</script>

<template>
  <v-navigation-drawer v-model="drawer" :permanent="mdAndUp">
    <v-list-item class="py-4" title="Cardápio" subtitle="Painel do dono" prepend-icon="mdi-cake-variant" />
    <v-divider />
    <v-list nav density="comfortable">
      <v-list-item
        v-for="item in menu"
        :key="item.to"
        :to="item.to"
        :prepend-icon="item.icon"
        :title="item.title"
        :exact="item.to === '/admin'"
        color="primary"
      />
    </v-list>
    <template #append>
      <v-list nav density="comfortable">
        <v-list-item prepend-icon="mdi-storefront-outline" title="Ver loja" href="/" target="_blank" />
        <v-list-item prepend-icon="mdi-logout" title="Sair" @click="logout" />
      </v-list>
    </template>
  </v-navigation-drawer>

  <v-app-bar v-if="!mdAndUp" flat density="comfortable">
    <v-app-bar-nav-icon @click="drawer = !drawer" />
    <v-app-bar-title>Cardápio</v-app-bar-title>
  </v-app-bar>

  <v-main class="bg-background">
    <v-container fluid class="pa-4 pa-md-6" style="max-width: 1280px">
      <router-view />
    </v-container>
  </v-main>
</template>
