import { fetchClient, keysToCamel } from './client'

export const activityApi = {
  getActivityLogs: async (params?: Record<string, any>) => {
    const searchParams = new URLSearchParams()
    if (params?.offset !== undefined) searchParams.append('offset', params.offset.toString())
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString())
    const query = searchParams.toString()
    
    const data = await fetchClient(`/activity${query ? `?${query}` : ''}`, { method: 'GET' })
    return keysToCamel(data)
  },
}
