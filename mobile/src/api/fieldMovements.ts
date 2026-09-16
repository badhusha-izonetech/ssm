import { api } from './client';
import {
  FieldMovementRead, FieldMovementStartPayload, GpsFix, PagedResponse,
  FieldMovementNoteRead, FieldMovementWorkUpdateRead, FieldMovementLocationRead,
  FieldMovementPinRead, FieldMovementPinCreatePayload,
} from '../types';


/** The employee's own field movements, most recent first (backend already sorts this way). */
export async function listMine(page = 1, pageSize = 50): Promise<PagedResponse<FieldMovementRead>> {
  const { data } = await api.get<PagedResponse<FieldMovementRead>>('/field-movements/mine', {
    params: { page, page_size: pageSize },
  });
  return data;
}

export async function getFieldMovement(fmId: string): Promise<FieldMovementRead> {
  const { data } = await api.get<FieldMovementRead>(`/field-movements/${fmId}`);
  return data;
}

export async function startFieldMovement(payload: FieldMovementStartPayload): Promise<FieldMovementRead> {
  const { data } = await api.post<FieldMovementRead>('/field-movements/start', payload);
  return data;
}

export async function stopFieldMovement(fmId: string): Promise<FieldMovementRead> {
  const { data } = await api.post<FieldMovementRead>(`/field-movements/${fmId}/stop`, {});
  return data;
}

export async function updateFieldMovement(
  fmId: string,
  payload: {
    current_location?: string;
    status?: string;
    destination?: string;
    destination_latitude?: number;
    destination_longitude?: number;
    geofence_radius_meters?: number;
  }
): Promise<FieldMovementRead> {
  const { data } = await api.patch<FieldMovementRead>(`/field-movements/${fmId}`, payload);
  return data;
}

export async function sendGeofenceAlert(
  fmId: string,
  payload: {
    latitude: number;
    longitude: number;
    distance_meters: number;
    destination_address?: string | null;
  }
): Promise<void> {
  await api.post(`/field-movements/${fmId}/geofence-alert`, payload);
}

export async function addPin(
  fmId: string,
  payload: FieldMovementPinCreatePayload
): Promise<FieldMovementPinRead> {
  const { data } = await api.post<FieldMovementPinRead>(`/field-movements/${fmId}/pins`, payload);
  return data;
}

export async function listPins(fmId: string): Promise<FieldMovementPinRead[]> {
  const { data } = await api.get<FieldMovementPinRead[]>(`/field-movements/${fmId}/pins`);
  return data;
}

export async function sendStationaryAlert(
  fmId: string,
  payload: {
    latitude: number;
    longitude: number;
    duration_minutes?: number;
    address?: string | null;
  }
): Promise<{ status: string; warning_id: string }> {
  const { data } = await api.post(`/field-movements/${fmId}/stationary-alert`, payload);
  return data;
}

export async function sendLocationOffAlert(
  fmId: string,
  payload: {
    reason?: string;
    last_latitude?: number | null;
    last_longitude?: number | null;
  }
): Promise<{ status: string; warning_id: string }> {
  const { data } = await api.post(`/field-movements/${fmId}/location-off-alert`, payload);
  return data;
}


/** HTTP fallback used by the offline queue to flush GPS fixes captured while the WS was down. */
export async function postLocation(fmId: string, fix: GpsFix): Promise<void> {
  await api.post(`/field-movements/${fmId}/location`, {
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracy: fix.accuracy,
    speed: fix.speed ?? null,
    heading: fix.heading ?? null,
    captured_at: new Date(fix.timestamp).toISOString(),
  });
}

/** Retrieve recorded route locations for a field movement. */
export async function listLocations(fmId: string, maxPoints = 500): Promise<PagedResponse<FieldMovementLocationRead>> {
  const { data } = await api.get<PagedResponse<FieldMovementLocationRead>>(`/field-movements/${fmId}/locations`, {
    params: { max_points: maxPoints },
  });
  return data;
}


/**
 * Generalized version of the same existing /field-movements/{id}/photo upload
 * used for photo/selfie capture in Site Visit. Video is NOT sent here — see
 * uploadFieldVideo below, which uses the dedicated, correctly-validated
 * video endpoint instead of forcing video through an image-only path.
 */
