import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { pt } from 'vuetify/locale'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import App from './App.vue'
import { router } from './router'

const vuetify = createVuetify({
  components,
  directives,
  locale: { locale: 'pt', messages: { pt } },
  theme: {
    defaultTheme: 'confeitaria',
    themes: {
      confeitaria: {
        dark: false,
        colors: {
          primary: '#C2185B',
          secondary: '#6D4C41',
          background: '#FAF7F5',
          surface: '#FFFFFF',
        },
      },
    },
  },
  defaults: {
    VTextField: { variant: 'outlined', density: 'comfortable' },
    VSelect: { variant: 'outlined', density: 'comfortable' },
    VAutocomplete: { variant: 'outlined', density: 'comfortable' },
    VTextarea: { variant: 'outlined', density: 'comfortable' },
    VFileInput: { variant: 'outlined', density: 'comfortable' },
    VBtn: { rounded: 'lg' },
    VCard: { rounded: 'lg' },
  },
})

createApp(App).use(vuetify).use(router).mount('#app')
