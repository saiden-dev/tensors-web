import {
  Configuration,
  CivitAIApi,
  ComfyUIAPIApi,
  DatabaseApi,
  DefaultApi,
  DownloadApi,
  GalleryApi,
  SearchApi,
  BASE_PATH,
} from '@saiden/tensors'

// Production: use gateway (handles CORS + adds API key server-side)
// Development: set VITE_API_URL in .env to use direct API
//
// VITE_API_URL takes precedence if set (for local dev with direct API)
// Otherwise defaults to gateway (for production deployment)
const DEFAULT_API = 'https://gw.saiden.dev'

const config = new Configuration({
  basePath: import.meta.env.VITE_API_URL || DEFAULT_API,
  apiKey: import.meta.env.VITE_API_KEY || undefined,
  credentials: 'include', // Send cookies for cross-origin requests
})

// Export configured API instances
export const civitaiApi = new CivitAIApi(config)
export const comfyuiApi = new ComfyUIAPIApi(config)
export const databaseApi = new DatabaseApi(config)
export const defaultApi = new DefaultApi(config)
export const downloadApi = new DownloadApi(config)
export const galleryApi = new GalleryApi(config)
export const searchApi = new SearchApi(config)

// Re-export for custom use
export { Configuration, BASE_PATH, config }
