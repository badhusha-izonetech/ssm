import { api } from './client';
import { LoginResponse, EmployeeAuthProfile } from '../types';

export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { username, password });
  return data;
}

export async function me(): Promise<{ employee: EmployeeAuthProfile; portal: string | null }> {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}
