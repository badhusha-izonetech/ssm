import { fetchClient, keysToCamel } from './client'
import type { AttendanceRecord } from '../types/models'

export const attendanceApi = {
  getAll: async (): Promise<AttendanceRecord[]> => {
    const res = await fetchClient(`/attendance`)
    return keysToCamel(res) as AttendanceRecord[]
  },

  checkIn: async (type: 'Office' | 'Field'): Promise<AttendanceRecord> => {
    const res = await fetchClient('/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify({ type }),
    })
    return keysToCamel(res) as AttendanceRecord
  },

  checkOut: async (): Promise<AttendanceRecord> => {
    const res = await fetchClient(`/attendance/check-out`, {
      method: 'POST',
    })
    return keysToCamel(res) as AttendanceRecord
  }
}
