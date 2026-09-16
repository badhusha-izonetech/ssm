import { api } from './client';

export interface SiteVisitMaterial {
  id: string;
  item_name: string;
  item_id?: string | null;
  quantity: number;
  unit: string;
  remarks?: string | null;
  added_by_id?: string | null;
  added_at?: string | null;
}

export interface SiteVisitRead {
  id: string;
  lead_id?: string | null;
  project_id?: string | null;
  customer_name: string;
  customer_mobile: string;
  status: string;
  installation_area?: string | null;
  measurements?: string | null;
  notes?: string | null;
  feasibility_result?: string | null;
  stock_availability_status?: string | null;
  raw_material_details: SiteVisitMaterial[];
  [key: string]: unknown;
}

export interface StockItemRead {
  id: string;
  product_name: string;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  unit: string;
  current_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
}

export interface SiteVisitFormPayload {
  installation_area?: string;
  measurements?: string;
  additional_notes?: string;
  feasibility_result?: string;
  products: {
    item_id?: string | null;
    item_name: string;
    quantity: number;
    unit: string;
    remarks?: string;
  }[];
}

export interface CreateSiteVisitPayload {
  lead_id?: string;
  project_id?: string;
  customer_name: string;
  customer_mobile: string;
  site_address?: string;
  area?: string;
  customer_latitude?: number;
  customer_longitude?: number;
  visit_date: string; // YYYY-MM-DD
  visit_time: string; // HH:mm
  employee_id: string;
  employee_name: string;
  site_type: string;
  system_type?: string;
}

export async function createSiteVisit(payload: CreateSiteVisitPayload): Promise<SiteVisitRead> {
  const { data } = await api.post<SiteVisitRead>('/site-visits', payload);
  return data;
}

export async function getSiteVisit(visitId: string): Promise<SiteVisitRead> {
  const { data } = await api.get<SiteVisitRead>(`/site-visits/${visitId}`);
  return data;
}

/**
 * SITE VISIT work-type entry point: resolves the real SiteVisit for a real
 * Lead (reusing an open one, or creating it from the Lead's own data) so
 * FieldMovement.start can be given real lead_id + site_visit_id instead of
 * starting a mobile-only, disconnected tracking session.
 */
export async function getOrCreateSiteVisitForLead(leadId: string): Promise<SiteVisitRead> {
  const { data } = await api.get<SiteVisitRead>(`/site-visits/for-lead/${leadId}`);
  return data;
}

export interface AddMaterialPayload {
  item_name: string;
  quantity: number;
  unit: string;
  remarks?: string;
  item_id?: string;
  /** Idempotency key — generate once per add-attempt (e.g. `uuid()`), reuse
   * verbatim on retry so a lost-response offline-queue replay can't create
   * a duplicate material line. See backend site_visit_service.add_site_visit_material. */
  client_operation_id?: string;
}

/** Real backend write for the Site Visitor materials/project-requirement flow. */
export async function addSiteVisitMaterial(visitId: string, payload: AddMaterialPayload): Promise<SiteVisitRead> {
  const { data } = await api.post<SiteVisitRead>(`/site-visits/${visitId}/materials`, payload);
  return data;
}

export async function removeSiteVisitMaterial(visitId: string, materialId: string): Promise<SiteVisitRead> {
  const { data } = await api.delete<SiteVisitRead>(`/site-visits/${visitId}/materials/${materialId}`);
  return data;
}

export interface UpdateSiteVisitDetailsPayload {
  installation_area?: string;
  measurements?: string;
  roof_ground_details?: string;
  raw_materials?: string;
  cable_accessories?: string;
  notes?: string;
}

export async function updateSiteVisitDetails(
  visitId: string,
  payload: UpdateSiteVisitDetailsPayload
): Promise<SiteVisitRead> {
  const { data } = await api.patch<SiteVisitRead>(`/site-visits/${visitId}/details`, payload);
  return data;
}

export async function submitSiteVisitForm(
  visitId: string,
  payload: SiteVisitFormPayload
): Promise<SiteVisitRead> {
  const { data } = await api.post<SiteVisitRead>(`/site-visits/${visitId}/form`, payload);
  return data;
}

export async function listStockItems(): Promise<StockItemRead[]> {
  try {
    const { data } = await api.get<{ items: StockItemRead[] }>('/stock', { params: { limit: 100 } });
    return data.items || [];
  } catch {
    return [];
  }
}


