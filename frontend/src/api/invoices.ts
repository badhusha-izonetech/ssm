import { fetchClient, keysToSnake, keysToCamel } from './client'
import type { Invoice } from '../types/models'

export const invoicesApi = {
  getAll: async () => keysToCamel(await fetchClient('/invoices/')),
  getNextNumber: async (): Promise<{ nextInvoiceNumber: string }> => keysToCamel(await fetchClient('/invoices/next-number')),
  create: async (data: Partial<Invoice>) => keysToCamel(await fetchClient('/invoices/', { method: 'POST', body: JSON.stringify(keysToSnake(data)) })),
  update: async (id: string, data: Partial<Invoice>) => keysToCamel(await fetchClient(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(keysToSnake(data)) })),
  resequence: async () => keysToCamel(await fetchClient('/invoices/resequence', { method: 'POST' })),
  bulkSync: async (invoices: Partial<Invoice>[]) => keysToCamel(await fetchClient('/invoices/bulk-sync', { method: 'POST', body: JSON.stringify({ invoices: keysToSnake(invoices) }) })),
}
