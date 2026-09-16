import { fetchClient, keysToCamel } from './client'
import type { Notification } from '../types/models'

export const notificationsApi = {
  getAll: async (): Promise<Notification[]> => {
    const res = await fetchClient('/notifications')
    return keysToCamel(res.items) as Notification[]
  },
  markRead: async (id: string): Promise<void> => {
    await fetchClient(`/notifications/${id}/read`, { method: 'PATCH' })
  },
  markAllRead: async (): Promise<void> => {
    await fetchClient('/notifications/read-all', { method: 'PATCH' })
  },
  clearAll: async (): Promise<void> => {
    await fetchClient('/notifications/clear-all', { method: 'DELETE' })
  }
}
