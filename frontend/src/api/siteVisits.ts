import { fetchClient, API_BASE_URL, keysToSnake, keysToCamel } from './client'
import type { SiteVisit } from '../types/models'

export const siteVisitsApi = {
  getAll: async (ceoOverride?: boolean) => {
    const res = await fetchClient(`/site-visits${ceoOverride ? '?ceo_override=true' : ''}`)
    return keysToCamel(res) as SiteVisit[]
  },
  
  getMarketingSiteProducts: async () => {
    const res = await fetchClient('/site-visits/marketing-site-products')
    return keysToCamel(res) as SiteVisit[]
  },

  create: async (payload: any) => {
    const res = await fetchClient('/site-visits', {
      method: 'POST',
      body: JSON.stringify(keysToSnake(payload)),
    })
    return keysToCamel(res) as SiteVisit
  },
  
  start: async (id: string, payload: { latitude: number; longitude: number; accuracy: number }) => {
    const res = await fetchClient(`/site-visits/${id}/start`, {
      method: 'POST',
      body: JSON.stringify(keysToSnake(payload)),
    })
    return keysToCamel(res) as SiteVisit
  },
  
  trackLocation: (id: string, payload: { latitude: number; longitude: number; accuracy: number; captured_at: string }) => {
    return fetchClient(`/site-visits/${id}/location`, {
      method: 'POST',
      body: JSON.stringify(keysToSnake(payload)),
    })
  },
  
  uploadPhoto: async (id: string, blob: Blob, lat: number, lng: number, accuracy: number, stage?: string) => {
    const formData = new FormData()
    formData.append('file', blob, 'capture.jpg')
    formData.append('latitude', lat.toString())
    formData.append('longitude', lng.toString())
    formData.append('accuracy', accuracy.toString())
    formData.append('captured_at', new Date().toISOString())
    if (stage) {
      formData.append('stage', stage)
    }
    
    // Using native fetch because fetchClient stringifies body if it's not FormData
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${API_BASE_URL}/site-visits/${id}/photos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Upload failed')
    }
    return res.json()
  },
  
  getProjectStages: async (systemType: string): Promise<string[]> => {
    const res = await fetchClient(`/site-visits/project-stages?system_type=${encodeURIComponent(systemType)}`)
    // Backend returns a plain array
    return Array.isArray(res) ? res : (res.stages || [])
  },

  completeStage: async (id: string, stage: string) => {
    const res = await fetchClient(`/site-visits/${id}/stages/complete`, {
      method: 'POST',
      body: JSON.stringify({ stage }),
    })
    return keysToCamel(res) as SiteVisit
  },
  
  complete: async (id: string, payload: any) => {
    const res = await fetchClient(`/site-visits/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(keysToSnake(payload)),
    })
    return keysToCamel(res) as SiteVisit
  },
  
  addEvidence: async (id: string, payload: any) => {
    const res = await fetchClient(`/site-visits/${id}/evidence`, {
      method: 'PATCH',
      body: JSON.stringify(keysToSnake(payload)),
    })
    return keysToCamel(res) as SiteVisit
  },

  uploadEvidenceFile: async (id: string, file: File, type: 'photo' | 'video' | 'measurementImage' | 'document') => {
    const token = localStorage.getItem('access_token')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('file_type', type)
    const res = await fetch(`${API_BASE_URL}/site-visits/${id}/evidence/files`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Failed to upload ${type}`)
    }
    return keysToCamel(await res.json()) as SiteVisit
  },

  uploadToolPhoto: async (id: string, blob: Blob, type: 'before' | 'after'): Promise<SiteVisit> => {
    const token = localStorage.getItem('access_token')
    const formData = new FormData()
    formData.append('file', blob, 'tool_photo.jpg')
    const res = await fetch(`${API_BASE_URL}/site-visits/${id}/tools/${type}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Tool photo upload failed')
    }
    return keysToCamel(await res.json()) as SiteVisit
  },

  submitVisit: async (id: string): Promise<SiteVisit> => {
    const res = await fetchClient(`/site-visits/${id}/submit`, { method: 'POST' })
    return keysToCamel(res) as SiteVisit
  }
}
