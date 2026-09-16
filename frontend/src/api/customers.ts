import { fetchClient, keysToCamel } from './client';
import type { Customer, GlobalCustomerView } from '../types/models';

export const customersApi = {
  getAll: async (): Promise<GlobalCustomerView[]> => {
    const res = await fetchClient('/customers');
    return keysToCamel(res.items ?? []);
  },

  getExisting: async (): Promise<any[]> => {
    const res = await fetchClient('/customers/existing');
    return keysToCamel(res);
  },

  getById: async (id: string): Promise<Customer> => {
    const res = await fetchClient(`/customers/${id}`);
    return keysToCamel(res);
  },
};
