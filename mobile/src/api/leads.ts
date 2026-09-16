import { api } from './client';
import { PagedResponse } from '../types';

export interface LeadSummary {
  id: string;
  customer_name: string;
  customer_mobile: string;
  mobile: string;          // backend primary field (same as customer_mobile for display)
  status: string;
  priority: string;
  site_address?: string | null;   // alias served by backend (maps to address field)
  address?: string | null;        // raw backend field
  area?: string | null;
  city?: string | null;
  product_interested?: string | null;
  requirement_description?: string | null;
  approximate_requirement?: string | null;
  assigned_employee_id?: string | null;
  created_by_id?: string | null;
  work_type?: 'DIRECT MARKET' | 'SITE VISIT' | null;  // if known from field movement
  created_at?: string | null;
  assigned_at?: string | null;
}

/**
 * Leads visible to the current employee. The backend already scopes this to
 * "own" leads for Direct Marketing Executive / Site Visitor designations via
 * LEADS_READ_OWN — no client-side filtering needed or attempted here.
 */
export async function listMyLeads(page = 1, pageSize = 50, status?: string): Promise<PagedResponse<LeadSummary>> {
  const { data } = await api.get<PagedResponse<LeadSummary>>('/leads', {
    params: { page, page_size: pageSize, ...(status ? { status } : {}) },
  });
  return data;
}

/**
 * Mobile "Assigned to Me" inbox: leads currently assigned to the calling
 * employee in site-visit / field-assignment statuses (Site Visit Required,
 * Site Visit Scheduled, Contacted, Interested). Returns full lead details
 * so the AssignedWorkInboxScreen can show address, product, priority, etc.
 */
export async function listAssignedFieldLeads(page = 1, pageSize = 50): Promise<PagedResponse<LeadSummary>> {
  const { data } = await api.get<PagedResponse<LeadSummary>>('/leads/assigned-to-me', {
    params: { page, page_size: pageSize },
  });
  return data;
}

/**
 * Fetch a single lead by ID with full details.
 */
export async function getLead(id: string): Promise<LeadSummary> {
  const { data } = await api.get<LeadSummary>(`/leads/${id}`);
  return data;
}

