import {
  Configuration,
  CivitAIApi,
  DatabaseApi,
  DefaultApi,
  DownloadApi,
  GalleryApi,
  SearchApi,
} from '@saiden/tensors'

// API configuration - uses relative paths for same-origin requests (proxied by Vite in dev)
const config = new Configuration({
  basePath: '',
})

// Export configured API instances
export const civitaiApi = new CivitAIApi(config)
export const databaseApi = new DatabaseApi(config)
export const defaultApi = new DefaultApi(config)
export const downloadApi = new DownloadApi(config)
export const galleryApi = new GalleryApi(config)
export const searchApi = new SearchApi(config)

// Re-export Configuration for custom use
export { Configuration }
