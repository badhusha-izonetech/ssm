import { fetchClient } from './client'

export const dashboardApi = {
  getCeoDashboard: async () => {
    const data = await fetchClient('/dashboard/overview', { method: 'GET' })
    return data
  },
}