export async function uploadFieldFile(
  fmId: string,
  fileUri: string,
  fileName: string,
  mimeType = 'image/jpeg',
  clientOperationId?: string,
  caption?: string
): Promise<{ id: string; file_url: string; media_type: string; uploaded_at: string; caption?: string }> {
  const form = new FormData();
  form.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);
  if (clientOperationId) form.append('client_operation_id', clientOperationId);
  if (caption) form.append('caption', caption);
  const { data } = await api.post(`/field-movements/${fmId}/photo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/** Real multipart video upload — hits the dedicated /video endpoint (§17), not /photo. */
export async function uploadFieldVideo(
  fmId: string,
  fileUri: string,
  fileName: string,
  mimeType = 'video/mp4',
  clientOperationId?: string
): Promise<void> {
  const form = new FormData();
  form.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);
  if (clientOperationId) form.append('client_operation_id', clientOperationId);
  await api.post(`/field-movements/${fmId}/video`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/**
 * Real, GPS-validated FieldMovement selfie/proof upload — hits the
 * dedicated /selfie endpoint (not /photo), which requires and persists
 * latitude/longitude/accuracy/captured_at server-side. Unlike a plain
 * photo, the GPS fix is not just burned into the image pixels — it's sent
 * as real structured metadata the backend validates (rejects missing/
 * malformed/(0,0)/inaccurate/stale fixes) and stores.
 */
export async function uploadSelfie(
  fmId: string,
  fileUri: string,
  fileName: string,
  gps: { latitude: number; longitude: number; accuracy: number; capturedAt: string },
  clientOperationId?: string
): Promise<{
  id: string; file_url: string; media_type: string; uploaded_at: string;
  latitude?: number; longitude?: number; accuracy?: number; captured_at?: string;
}> {
  const form = new FormData();
  form.append('file', { uri: fileUri, name: fileName, type: 'image/jpeg' } as unknown as Blob);
  form.append('latitude', String(gps.latitude));
  form.append('longitude', String(gps.longitude));
  form.append('accuracy', String(gps.accuracy));
  form.append('captured_at', gps.capturedAt);
  if (clientOperationId) form.append('client_operation_id', clientOperationId);
  const { data } = await api.post(`/field-movements/${fmId}/selfie`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/** Real backend-authoritative Site Notes entry (§A) — replaces the local-only SiteVisit note store. */
export async function addNote(
  fmId: string,
  note: string,
  clientOperationId?: string
): Promise<FieldMovementNoteRead> {
  const { data } = await api.post<FieldMovementNoteRead>(`/field-movements/${fmId}/notes`, {
    note,
    client_operation_id: clientOperationId,
  });
  return data;
}

/**
 * Real backend-authoritative work-progress stage update (§B) — replaces
 * the local-only workStage mutation. Every call appends a new history
 * entry server-side; it never overwrites a prior update.
 */
export async function addWorkUpdate(
  fmId: string,
  payload: { stage: string; remarks?: string; latitude?: number; longitude?: number; accuracy?: number },
  clientOperationId?: string
): Promise<FieldMovementWorkUpdateRead> {
  const { data } = await api.post<FieldMovementWorkUpdateRead>(`/field-movements/${fmId}/work-updates`, {
    ...payload,
    client_operation_id: clientOperationId,
  });
  return data;
}

export async function listWorkUpdates(fmId: string): Promise<FieldMovementWorkUpdateRead[]> {
  const { data } = await api.get<FieldMovementWorkUpdateRead[]>(`/field-movements/${fmId}/work-updates`);
  return data;
}

/** Real backend measurement evidence upload (category + photo) — replaces the AsyncStorage outbox. */
export async function uploadMeasurement(
  fmId: string,
  fileUri: string,
  fileName: string,
  category: 'Length' | 'Width' | 'Height' | 'Other',
  clientOperationId?: string
): Promise<{ id: string; category: string; file_url: string; taken_at: string }> {
  const form = new FormData();
  form.append('file', { uri: fileUri, name: fileName, type: 'image/jpeg' } as unknown as Blob);
  form.append('category', category);
  if (clientOperationId) form.append('client_operation_id', clientOperationId);
  const { data } = await api.post(`/field-movements/${fmId}/measurements`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function listMeasurements(fmId: string) {
  const { data } = await api.get(`/field-movements/${fmId}/measurements`);
  return data;
}

/** Real backend document upload — replaces the AsyncStorage outbox. */
export async function uploadDocument(
  fmId: string,
  fileUri: string,
  fileName: string,
  mimeType: string,
  clientOperationId?: string
): Promise<{ id: string; name: string; file_url: string; mime_type?: string; size?: number; added_at: string }> {
  const form = new FormData();
  form.append('file', { uri: fileUri, name: fileName, type: mimeType } as unknown as Blob);
  if (clientOperationId) form.append('client_operation_id', clientOperationId);
  const { data } = await api.post(`/field-movements/${fmId}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function listDocuments(fmId: string) {
  const { data } = await api.get(`/field-movements/${fmId}/documents`);
  return data;
}

export async function deleteDocument(fmId: string, documentId: string): Promise<void> {
  await api.delete(`/field-movements/${fmId}/documents/${documentId}`);
}

type EquipmentPayload = {
  stage: 'before' | 'after';
  photo_url?: string | null;
  items: { name: string; quantity: string; condition: string }[];
  remarks?: string | null;
  confirmed_at?: string | null;
};

/** Equipment custody linked to a started field movement. */
export async function submitEquipment(fmId: string, payload: EquipmentPayload) {
  const { data } = await api.post(`/field-movements/${fmId}/equipment`, payload);
  return data;
}

/**
 * Equipment custody recorded BEFORE a field movement exists (tool check-out
 * at the depot). The backend auto-links this to the employee's next started
 * field movement — replaces the local pending-equipment outbox.
 */
export async function submitPendingEquipment(payload: EquipmentPayload) {
  const { data } = await api.post('/field-movements/equipment', payload);
  return data;
}

export async function listEquipment(fmId: string) {
  const { data } = await api.get(`/field-movements/${fmId}/equipment`);
  return data;
}

/** @deprecated kept for compatibility — use uploadFieldFile. */
export async function uploadPhoto(fmId: string, fileUri: string, fileName: string): Promise<void> {
  await uploadFieldFile(fmId, fileUri, fileName, 'image/jpeg');
}
