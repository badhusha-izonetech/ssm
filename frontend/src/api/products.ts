import { fetchClient, keysToCamel, keysToSnake } from './client'
import type { Product } from '../types/models'

export const productsApi = {
  getAll: async (params?: { category?: string; includeInactive?: boolean }): Promise<Product[]> => {
    const query = new URLSearchParams()
    if (params?.category) query.append('category', params.category)
    if (params?.includeInactive) query.append('include_inactive', 'true')
    
    const qs = query.toString() ? `?${query.toString()}` : ''
    const res = await fetchClient(`/products${qs}`)
    return keysToCamel(res.items) as Product[]
  },

  getById: async (id: string): Promise<Product> => {
    const res = await fetchClient(`/products/${id}`)
    return keysToCamel(res) as Product
  },

  create: async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> => {
    const res = await fetchClient('/products', {
      method: 'POST',
      body: JSON.stringify(keysToSnake(data)),
    })
    return keysToCamel(res) as Product
  },

  update: async (id: string, data: Partial<Product>): Promise<Product> => {
    const res = await fetchClient(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(keysToSnake(data)),
    })
    return keysToCamel(res) as Product
  },

  delete: async (id: string): Promise<void> => {
    await fetchClient(`/products/${id}`, {
      method: 'DELETE',
    })
  },
}
