<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import GenerateView from '@/components/GenerateView.vue'
import SearchView from '@/components/SearchView.vue'
import GalleryView from '@/components/GalleryView.vue'
import DownloadsPanel from '@/components/DownloadsPanel.vue'
import LogoIcon from '@/assets/icon.svg'

const store = useAppStore()
const auth = useAuthStore()

// ComfyUI URL
const COMFYUI_URL = 'https://tensors-api.saiden.dev/comfy/'

onMounted(async () => {
  // Initialize auth first
  await auth.init()

  // If authenticated, load app data
  if (auth.isAuthenticated) {
    store.loadModels()
    store.pollDownloads()
  }
})
</script>

<template>
  <v-app>
    <!-- Loading state -->
    <div v-if="auth.loading" class="auth-loading">
      <v-progress-circular indeterminate color="primary" size="48" />
      <p class="mt-4 text-medium-emphasis">Loading...</p>
    </div>

    <!-- Not authenticated - redirect to login -->
    <div v-else-if="!auth.isAuthenticated" class="auth-login">
      <div class="login-card">
        <div class="logo-large">
          <img :src="LogoIcon" alt="Tensors" />
        </div>
        <h1>Tensors</h1>
        <p class="text-medium-emphasis mb-6">Sign in to continue</p>
        <v-btn
          color="#24292f"
          size="large"
          block
          @click="auth.redirectToLogin()"
        >
          <v-icon start>mdi-github</v-icon>
          Sign in with GitHub
        </v-btn>
      </div>
    </div>

    <!-- Authenticated - show app -->
    <template v-else>
      <v-navigation-drawer permanent rail>
        <div class="logo-container">
          <img :src="LogoIcon" alt="Tensors" class="logo" />
        </div>
        <v-list density="compact" nav>
          <v-list-item
            :active="store.currentView === 'generate'"
            @click="store.currentView = 'generate'"
            prepend-icon="mdi-auto-fix"
            title="Generate"
          />
          <v-list-item
            :active="store.currentView === 'search'"
            @click="store.currentView = 'search'"
            prepend-icon="mdi-magnify"
            title="Search"
          />
          <v-list-item
            :active="store.currentView === 'gallery'"
            @click="store.currentView = 'gallery'"
            prepend-icon="mdi-image-multiple"
            title="Gallery"
          />

          <v-divider class="my-2" />

          <v-list-item
            @click="store.showDownloadsPanel = true"
            title="Downloads"
          >
            <template #prepend>
              <v-badge
                v-if="store.hasActiveDownloads"
                :content="store.activeDownloads.length"
                color="primary"
                offset-x="-2"
                offset-y="-2"
              >
                <v-icon>mdi-download</v-icon>
              </v-badge>
              <v-icon v-else>mdi-download</v-icon>
            </template>
          </v-list-item>

          <v-list-item
            :href="COMFYUI_URL"
            target="_blank"
            prepend-icon="mdi-palette"
            title="ComfyUI"
          />

          <v-divider class="my-2" />

          <v-list-item
            @click="auth.logout()"
            prepend-icon="mdi-logout"
            title="Logout"
          />
        </v-list>

        <template #append>
          <div class="user-info pa-2">
            <v-icon size="small" class="mr-1">mdi-account</v-icon>
            <span class="text-caption text-truncate">{{ auth.username }}</span>
          </div>
        </template>
      </v-navigation-drawer>

      <DownloadsPanel />

      <v-main>
        <GenerateView v-if="store.currentView === 'generate'" />
        <SearchView v-else-if="store.currentView === 'search'" />
        <GalleryView v-else-if="store.currentView === 'gallery'" />
      </v-main>
    </template>
  </v-app>
</template>

<style>
html, body {
  overflow: hidden;
}

/* ComfyUI-inspired gradient background */
.v-application {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%) !important;
}

/* Navigation drawer matches surface color */
.v-navigation-drawer {
  background: rgba(30, 30, 46, 0.95) !important;
  border-right: 1px solid rgba(255, 255, 255, 0.1) !important;
}

/* Active nav item styling */
.v-list-item--active {
  background: rgba(102, 126, 234, 0.15) !important;
}
.v-list-item--active .v-list-item__prepend .v-icon {
  color: #667eea !important;
}

/* Card styling */
.v-card, .v-sheet {
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Muted text */
.text-grey, .text-medium-emphasis {
  color: #888 !important;
}

/* Logo in sidebar */
.logo-container {
  display: flex;
  justify-content: center;
  padding: 16px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 8px;
}
.logo {
  width: 32px;
  height: 32px;
}

/* User info at bottom of sidebar */
.user-info {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* Auth loading state */
.auth-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
}

/* Auth login state */
.auth-login {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
}

.login-card {
  background: rgba(30, 30, 46, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.login-card h1 {
  font-size: 28px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
}

.logo-large {
  margin-bottom: 24px;
}

.logo-large img {
  width: 64px;
  height: 64px;
}
</style>
