import { fetchClient, keysToCamel, keysToSnake } from './client'
import type { Quotation } from '../types/models'

export const quotationsApi = {
  getDashboard: async (params?: { search?: string, status?: string, fromDate?: string, toDate?: string, page?: number, limit?: number }): Promise<any> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);
    if (params?.fromDate) query.append('from_date', params.fromDate);
    if (params?.toDate) query.append('to_date', params.toDate);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    
    const qs = query.toString();
    const res = await fetchClient(`/quotations/dashboard${qs ? `?${qs}` : ''}`);
    return keysToCamel(res);
  },
  getAll: async (): Promise<Quotation[]> => {
    const res = await fetchClient('/quotations')
    return keysToCamel(res.items) as Quotation[]
  },
  create: async (data: any): Promise<Quotation> => {
    const res = await fetchClient('/quotations', {
      method: 'POST',
      body: JSON.stringify(keysToSnake(data)),
    })
    return keysToCamel(res) as Quotation
  },
  getById: async (id: string): Promise<Quotation> => {
    const res = await fetchClient(`/quotations/${id}`)
    return keysToCamel(res) as Quotation
  },
  update: async (id: string, data: any): Promise<Quotation> => {
    const res = await fetchClient(`/quotations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(keysToSnake(data)),
    })
    return keysToCamel(res) as Quotation
  },
  revise: async (id: string, data: any): Promise<Quotation> => {
    const res = await fetchClient(`/quotations/${id}/revise`, {
      method: 'POST',
      body: JSON.stringify(keysToSnake(data)),
    })
    return keysToCamel(res) as Quotation
  },
  updateStatus: async (id: string, status: string): Promise<Quotation> => {
    const res = await fetchClient(`/quotations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    return keysToCamel(res) as Quotation
  },
  delete: async (id: string): Promise<void> => {
    await fetchClient(`/quotations/${id}`, {
      method: 'DELETE',
    })
  },
  getPrefill: async (leadId: string): Promise<any[]> => {
    const res = await fetchClient(`/quotations/prefill/${leadId}`)
    return keysToCamel(res) as any[]
  }
}
