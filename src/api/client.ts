/**
 * API Client - Wrapper around @saiden/tensors generated client
 *
 * Provides a simplified interface maintaining backwards compatibility
 * while using the generated OpenAPI client under the hood.
 */

import {
  civitaiApi,
  databaseApi,
  downloadApi,
  galleryApi,
  searchApi,
} from './config'
import type { Model, LoRA, GeneratedImage, GalleryImage, CivitaiModel } from '@/types'

// Re-export types for convenience
export type { Model, LoRA, GeneratedImage, GalleryImage, CivitaiModel }

// ============================================================================
// Models
// ============================================================================

export async function getModels(): Promise<{ models: Model[]; total: number }> {
  const result = await databaseApi.searchModelsApiDbModelsGet({ type: 'Checkpoint' }) as any
  return { models: result.items || [], total: result.total || 0 }
}

export async function getLoras(): Promise<{ loras: LoRA[]; total: number }> {
  const result = await databaseApi.searchModelsApiDbModelsGet({ type: 'LORA' }) as any
  return { loras: result.items || [], total: result.total || 0 }
}

export interface ServerStatus {
  service: string
  active: boolean
  status: string
  current_model: string | null
  host: string | null
  port: string | null
}

export async function getActiveModel(): Promise<{ loaded: boolean; model: string | null }> {
  // This endpoint may not be in the generated client - use raw fetch as fallback
  const response = await fetch('/api/models/active')
  if (!response.ok) throw new Error(response.statusText)
  return response.json()
}

export async function switchModel(model: string): Promise<{ ok: boolean; old_model: string; new_model: string }> {
  // This endpoint may not be in the generated client - use raw fetch as fallback
  const response = await fetch('/api/models/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  })
  if (!response.ok) throw new Error(response.statusText)
  return response.json()
}

export async function getServerStatus(): Promise<ServerStatus> {
  const response = await fetch('/api/models/status')
  if (!response.ok) throw new Error(response.statusText)
  return response.json()
}

export async function rebootComfyUI(): Promise<{ ok: boolean; message: string }> {
  const response = await fetch('/api/models/reboot', { method: 'POST' })
  if (!response.ok) throw new Error(response.statusText)
  return response.json()
}

// ============================================================================
// Generation
// ============================================================================

export interface LoraConfig {
  path: string
  multiplier: number
}

export interface GenerateParams {
  prompt: string
  negative_prompt?: string
  width: number
  height: number
  steps: number
  cfg_scale?: number
  seed?: number
  save_to_gallery?: boolean
  lora?: LoraConfig
}

export async function generate(params: GenerateParams): Promise<{ images: GeneratedImage[] }> {
  // Generation endpoint - use raw fetch
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || response.statusText)
  }
  return response.json()
}

// ============================================================================
// Gallery
// ============================================================================

export async function getImages(limit = 100): Promise<{ images: GalleryImage[] }> {
  const result = await galleryApi.listImagesApiImagesGet({ limit }) as any
  return { images: result.images || [] }
}

export async function deleteImage(id: string): Promise<void> {
  await galleryApi.deleteImageApiImagesImageIdDelete({ imageId: id })
}

export function getImageUrl(id: string): string {
  return `/api/images/${id}`
}

// ============================================================================
// CivitAI Search
// ============================================================================

export interface SearchParams {
  query?: string
  types?: string
  baseModels?: string
  sort?: string
  limit?: number
}

export async function searchCivitai(params: SearchParams): Promise<{ items: CivitaiModel[] }> {
  const result = await searchApi.searchModelsApiSearchGet({
    query: params.query || undefined,
    types: params.types || undefined,
    baseModels: params.baseModels || undefined,
    sort: params.sort as any,
    limit: params.limit,
  }) as any
  return { items: result.items || [] }
}

export async function getCivitaiModel(id: number): Promise<CivitaiModel> {
  return civitaiApi.getModelApiCivitaiModelModelIdGet({ modelId: id })
}

// ============================================================================
// Download
// ============================================================================

export interface DownloadResponse {
  download_id: string
  status: string
  version_id: number
  destination: string
  model_name: string
  version_name: string
}

export interface DownloadStatus {
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

export async function downloadModel(modelId?: number, versionId?: number): Promise<DownloadResponse> {
  const result = await downloadApi.startDownloadApiDownloadPost({
    downloadRequest: { modelId, versionId },
  })
  return result as DownloadResponse
}

export async function getDownloadStatus(downloadId: string): Promise<DownloadStatus> {
  const result = await downloadApi.getDownloadStatusApiDownloadStatusDownloadIdGet({
    downloadId,
  })
  return result as DownloadStatus
}

export async function getActiveDownloads(): Promise<{ downloads: DownloadStatus[]; total: number }> {
  const result = await downloadApi.listActiveDownloadsApiDownloadActiveGet() as any
  return { downloads: result.downloads || [], total: result.total || 0 }
}
