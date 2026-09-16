import { fetchClient, keysToCamel, keysToSnake } from './client'
import type { Project } from '../types/models'

export const projectsApi = {
  getAll: async (): Promise<Project[]> => {
    const res = await fetchClient('/projects')
    return keysToCamel(res.items) as Project[]
  },
  create: async (data: any): Promise<Project> => {
    const res = await fetchClient('/projects', {
      method: 'POST',
      body: JSON.stringify(keysToSnake(data)),
    })
    return keysToCamel(res) as Project
  },
  advanceStage: async (id: string, data: any): Promise<Project> => {
    const res = await fetchClient(`/projects/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify(keysToSnake(data)),
    })
    return keysToCamel(res) as Project
  },
  assign: async (id: string, data: any): Promise<Project> => {
    const res = await fetchClient(`/projects/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify(keysToSnake(data)),
    })
    return keysToCamel(res) as Project
  },
  getById: async (id: string): Promise<Project> => {
    const res = await fetchClient(`/projects/${id}`)
    return keysToCamel(res) as Project
  },
  uploadFile: async (id: string, formData: FormData): Promise<Project> => {
    const res = await fetchClient(`/projects/${id}/uploads`, {
      method: 'POST',
      body: formData,
    })
    return keysToCamel(res) as Project
  },
  updateInstallationStatus: async (id: string, installationStatus: string, remarks?: string): Promise<Project> => {
    const res = await fetchClient(`/projects/${id}/installation-status`, {
      method: 'PATCH',
      body: JSON.stringify({ installation_status: installationStatus, remarks: remarks ?? null }),
    })
    return keysToCamel(res) as Project
  },
}
