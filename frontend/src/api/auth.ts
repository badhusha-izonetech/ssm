import { fetchClient, keysToCamel } from './client';
import type { Employee } from '../types/models';

export interface LoginResponse {
  employee: Employee;
  portal: string | null;
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const res = await fetchClient('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.employee) {
      res.employee = keysToCamel(res.employee);
    }
    return res;
  },

  logout: async (): Promise<void> => {
    try {
      await fetchClient('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore if logout request fails (e.g., token already expired)
    }
  },

  me: async (): Promise<{ employee: Employee; portal: string | null }> => {
    const res = await fetchClient('/auth/me', { method: 'GET' });
    if (res.employee) {
      res.employee = keysToCamel(res.employee);
    }
    return res;
  }
};
