import { fetchClient, keysToCamel, keysToSnake } from './client'
import type { CallLogEntry } from '../types/models'

export const callsApi = {
  getAll: async (): Promise<CallLogEntry[]> => {
    const res = await fetchClient('/call-logs')
    return keysToCamel(res.items) as CallLogEntry[]
  },
  create: async (data: Partial<CallLogEntry>): Promise<CallLogEntry> => {
    const res = await fetchClient(`/leads/${data.leadId}/calls`, {
      method: 'POST',
      body: JSON.stringify(keysToSnake(data)),
    })
    return keysToCamel(res) as CallLogEntry
  }
}
