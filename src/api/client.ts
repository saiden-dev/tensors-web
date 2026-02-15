/**
 * API Client - Wrapper around @saiden/tensors generated client
 */

import {
  civitaiApi,
  databaseApi,
  downloadApi,
  galleryApi,
  searchApi,
  config,
} from './config'

// Re-export API instances
export { civitaiApi, databaseApi, downloadApi, galleryApi, searchApi }

// Image URL helper
export function getImageUrl(id: string): string {
  return `${config.basePath}/api/images/${id}`
}
