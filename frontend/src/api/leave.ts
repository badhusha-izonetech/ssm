import { fetchClient, keysToCamel, keysToSnake } from './client'
import type { LeaveRequest } from '../types/models'

export const leaveApi = {
  getAll: async (status?: string): Promise<LeaveRequest[]> => {
    const query = status ? `?status=${encodeURIComponent(status)}` : ''
    const res = await fetchClient(`/leave${query}`)
    return keysToCamel(res.items) as LeaveRequest[]
  },

  submit: async (data: { leaveType: string; fromDate: string; toDate: string; reason: string }): Promise<LeaveRequest> => {
    const res = await fetchClient('/leave', {
      method: 'POST',
      body: JSON.stringify(keysToSnake(data)),
    })
    return keysToCamel(res) as LeaveRequest
  },

  approve: async (id: string, remarks?: string): Promise<LeaveRequest> => {
    const res = await fetchClient(`/leave/${id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ remarks }),
    })
    return keysToCamel(res) as LeaveRequest
  },

  reject: async (id: string, remarks?: string): Promise<LeaveRequest> => {
    const res = await fetchClient(`/leave/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ remarks }),
    })
    return keysToCamel(res) as LeaveRequest
  }
}
