<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useAppStore } from '@/stores/app'
import { comfyuiApi } from '@/api/client'
import { config } from '@/api/config'
import type { GeneratedImage } from '@/types'

const store = useAppStore()

const prompt = ref('')
const generating = ref(false)

// Snackbar states
const showError = computed({
  get: () => !!store.switchError,
  set: () => { store.switchError = null }
})
const showSuccess = computed({
  get: () => !store.switchingModel && !!store.switchMessage && !store.switchError,
  set: () => { store.switchMessage = null }
})

interface ChatMessage {
  prompt: string
  params: string
  images: GeneratedImage[]
  error?: string
  loading: boolean
}

const messages = ref<ChatMessage[]>([])

const modelItems = computed(() =>
  store.models.map(m => ({
    title: m.display_name || m.name,
    value: m.path,
    thumbnail: m.thumbnail_url,
    thumbnail_is_video: m.thumbnail_is_video,
    base_model: m.base_model,
  }))
)

const loraItems = computed(() => [
  { title: 'None', value: '', thumbnail: null, thumbnail_is_video: false, triggers: [] },
  ...store.filteredLoras.map(l => ({
    title: l.display_name || l.name,
    value: l.path,
    thumbnail: l.thumbnail_url,
    thumbnail_is_video: l.thumbnail_is_video,
    triggers: l.triggers || [],
  }))
])


async function handleModelChange(model: string) {
  if (model && model !== store.activeModel) {
    try {
      await store.switchModel(model)
      // Reset LoRA if it's not compatible with the new model
      const loraStillValid = store.filteredLoras.some(l => l.path === store.selectedLora)
      if (!loraStillValid) {
        store.selectedLora = ''
      }
    } catch (e) {
      console.error(e)
    }
  }
}

async function generate() {
  if (!prompt.value.trim() || generating.value) return

  const currentPrompt = prompt.value.trim()
  prompt.value = ''
  generating.value = true

  // Build final prompt with quality tags
  const finalPrompt = `${store.defaultQualityTags}, ${currentPrompt}`

  // Get selected model filename (ComfyUI expects just filename, not full path)
  const selectedModelObj = store.models.find(m => m.path === store.selectedModel)
  const modelFilename = selectedModelObj?.filename || null

  // Get LoRA config if selected
  const selectedLoraModel = store.selectedLora ? store.loras.find(l => l.path === store.selectedLora) : null
  // TODO: LoRA support requires custom workflow - for now just note it in params
  void selectedLoraModel

  const { width, height } = store.resolution
  const paramsStr = `${width}×${height}, ${store.steps} steps${store.batchSize > 1 ? `, batch ${store.batchSize}` : ''}${selectedLoraModel ? `, +${selectedLoraModel.name}` : ''}`

  const message = reactive<ChatMessage>({
    prompt: currentPrompt,
    params: paramsStr,
    images: [],
    loading: true,
  })
  messages.value.push(message)

  try {
    // Generate images (one at a time for batch, since API doesn't support batch_size yet)
    const generatePromises = Array(store.batchSize).fill(null).map(async () => {
      const response = await comfyuiApi.comfyuiGenerateApiComfyuiGeneratePost({
        generateRequest: {
          prompt: finalPrompt,
          negativePrompt: store.defaultNegativePrompt,
          model: modelFilename,
          width,
          height,
          steps: store.steps,
          cfg: 7.0,
          seed: -1,  // Random seed
          sampler: 'euler',
          scheduler: 'normal',
        }
      })

      if (response.success && response.images && response.images.length > 0) {
        // Add images to message as they complete
        for (const filename of response.images) {
          const imageUrl = `${config.basePath}/api/comfyui/image/${encodeURIComponent(filename)}`
          const img: GeneratedImage = {
            id: filename,
            url: imageUrl,
            prompt: currentPrompt,
            created_at: new Date().toISOString(),
          }
          message.images.push(img)
        }
      } else if (response.errors && Object.keys(response.errors).length > 0) {
        throw new Error(JSON.stringify(response.errors))
      }
    })

    await Promise.all(generatePromises)

    if (message.images.length === 0) {
      message.error = 'No images generated'
    }
  } catch (e: any) {
    console.error('Generate error:', e)
    message.error = e.message || 'Generation failed'
  } finally {
    message.loading = false
    generating.value = false
  }
}
</script>

