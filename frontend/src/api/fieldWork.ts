import { fetchClient, keysToCamel, keysToSnake } from './client'
import type { FieldMovement, FieldMovementLocation } from '../types/models'

export const fieldWorkApi = {
  getAll: async (): Promise<FieldMovement[]> => {
    const res = await fetchClient('/field-movements')
    return keysToCamel(res.items) as FieldMovement[]
  },
  start: async (data: any): Promise<FieldMovement> => {
    const res = await fetchClient('/field-movements/start', {
      method: 'POST',
      body: JSON.stringify(keysToSnake(data)),
    })
    return keysToCamel(res) as FieldMovement
  },
  update: async (id: string, data: any): Promise<FieldMovement> => {
    const res = await fetchClient(`/field-movements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(keysToSnake(data)),
    })
    return keysToCamel(res) as FieldMovement
  },
  stop: async (id: string): Promise<FieldMovement> => {
    const res = await fetchClient(`/field-movements/${id}/stop`, { method: 'POST' })
    return keysToCamel(res) as FieldMovement
  },
  addNote: async (id: string, note: string): Promise<any> => {
    const res = await fetchClient(`/field-movements/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content: note }), // Assuming content is the text field
    })
    return keysToCamel(res)
  },
  uploadPhoto: async (id: string, file: Blob, filename: string = 'photo.jpg'): Promise<any> => {
    const formData = new FormData()
    formData.append('file', file, filename)
    const res = await fetchClient(`/field-movements/${id}/photo`, {
      method: 'POST',
      body: formData,
    })
    return keysToCamel(res)
  },
  /**
   * Downsampled full-session route for the CEO history/route-review screen.
   * Backend caps and evenly strides the points server-side, so this never
   * ships more than `maxPoints` coordinates to the browser regardless of
   * how long the underlying session was.
   */
  getLocationHistory: async (id: string, maxPoints = 300): Promise<FieldMovementLocation[]> => {
    const res = await fetchClient(`/field-movements/${id}/locations?max_points=${maxPoints}`)
    return keysToCamel(res.items) as FieldMovementLocation[]
  },
}
