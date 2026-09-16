import { fetchClient, keysToCamel, keysToSnake } from './client';
import type { Employee } from '../types/models';

export const employeesApi = {
  getAll: async (): Promise<Employee[]> => {
    const res = await fetchClient('/employees');
    return keysToCamel(res.items ?? []);
  },

  create: async (employeeData: Partial<Employee> & { password?: string }): Promise<Employee> => {
    const backendPayload = keysToSnake(employeeData);
    
    // Auto-generate employee code if missing
    if (!backendPayload.employee_code) {
      backendPayload.employee_code = `SSC-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    }

    const res = await fetchClient('/employees', {
      method: 'POST',
      body: JSON.stringify(backendPayload)
    });

    return keysToCamel(res);
  },

  update: async (id: string, employeeData: Partial<Employee>): Promise<Employee> => {
    const backendPayload = keysToSnake(employeeData);
    const res = await fetchClient(`/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(backendPayload)
    });
    return keysToCamel(res);
  },

  delete: async (id: string): Promise<void> => {
    await fetchClient(`/employees/${id}`, {
      method: 'DELETE'
    });
  },

  uploadDocument: async (employeeId: string, documentType: string, file: File): Promise<Employee> => {
    const formData = new FormData();
    formData.append('document_type', documentType);
    formData.append('file', file);
    
    const res = await fetchClient(`/employees/${employeeId}/documents`, {
      method: 'POST',
      body: formData
    });
    return keysToCamel(res);
  }
};