<template>
  <v-container fluid class="fill-height pa-0 d-flex flex-column">
    <!-- Model switch overlay -->
    <v-overlay
      :model-value="store.switchingModel"
      class="align-center justify-center"
      persistent
    >
      <v-card class="pa-6 text-center" min-width="300">
        <v-progress-circular indeterminate color="primary" size="48" class="mb-4" />
        <div class="text-h6">{{ store.switchMessage || 'Switching model...' }}</div>
        <div class="text-caption text-grey mt-2">Model will load on next generation</div>
      </v-card>
    </v-overlay>

    <!-- Error snackbar -->
    <v-snackbar v-model="showError" color="error" timeout="5000">
      {{ store.switchError }}
    </v-snackbar>

    <!-- Success snackbar -->
    <v-snackbar v-model="showSuccess" color="success" timeout="3000">
      {{ store.switchMessage }}
    </v-snackbar>

    <!-- Chat area -->
    <v-container fluid class="flex-grow-1 overflow-y-auto pa-4">
      <div v-if="messages.length === 0" class="text-center text-grey mt-16">
        <v-icon size="64" color="grey-darken-1">mdi-auto-fix</v-icon>
        <p class="mt-4">Enter a prompt to generate images</p>
      </div>

      <div v-for="(msg, idx) in messages" :key="idx" class="mb-6">
        <v-chip color="primary" variant="tonal" class="mb-3">
          <span class="font-weight-medium">{{ msg.prompt }}</span>
          <span class="text-grey ml-2 text-caption">[{{ msg.params }}]</span>
        </v-chip>

        <div class="d-flex flex-wrap ga-3">
          <template v-if="msg.loading">
            <v-card
              v-for="i in store.batchSize - msg.images.length"
              :key="'loading-' + i"
              width="200"
              height="200"
              class="d-flex align-center justify-center"
            >
              <v-progress-circular indeterminate color="primary" />
            </v-card>
          </template>

          <v-card
            v-for="img in msg.images"
            :key="img.id"
            width="200"
            height="200"
            class="overflow-hidden"
          >
            <v-img
              :src="img.url"
              cover
              height="200"
            />
          </v-card>

          <v-alert v-if="msg.error" type="error" density="compact">
            {{ msg.error }}
          </v-alert>
        </div>
      </div>
    </v-container>

    <!-- Controls -->
    <v-sheet class="border-t px-4 py-3">
      <div class="d-flex flex-wrap align-center justify-center ga-4 mb-3">
        <div class="d-flex align-center ga-2">
          <span class="text-caption text-grey text-uppercase">Model</span>
          <v-select
            v-model="store.selectedModel"
            :items="modelItems"
            :loading="store.switchingModel"
            :disabled="store.switchingModel || generating"
            density="compact"
            hide-details
            style="width: 280px"
            @update:model-value="handleModelChange"
          >
            <template #selection="{ item }">
              <div class="d-flex align-center ga-2">
                <div v-if="item.raw.thumbnail" class="thumb-container thumb-sm">
                  <video v-if="item.raw.thumbnail_is_video" :src="item.raw.thumbnail" muted loop autoplay playsinline />
                  <img v-else :src="item.raw.thumbnail" />
                </div>
                <v-icon v-else size="24" color="grey">mdi-cube-outline</v-icon>
                <span class="text-truncate">{{ item.title }}</span>
              </div>
            </template>
            <template #item="{ item, props }">
              <v-list-item v-bind="props" :title="undefined">
                <template #prepend>
                  <div v-if="item.raw.thumbnail" class="thumb-container thumb-md mr-3">
                    <video v-if="item.raw.thumbnail_is_video" :src="item.raw.thumbnail" muted loop autoplay playsinline />
                    <img v-else :src="item.raw.thumbnail" />
                  </div>
                  <v-icon v-else size="32" color="grey" class="mr-3">mdi-cube-outline</v-icon>
                </template>
                <v-list-item-title>{{ item.title }}</v-list-item-title>
                <v-list-item-subtitle v-if="item.raw.base_model" class="text-caption">
                  {{ item.raw.base_model }}
                </v-list-item-subtitle>
              </v-list-item>
            </template>
          </v-select>
        </div>

        <div class="d-flex align-center ga-2">
          <span class="text-caption text-grey text-uppercase">LoRA</span>
          <v-select
            v-model="store.selectedLora"
            :items="loraItems"
            :disabled="generating"
            density="compact"
            hide-details
            style="width: 200px"
          >
            <template #selection="{ item }">
              <div class="d-flex align-center ga-2">
                <div v-if="item.raw.thumbnail" class="thumb-container thumb-sm">
                  <video v-if="item.raw.thumbnail_is_video" :src="item.raw.thumbnail" muted loop autoplay playsinline />
                  <img v-else :src="item.raw.thumbnail" />
                </div>
                <v-icon v-else size="24" color="grey">mdi-shimmer</v-icon>
                <span class="text-truncate">{{ item.title }}</span>
              </div>
            </template>
            <template #item="{ item, props }">
              <v-list-item v-bind="props" :title="undefined">
                <template #prepend>
                  <div v-if="item.raw.thumbnail" class="thumb-container thumb-md mr-3">
                    <video v-if="item.raw.thumbnail_is_video" :src="item.raw.thumbnail" muted loop autoplay playsinline />
                    <img v-else :src="item.raw.thumbnail" />
                  </div>
                  <v-icon v-else size="32" color="grey" class="mr-3">mdi-shimmer</v-icon>
                </template>
                <v-list-item-title>{{ item.title }}</v-list-item-title>
                <v-list-item-subtitle v-if="item.raw.triggers?.length" class="text-caption text-truncate">
                  {{ item.raw.triggers.slice(0, 2).join(', ') }}
                </v-list-item-subtitle>
              </v-list-item>
            </template>
          </v-select>
          <v-text-field
            v-model.number="store.loraWeight"
            type="number"
            min="0"
            max="2"
            step="0.1"
            density="compact"
            hide-details
            style="width: 70px"
            :disabled="!store.selectedLora || generating"
          />
        </div>

        <div class="resolution-grid rounded border pa-2">
          <div
            v-for="group in store.presetGroups"
            :key="group.label"
            class="d-flex align-center ga-2"
          >
            <span class="text-caption text-grey text-uppercase resolution-label">{{ group.label }}</span>
            <v-btn-toggle
              v-model="store.selectedPreset"
              mandatory
              density="compact"
              :disabled="generating"
              class="resolution-row"
            >
              <v-btn v-for="p in group.presets" :key="p.id" :value="p.id" size="small" class="resolution-btn">
                {{ p.label }}
              </v-btn>
            </v-btn-toggle>
          </div>
        </div>

        <div class="d-flex align-center ga-2">
          <span class="text-caption text-grey text-uppercase">Steps</span>
          <v-text-field
            v-model.number="store.steps"
            type="number"
            min="1"
            max="50"
            density="compact"
            hide-details
            style="width: 70px"
            :disabled="generating"
          />
        </div>

        <div class="d-flex align-center ga-2">
          <span class="text-caption text-grey text-uppercase">Batch</span>
          <v-text-field
            v-model.number="store.batchSize"
            type="number"
            min="1"
            max="8"
            density="compact"
            hide-details
            style="width: 70px"
            :disabled="generating"
          />
        </div>
      </div>

      <!-- Prompt input -->
      <div class="d-flex ga-3 mx-auto" style="max-width: 800px">
        <v-text-field
          v-model="prompt"
          placeholder="Describe what you want to generate..."
          density="comfortable"
          hide-details
          :disabled="generating"
          @keydown.enter="generate"
        />
        <v-btn
          color="secondary"
          size="large"
          :loading="generating"
          :disabled="!prompt.trim()"
          @click="generate"
        >
          Generate
        </v-btn>
      </div>
    </v-sheet>
  </v-container>
</template>

<style scoped>
.border-t {
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.resolution-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-color: rgba(255, 255, 255, 0.12) !important;
}

.resolution-label {
  width: 36px;
  text-align: left;
}

.resolution-row {
  display: grid !important;
  grid-template-columns: repeat(3, 100px);
  width: 300px;
}

.resolution-btn {
  width: 100px !important;
  min-width: 100px !important;
  max-width: 100px !important;
  justify-content: center;
}

/* Video/image thumbnail containers */
.thumb-container {
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}
.thumb-container img,
.thumb-container video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb-sm {
  width: 24px;
  height: 24px;
}
.thumb-md {
  width: 32px;
  height: 32px;
}
</style>
