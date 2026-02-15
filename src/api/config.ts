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

// Use the default API host (https://tensors-api.saiden.dev)
const config = new Configuration({
  apiKey: 'MSNwQry7W1L3vXMkrPiDgd0ty4EADHO',
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
