import {
  Configuration,
  CivitAIApi,
  DatabaseApi,
  DefaultApi,
  DownloadApi,
  GalleryApi,
  SearchApi,
  BASE_PATH,
} from '@saiden/tensors'

// In production: use proxy (no API key needed, worker adds it)
// In development: use direct API with key
const config = new Configuration({
  basePath: import.meta.env.VITE_API_URL || BASE_PATH,
  apiKey: import.meta.env.VITE_API_KEY || undefined,
})

// Export configured API instances
export const civitaiApi = new CivitAIApi(config)
export const databaseApi = new DatabaseApi(config)
export const defaultApi = new DefaultApi(config)
export const downloadApi = new DownloadApi(config)
export const galleryApi = new GalleryApi(config)
export const searchApi = new SearchApi(config)

// Re-export for custom use
export { Configuration, BASE_PATH, config }
