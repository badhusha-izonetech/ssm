import { fetchClient, keysToCamel, keysToSnake } from './client'
import type { EbApplication, EbDashboardCounters, EbStageHistory, EbDocument } from '../types/models'

export const ebApplicationsApi = {
  getAll: async (search?: string, stage?: string): Promise<EbApplication[]> => {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (stage) params.append('stage', stage)
    const res = await fetchClient(`/eb-applications?${params.toString()}`)
    return keysToCamel(res.items) as EbApplication[]
  },

  uploadDocument: async (id: string, file: File, documentType: string, remarks?: string): Promise<EbDocument> => {
    const formData = new FormData()
    formData.append('document_type', documentType)
    if (remarks) formData.append('remarks', remarks)
    formData.append('file', file)
    
    // We can't use fetchClient here easily because fetchClient stringifies body, 
    // but fetchClient might have support for FormData? Let's check `client.ts` in a second.
    // If not, we can just write a raw fetch or use fetchClient with body: formData
    const res = await fetchClient(`/eb-applications/${id}/documents`, {
      method: 'POST',
      body: formData,
    })
    return keysToCamel(res) as EbDocument
  },

  getDashboardCounters: async (): Promise<EbDashboardCounters> => {
    const res = await fetchClient('/eb-applications/dashboard')
    return res as EbDashboardCounters
  },

  getById: async (id: string): Promise<EbApplication> => {
    const res = await fetchClient(`/eb-applications/${id}`)
    return keysToCamel(res) as EbApplication
  },

  getHistory: async (id: string): Promise<EbStageHistory[]> => {
    const res = await fetchClient(`/eb-applications/${id}/history`)
    return keysToCamel(res) as EbStageHistory[]
  },

  verifyDocuments: async (id: string, status: 'VERIFIED' | 'NOT_VERIFIED', reason?: string): Promise<EbApplication> => {
    const res = await fetchClient(`/eb-applications/${id}/verify`, {
      method: 'PATCH',
      body: JSON.stringify(keysToSnake({ status, reason })),
    })
    return keysToCamel(res) as EbApplication
  },

  submitPortal: async (id: string, referenceNumber?: string, remarks?: string): Promise<EbApplication> => {
    const res = await fetchClient(`/eb-applications/${id}/portal-submit`, {
      method: 'PATCH',
      body: JSON.stringify(keysToSnake({ referenceNumber, remarks })),
    })
    return keysToCamel(res) as EbApplication
  },

  handover: async (id: string, meterSupplyDetails?: string, remarks?: string): Promise<EbApplication> => {
    const res = await fetchClient(`/eb-applications/${id}/handover`, {
      method: 'PATCH',
      body: JSON.stringify(keysToSnake({ meterSupplyDetails, remarks })),
    })
    return keysToCamel(res) as EbApplication
  },
}
