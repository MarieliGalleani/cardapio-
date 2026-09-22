<script setup lang="ts">
import { toast } from './lib/notify'
</script>

<template>
  <v-app>
    <router-view />
    <v-snackbar v-model="toast.show" :color="toast.color" timeout="3500" location="top">
      {{ toast.text }}
    </v-snackbar>
  </v-app>
</template>
