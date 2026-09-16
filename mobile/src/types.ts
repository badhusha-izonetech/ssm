// Mirrors backend/app/schemas/*.py — keep in sync with the FastAPI schemas.

export interface EmployeeAuthProfile {
  id: string;
  employee_code: string;
  name: string;
  username: string;
  department: string;
  designation: string;
  employment_status: string;
  avatar_color?: string | null;
  location?: string | null;
  mobile: string;
  email?: string | null;
}

export interface LoginResponse {
  employee: EmployeeAuthProfile;
  portal?: string | null;
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export type FieldMovementStatus = 'Checked In' | 'On Field' | 'Returning' | 'Checked Out';

export interface FieldMovementPhotoRead {
  id: string;
  file_url: string;
  file_name?: string;
  photo_type?: string;
  media_type?: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  captured_at?: string;
  created_at?: string;
}

export interface FieldMovementVideoRead {
  id: string;
  file_url: string;
  file_name?: string;
  duration_seconds?: number | null;
  uploaded_at?: string;
  created_at?: string;
}

export interface FieldMovementRead {
  id: string;
  employee_id: string;
  employee_name: string;
  role: string;
  status: FieldMovementStatus;
  current_location?: string | null;
  destination?: string | null;
  destination_latitude?: number | null;
  destination_longitude?: number | null;
  geofence_radius_meters?: number | null;
  start_time: string;
  last_update: string;
  end_time?: string | null;
  lead_id?: string | null;
  site_visit_id?: string | null;
  project_id?: string | null;
  purpose?: string | null;
  work_type?: 'DIRECT MARKET' | 'SITE VISIT' | null;
  work_stage?: string | null;
  last_latitude?: number | null;
  last_longitude?: number | null;
  last_accuracy?: number | null;
  last_speed?: number | null;
  last_heading?: number | null;
  last_location_at?: string | null;
  photos?: FieldMovementPhotoRead[];
  videos?: FieldMovementVideoRead[];
  notes?: FieldMovementNoteRead[];
  work_updates?: FieldMovementWorkUpdateRead[];
  pinned_locations?: FieldMovementPinRead[];
  created_at: string;
}

export interface FieldMovementPinRead {
  id: string;
  field_movement_id: string;
  employee_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  place_name?: string | null;
  reason: string;
  pinned_at: string;
  duration_minutes?: number | null;
  client_operation_id?: string | null;
  created_at: string;
}

export interface FieldMovementPinCreatePayload {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  place_name?: string | null;
  reason: string;
  pinned_at?: string;
  duration_minutes?: number;
  client_operation_id?: string;
}

export interface FieldMovementNoteRead {
  id: string;
  note: string;
  created_at: string;
  created_by_id?: string | null;
}

export interface FieldMovementWorkUpdateRead {
  id: string;
  field_movement_id: string;
  employee_id: string;
  stage: string;
  remarks?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  created_at: string;
}

export interface FieldMovementLocationRead {
  id: string;
  field_movement_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number | null;
  heading?: number | null;
  captured_at: string;
}

export interface FieldMovementStartPayload {
  destination?: string;
  current_location?: string;
  lead_id?: string;
  site_visit_id?: string;
  project_id?: string;
  purpose?: string;
  work_type?: 'DIRECT MARKET' | 'SITE VISIT';
}

export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number | null;
  heading?: number | null;
  timestamp: number; // epoch ms
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
