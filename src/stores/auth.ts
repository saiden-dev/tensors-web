import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Auth API uses the direct API URL (not proxy) since auth routes don't need API key
const AUTH_API = 'https://tensors-api.saiden.dev'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const username = ref<string | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value && !!username.value)

  // Get the login URL for redirecting to OAuth
  function getLoginUrl(): string {
    const returnUrl = window.location.origin
    return `${AUTH_API}/auth/login?return_url=${encodeURIComponent(returnUrl)}`
  }

  // Check for token in URL (OAuth callback) or localStorage
  async function init() {
    loading.value = true
    error.value = null

    try {
      // Check URL for token (OAuth callback)
      const params = new URLSearchParams(window.location.search)
      const urlToken = params.get('token')

      if (urlToken) {
        // Remove token from URL (clean up)
        const url = new URL(window.location.href)
        url.searchParams.delete('token')
        window.history.replaceState({}, '', url.toString())

        // Verify and store
        const verified = await verifyToken(urlToken)
        if (verified) {
          token.value = urlToken
          localStorage.setItem('tensors_token', urlToken)
          return
        }
      }

      // Check localStorage for existing token
      const storedToken = localStorage.getItem('tensors_token')
      if (storedToken) {
        const verified = await verifyToken(storedToken)
        if (verified) {
          token.value = storedToken
          return
        }
        // Invalid token, clear it
        localStorage.removeItem('tensors_token')
      }

      // Not authenticated
      token.value = null
      username.value = null
    } catch (e: any) {
      console.error('Auth init error:', e)
      error.value = e.message || 'Authentication error'
      token.value = null
      username.value = null
    } finally {
      loading.value = false
    }
  }

  // Verify token with API
  async function verifyToken(checkToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${AUTH_API}/auth/verify?token=${encodeURIComponent(checkToken)}`)
      const data = await response.json()

      if (data.valid && data.username) {
        username.value = data.username
        return true
      }
      return false
    } catch (e) {
      console.error('Token verification failed:', e)
      return false
    }
  }

  // Logout
  function logout() {
    token.value = null
    username.value = null
    localStorage.removeItem('tensors_token')
    // Redirect to logout endpoint to clear any server-side session
    window.location.href = `${AUTH_API}/auth/logout?return_url=${encodeURIComponent(window.location.origin)}`
  }

  // Redirect to login
  function redirectToLogin() {
    window.location.href = getLoginUrl()
  }

  return {
    token,
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
