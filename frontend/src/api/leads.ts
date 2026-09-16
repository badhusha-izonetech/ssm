import { fetchClient, keysToCamel, keysToSnake } from './client';
import type { Lead } from '../types/models';

export const leadsApi = {
  getAll: async (status?: string): Promise<Lead[]> => {
    const url = status ? `/leads?status=${encodeURIComponent(status)}` : '/leads';
    const res = await fetchClient(url);
    return keysToCamel(res.items ?? []);
  },

  getFollowUps: async (): Promise<Lead[]> => {
    const res = await fetchClient('/leads/follow-ups');
    return keysToCamel(res.items ?? []);
  },

  getById: async (id: string): Promise<Lead> => {
    const res = await fetchClient(`/leads/${id}`);
    return keysToCamel(res);
  },

  create: async (leadData: Partial<Lead>): Promise<Lead> => {
    const backendPayload = keysToSnake(leadData);
    const res = await fetchClient('/leads', {
      method: 'POST',
      body: JSON.stringify(backendPayload)
    });
    return keysToCamel(res);
  },

  createExistingCustomerLead: async (data: {
    customerId: string;
    priorProjectId: string;
    productInterested?: string;
    requirementDescription?: string;
    approximateRequirement?: string;
    priority?: string;
    assignedEmployeeId?: string;
  }): Promise<Lead> => {
    const res = await fetchClient('/leads/existing-customer', {
      method: 'POST',
      body: JSON.stringify(keysToSnake(data))
    });
    return keysToCamel(res);
  },

  updateStatus: async (
    id: string,
    data: { status: string; lostReason?: string; lostReasonDetail?: string; remarks?: string }
  ): Promise<Lead> => {
    const res = await fetchClient(`/leads/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(keysToSnake(data))
    });
    return keysToCamel(res);
  },

  reassign: async (id: string, assignedEmployeeId: string): Promise<Lead> => {
    const res = await fetchClient(`/leads/${id}/reassign`, {
      method: 'PATCH',
      body: JSON.stringify(keysToSnake({ assignedEmployeeId }))
    });
    return keysToCamel(res);
  }
};
