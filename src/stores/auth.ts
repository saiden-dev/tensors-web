import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Auth + API gateway (Cloudflare Worker)
// Cookie is set on .saiden.dev domain (HttpOnly, shared with tensors-api)
const AUTH_API = 'https://gw.saiden.dev'

export const useAuthStore = defineStore('auth', () => {
  const username = ref<string | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!username.value)

  // Get the login URL for redirecting to OAuth
  function getLoginUrl(): string {
    const returnUrl = window.location.origin
    return `${AUTH_API}/auth/login?return_url=${encodeURIComponent(returnUrl)}`
  }

  // Check session via cookie (HttpOnly cookie sent automatically)
  async function init() {
    loading.value = true
    error.value = null

    try {
      // Call verify endpoint - browser sends cookie automatically
      const response = await fetch(`${AUTH_API}/auth/verify`, {
        credentials: 'include', // Send cookies cross-origin
      })
      const data = await response.json()

      if (data.valid && data.username) {
        username.value = data.username
      } else {
        username.value = null
      }
    } catch (e: any) {
      console.error('Auth init error:', e)
      error.value = e.message || 'Authentication error'
      username.value = null
    } finally {
      loading.value = false
    }
  }

  // Logout - redirect to clear cookie
  function logout() {
    username.value = null
    window.location.href = `${AUTH_API}/auth/logout?return_url=${encodeURIComponent(window.location.origin)}`
  }

  // Redirect to login
  function redirectToLogin() {
    window.location.href = getLoginUrl()
  }

  return {
    username,
    loading,
    error,
    isAuthenticated,
    init,
    logout,
    redirectToLogin,
    getLoginUrl,
  }
})
