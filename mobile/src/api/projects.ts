import { api } from './client';
import { PagedResponse } from '../types';

export interface ProjectAssignmentRow {
  id: string;
  project_id: string;
  employee_id: string;
  role: 'Technician' | 'Follow-Up';
  assignment_type: 'Primary' | 'Additional';
}

export interface ProjectListItem {
  id: string;
  project_code: string;
  customer_name: string;
  site?: string | null;
  area?: string | null;
  current_stage: string;
  status: string;
  priority: string;
  due_date?: string | null;
  assignments: ProjectAssignmentRow[];
}

/**
 * Projects the current employee is a real assigned participant on — backs
 * the Field Technician's "which project am I working on" selection screen.
 * Server-scoped via ProjectAssignment membership (§26), not filtered
 * client-side from the full project list.
 */
export async function listMyProjects(page = 1, pageSize = 50): Promise<PagedResponse<ProjectListItem>> {
  const { data } = await api.get<PagedResponse<ProjectListItem>>('/projects/mine', {
    params: { page, page_size: pageSize },
  });
  return data;
}

export interface SharedProjectEvidence {
  project_id: string;
  contributors: { employee_id: string; employee_name: string }[];
  photos: { id: string; employee_id: string; employee_name: string; file_url: string; uploaded_at: string }[];
  videos: { id: string; employee_id: string; employee_name: string; file_url: string; uploaded_at: string }[];
  measurements: { id: string; employee_id: string; employee_name: string; category: string; file_url: string; taken_at: string }[];
  documents: { id: string; employee_id: string; employee_name: string; name: string; file_url: string; added_at: string }[];
  equipment: { id: string; employee_id: string; employee_name: string; stage: string; photo_url?: string; items: unknown[] }[];
}

/** Aggregated teammate evidence for a shared project (§25-26). */
export async function getSharedProjectEvidence(projectId: string): Promise<SharedProjectEvidence> {
  const { data } = await api.get<SharedProjectEvidence>(`/field-movements/project/${projectId}/shared-evidence`);
  return data;
}
