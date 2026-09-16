import { fetchClient, keysToCamel, keysToSnake } from './client'
import type { Payment } from '../types/models'

export const paymentsApi = {
  getAll: async (): Promise<Payment[]> => {
    const res = await fetchClient('/payments')
    return keysToCamel(res.items) as Payment[]
  },
  create: async (data: any): Promise<Payment> => {
    const res = await fetchClient('/payments', {
      method: 'POST',
      body: JSON.stringify(keysToSnake(data)),
    })
    return keysToCamel(res) as Payment
  },
  update: async (id: string, data: any): Promise<Payment> => {
    const res = await fetchClient(`/payments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(keysToSnake(data)),
    })
    return keysToCamel(res) as Payment
  },
  verify: async (
    id: string,
    action: 'Verify' | 'Reject' | 'Partial',
    opts: { actualAmount?: number; paymentMode?: string; remarks?: string; followUpDate?: string; customerName?: string; projectId?: string; quotationId?: string; paymentType?: string },
  ): Promise<Payment> => {
    const path = action === 'Verify' ? 'verify' : action === 'Reject' ? 'reject' : 'partial'
    const res = await fetchClient(`/payments/${id}/${path}`, {
      method: 'PATCH',
      body: JSON.stringify(keysToSnake(opts)),
    })
    return keysToCamel(res) as Payment
  },
  setFollowUp: async (id: string, followUpDate: string): Promise<Payment> => {
    const res = await fetchClient(`/payments/${id}/follow_up`, {
      method: 'PATCH',
      body: JSON.stringify(keysToSnake({ followUpDate })),
    })
    return keysToCamel(res) as Payment
  },
  uploadProof: async (id: string, file: Blob, filename: string = 'proof.jpg'): Promise<{ id: string; fileUrl: string }> => {
    const formData = new FormData()
    formData.append('file', file, filename)
    const res = await fetchClient(`/payments/${id}/proof`, {
      method: 'POST',
      body: formData,
    })
    return keysToCamel(res)
  }
}
