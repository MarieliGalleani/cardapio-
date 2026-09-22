<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, auth } from '@/lib/api'

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const router = useRouter()

async function submit() {
  loading.value = true
  error.value = ''
  try {
    const { token } = await api.post<{ token: string }>('/auth/login', { email: email.value, password: password.value })
    auth.token = token
    router.push('/admin')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-main class="bg-background d-flex align-center justify-center" style="min-height: 100vh">
    <v-card width="380" class="pa-6" elevation="2">
      <div class="text-center mb-6">
        <v-icon icon="mdi-cake-variant" size="48" color="primary" />
        <h1 class="text-h5 mt-2">Painel da confeitaria</h1>
      </div>
      <v-form @submit.prevent="submit">
        <v-text-field v-model="email" label="E-mail" type="email" autocomplete="username" />
        <v-text-field v-model="password" label="Senha" type="password" autocomplete="current-password" />
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">{{ error }}</v-alert>
        <v-btn type="submit" color="primary" block size="large" :loading="loading">Entrar</v-btn>
      </v-form>
    </v-card>
  </v-main>
</template>
