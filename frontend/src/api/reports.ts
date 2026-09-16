import { fetchClient, keysToCamel } from './client'

export const reportsApi = {
  getReports: async () => {
    const data = await fetchClient('/reports', { method: 'GET' })
    return keysToCamel(data)
  },
}
