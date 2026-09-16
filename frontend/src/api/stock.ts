import { fetchClient, keysToCamel, keysToSnake } from './client'
import type { StockItem } from '../types/models'

export const stockApi = {
  getAllItems: async (): Promise<StockItem[]> => {
    const res = await fetchClient('/stock?page_size=500')
    return keysToCamel(res.items) as StockItem[]
  },
  getRequests: async (): Promise<any[]> => {
    const res = await fetchClient('/stock/requests')
    return keysToCamel(res) as any[]
  },
  getGroupedRequests: async (): Promise<any[]> => {
    const res = await fetchClient('/stock/requests/grouped')
    return keysToCamel(res) as any[]
  },
  getTransactions: async (): Promise<any[]> => {
    const res = await fetchClient('/stock/transactions')
    return keysToCamel(res) as any[]
  },
  requestStock: async (itemId: string, projectId: string, quantity: number, notes?: string): Promise<any> => {
    const payload = { project_id: projectId, quantity, notes }
    const res = await fetchClient(`/stock/${itemId}/request`, { method: 'POST', body: JSON.stringify(payload) })
    return keysToCamel(res)
  },
  cancelStockRequest: async (reservationId: string): Promise<void> => {
    await fetchClient(`/stock/requests/${reservationId}`, { method: 'DELETE' })
  },
  reserveStock: async (itemId: string, reservationId: string, notes?: string): Promise<any> => {
    const payload = { reservation_id: reservationId, notes }
    const res = await fetchClient(`/stock/${itemId}/reserve`, { method: 'POST', body: JSON.stringify(payload) })
    return keysToCamel(res)
  },
  issueStock: async (itemId: string, reservationId: string, quantity: number, notes?: string): Promise<any> => {
    const payload = { reservation_id: reservationId, quantity, notes }
    const res = await fetchClient(`/stock/${itemId}/issue`, { method: 'POST', body: JSON.stringify(payload) })
    return keysToCamel(res)
  },
  reserveProjectStock: async (projectId: string): Promise<any> => {
    const res = await fetchClient(`/stock/requests/grouped/${projectId}/reserve`, { method: 'POST' })
    return keysToCamel(res)
  },
  createItem: async (payload: any): Promise<any> => {
    const res = await fetchClient('/stock', { method: 'POST', body: JSON.stringify(payload) })
    return keysToCamel(res)
  },
  stockIn: async (itemId: string, quantity: number, reference?: string, notes?: string): Promise<any> => {
    const payload = { quantity, reference, notes }
    const res = await fetchClient(`/stock/${itemId}/stock-in`, { method: 'POST', body: JSON.stringify(payload) })
    return keysToCamel(res)
  },
  returnStock: async (itemId: string, projectId: string, quantity: number, notes?: string): Promise<any> => {
    const payload = { project_id: projectId, quantity, notes }
    const res = await fetchClient(`/stock/${itemId}/return`, { method: 'POST', body: JSON.stringify(payload) })
    return keysToCamel(res)
  },
  updateItem: async (itemId: string, payload: any): Promise<StockItem> => {
    const res = await fetchClient(`/stock/${itemId}`, { method: 'PATCH', body: JSON.stringify(keysToSnake(payload)) })
    return keysToCamel(res) as StockItem
  }
}
