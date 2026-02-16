import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Model, LoRA, ResolutionPreset } from '@/types'
import { databaseApi, downloadApi, civitaiApi } from '@/api/client'

interface DownloadStatus {
  id: string
  version_id: number
  status: 'queued' | 'downloading' | 'completed' | 'failed'
  path: string
  filename: string
  model_name: string
  version_name: string
  downloaded?: number
  total?: number
  progress?: number
  speed?: number
  downloaded_str?: string
  total_str?: string
  speed_str?: string
  error?: string
}

export const useAppStore = defineStore('app', () => {
  // Navigation
  const currentView = ref<'generate' | 'search' | 'gallery'>('generate')

  // Downloads
  const downloads = ref<DownloadStatus[]>([])
  const showDownloadsPanel = ref(false)
  let downloadPollInterval: ReturnType<typeof setInterval> | null = null

  // Models
  const models = ref<Model[]>([])
  const loras = ref<LoRA[]>([])
  const activeModel = ref<string | null>(null)
  const selectedModel = ref<string>('')
  const selectedLora = ref<string>('')
  const loraWeight = ref(0.8)

  // Generation settings
  const selectedPreset = ref('768-3:4')
  const steps = ref(20)
  const batchSize = ref(1)

  // Default quality prompts (applied automatically)
  const defaultQualityTags = 'masterpiece, best quality, absurdres, highres'
  const defaultNegativePrompt = 'bad anatomy, bad hands, missing fingers, extra fingers, extra digit, fewer digits, extra limbs, missing limbs, fused fingers, too many fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, ugly, blurry, bad proportions, gross proportions, malformed limbs, long neck, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, text, error'

  // All resolution presets (base size × aspect ratio)
  const resolutionPresets: ResolutionPreset[] = [
    // 512 base
    { id: '512-3:4', ratio: '3:4', width: 384, height: 512, label: '384×512' },
    { id: '512-1:1', ratio: '1:1', width: 512, height: 512, label: '512×512' },
    { id: '512-4:3', ratio: '4:3', width: 512, height: 384, label: '512×384' },
    // 768 base
    { id: '768-3:4', ratio: '3:4', width: 576, height: 768, label: '576×768' },
    { id: '768-1:1', ratio: '1:1', width: 768, height: 768, label: '768×768' },
    { id: '768-4:3', ratio: '4:3', width: 768, height: 576, label: '768×576' },
    // 1024 base
    { id: '1024-3:4', ratio: '3:4', width: 768, height: 1024, label: '768×1024' },
    { id: '1024-1:1', ratio: '1:1', width: 1024, height: 1024, label: '1024×1024' },
    { id: '1024-4:3', ratio: '4:3', width: 1024, height: 768, label: '1024×768' },
  ]

  const resolution = computed(() => {
    const preset = resolutionPresets.find(p => p.id === selectedPreset.value)
    return preset ? { width: preset.width, height: preset.height } : { width: 768, height: 1024 }
  })

  // Presets grouped by base size for 3-row display
  const presetGroups = [
    { label: 'low', presets: resolutionPresets.filter(p => p.id.startsWith('512-')) },
    { label: 'mid', presets: resolutionPresets.filter(p => p.id.startsWith('768-')) },
    { label: 'high', presets: resolutionPresets.filter(p => p.id.startsWith('1024-')) },
  ]

  // Computed: selected model's category
  const selectedModelCategory = computed(() => {
    const model = models.value.find(m => m.path === selectedModel.value || m.name === selectedModel.value)
    return model?.category || 'large'
  })

  // Computed: LoRAs filtered by selected model category
  const filteredLoras = computed(() => {
    return loras.value.filter(l => l.category === selectedModelCategory.value)
  })

  // Loading states
  const loadingModels = ref(false)
  const switchingModel = ref(false)
  const switchMessage = ref<string | null>(null)
  const switchError = ref<string | null>(null)

  // Actions
  // Cache for thumbnail URLs fetched from CivitAI
  const thumbnailCache = new Map<number, string>()

  // Fetch thumbnails from CivitAI API (async, updates models in place)
  async function loadThumbnails(files: any[]) {
    const modelIds = [...new Set(files.map(f => f.civitai_model_id).filter(Boolean))]

    for (const modelId of modelIds) {
      if (thumbnailCache.has(modelId)) {
        updateThumbnail(modelId, thumbnailCache.get(modelId)!)
        continue
      }

      try {
        const modelInfo = await civitaiApi.getModelApiCivitaiModelModelIdGet({ modelId }) as any
        const images = modelInfo?.modelVersions?.[0]?.images || []
        // Prefer images over videos for dropdown thumbnails (videos don't autoplay)
        const firstImage = images.find((img: any) => img.type !== 'video')
        const firstVideo = images.find((img: any) => img.type === 'video')
        const media = firstImage || firstVideo
        if (media?.url) {
          const isVideo = media.type === 'video'
          // Use smaller width for thumbnails
          const thumbnailUrl = media.url.replace('/original=true/', '/width=128/')
          thumbnailCache.set(modelId, thumbnailUrl)
          updateThumbnail(modelId, thumbnailUrl, isVideo)
        }
      } catch (e) {
        console.warn(`Failed to fetch thumbnail for model ${modelId}:`, e)
      }
    }
  }

  // Update thumbnail URL for all models/loras with given civitai_model_id
  function updateThumbnail(modelId: number, url: string, isVideo = false) {
    models.value = models.value.map(m =>
      m.civitai_model_id === modelId ? { ...m, thumbnail_url: url, thumbnail_is_video: isVideo } : m
    )
    loras.value = loras.value.map(l =>
      l.civitai_model_id === modelId ? { ...l, thumbnail_url: url, thumbnail_is_video: isVideo } : l
    )
  }

  // Helper to format display name
  function formatDisplayName(f: any): string {
    if (f.model_name && f.version_name) {
      return `${f.model_name} (${f.version_name})`
    }
    if (f.model_name) return f.model_name
    if (f.version_name) return f.version_name
    return f.file_path.split('/').pop()?.replace('.safetensors', '') || 'Unknown'
  }

  async function loadModels() {
    loadingModels.value = true
    try {
      // Fetch local files from the database
      const files = await databaseApi.listFilesApiDbFilesGet() as any[]

      // Separate checkpoints and LoRAs by path
      const checkpointFiles = files.filter((f: any) =>
        f.file_path?.includes('/checkpoints/') || f.file_path?.includes('\\checkpoints\\')
      )
      const loraFiles = files.filter((f: any) =>
        f.file_path?.includes('/loras/') || f.file_path?.includes('\\loras\\')
      )

      // Dedupe by sha256 (prefer files with metadata)
      const dedupeByHash = (files: any[]) => {
        const byHash = new Map<string, any>()
        for (const f of files) {
          const existing = byHash.get(f.sha256)
          // Keep the one with more metadata, or first seen
          if (!existing || (f.model_name && !existing.model_name)) {
            byHash.set(f.sha256, f)
          }
        }
        return Array.from(byHash.values())
      }

      // Map to the Model/LoRA format expected by the UI
      const dedupedCheckpoints = dedupeByHash(checkpointFiles)
      const dedupedLoras = dedupeByHash(loraFiles)

      models.value = dedupedCheckpoints.map((f: any) => ({
        name: f.model_name || f.file_path.split('/').pop()?.replace('.safetensors', '') || 'Unknown',
        path: f.file_path,
        filename: f.file_path.split('/').pop() || '',
        size_mb: 0,
        modified: 0,
        category: f.base_model?.includes('XL') || f.base_model?.includes('Pony') ? 'large' : 'sd15',
        display_name: formatDisplayName(f),
        base_model: f.base_model,
        civitai_model_id: f.civitai_model_id,
        civitai_version_id: f.civitai_version_id,
        thumbnail_url: undefined, // Will be loaded async
        thumbnail_is_video: false,
      }))

      loras.value = dedupedLoras.map((f: any) => ({
        name: f.model_name || f.file_path.split('/').pop()?.replace('.safetensors', '') || 'Unknown',
        path: f.file_path,
        filename: f.file_path.split('/').pop() || '',
        size_mb: 0,
        modified: 0,
        category: f.base_model?.includes('XL') || f.base_model?.includes('Pony') ? 'large' : 'sd15',
        display_name: formatDisplayName(f),
        base_model: f.base_model,
        civitai_model_id: f.civitai_model_id,
        civitai_version_id: f.civitai_version_id,
        thumbnail_url: undefined, // Will be loaded async
        thumbnail_is_video: false,
      }))

      // Fetch thumbnails async (don't block UI)
      loadThumbnails([...dedupedCheckpoints, ...dedupedLoras])
    } catch (error) {
      console.error('Failed to load models:', error)
    } finally {
      loadingModels.value = false
    }
  }

  // Downloads - computed
  const activeDownloads = computed(() =>
    downloads.value.filter(d => d.status === 'downloading' || d.status === 'queued')
  )
  const hasActiveDownloads = computed(() => activeDownloads.value.length > 0)

  // Downloads - actions
  async function pollDownloads() {
    try {
      const res = await downloadApi.listActiveDownloadsApiDownloadActiveGet() as any
      downloads.value = res.downloads || []
    } catch (e) {
      console.error('Failed to poll downloads:', e)
    }
  }

  function startDownloadPolling() {
    if (downloadPollInterval) return
    pollDownloads() // Initial fetch
    downloadPollInterval = setInterval(pollDownloads, 1000)
  }

  function stopDownloadPolling() {
    if (downloadPollInterval) {
      clearInterval(downloadPollInterval)
      downloadPollInterval = null
    }
  }

  async function startDownload(versionId: number): Promise<string | null> {
    try {
      const response = await downloadApi.startDownloadApiDownloadPost({
        downloadRequest: { versionId },
      }) as any
      startDownloadPolling()
      showDownloadsPanel.value = true
      return response.download_id
    } catch (e: any) {
      console.error('Failed to start download:', e)
      return null
    }
  }

  function isDownloading(versionId: number): boolean {
    return downloads.value.some(
      d => d.version_id === versionId && (d.status === 'downloading' || d.status === 'queued')
    )
  }

  function getDownloadProgress(versionId: number): DownloadStatus | undefined {
    return downloads.value.find(d => d.version_id === versionId)
  }

  async function switchModel(modelPath: string) {
    // Just update the selected model - no API call needed
    selectedModel.value = modelPath
  }

  return {
    // Navigation
    currentView,

    // Models
    models,
    loras,
    filteredLoras,
    activeModel,
    selectedModel,
    selectedModelCategory,
    selectedLora,
    loraWeight,

    // Generation settings
    selectedPreset,
    resolutionPresets,
    presetGroups,
    steps,
    batchSize,
    resolution,
    defaultQualityTags,
    defaultNegativePrompt,

    // Loading states
    loadingModels,
    switchingModel,
    switchMessage,
    switchError,

    // Downloads
    downloads,
    activeDownloads,
    hasActiveDownloads,
    showDownloadsPanel,

    // Actions
    loadModels,
    switchModel,
    startDownload,
    pollDownloads,
    startDownloadPolling,
    stopDownloadPolling,
    isDownloading,
    getDownloadProgress,
  }
})
