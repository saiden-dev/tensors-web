import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// Vuetify
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'

// ComfyUI-inspired color scheme
const vuetify = createVuetify({
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        colors: {
          background: '#0f0f23',      // Darkest gradient color
          surface: '#1e1e2e',          // Card/container background
          'surface-variant': '#16213e', // Alternative surface
          primary: '#667eea',          // Purple accent
          secondary: '#24292f',        // Button background
          error: '#ef4444',
          info: '#667eea',
          success: '#4ade80',
          warning: '#f59e0b',
          'on-background': '#e0e0e0',
          'on-surface': '#e0e0e0',
        }
      }
    }
  },
  defaults: {
    VBtn: {
      variant: 'flat',
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
    },
  }
})

const app = createApp(App)
app.use(createPinia())
app.use(vuetify)
app.mount('#app')
