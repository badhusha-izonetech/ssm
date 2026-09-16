import AsyncStorage from '@react-native-async-storage/async-storage';
import { SiteVisitRecord, EquipmentRecord, emptySiteVisitRecord, emptyEquipmentRecord } from './types';

// This file is a device-local pending-sync outbox for the pieces of the
// Site Visit / Field Technician flow that are still legitimately
// temporary/offline-only client state: draft equipment-before capture
// (before a FieldMovement id exists) and cached photo/video/measurement/
// document metadata mirrors. Notes (§A) and work-progress stage (§B) are
// no longer local-only — they're real backend records now (see
// api/fieldMovements.ts addNote/addWorkUpdate and
// tracking/pendingMutationQueue.ts for their own, separate offline queue);
// completionSummary() below takes the real backend state for those two
// as an explicit parameter rather than reading it from this local record.

function key(fmId: string) {
  return `ssc_field_site_visit_${fmId}`;
}

export async function loadSiteVisitRecord(fmId: string): Promise<SiteVisitRecord> {
  const raw = await AsyncStorage.getItem(key(fmId));
  if (!raw) return emptySiteVisitRecord(fmId);
  try {
    const parsed = JSON.parse(raw) as Partial<SiteVisitRecord>;
    return { ...emptySiteVisitRecord(fmId), ...parsed };
  } catch {
    return emptySiteVisitRecord(fmId);
  }
}

export async function saveSiteVisitRecord(record: SiteVisitRecord): Promise<void> {
  await AsyncStorage.setItem(key(record.fmId), JSON.stringify(record));
}

export async function updateSiteVisitRecord(
  fmId: string,
  updater: (current: SiteVisitRecord) => SiteVisitRecord
): Promise<SiteVisitRecord> {
  const current = await loadSiteVisitRecord(fmId);
  const next = updater(current);
  await saveSiteVisitRecord(next);
  return next;
}

/**
 * Site-visit "completeness" — drives status pills on the Site Visit hub
 * screen.
 *
 * `notes` and `workProgress` are now backed by the real FieldMovement
 * record (§A/§B) rather than local-only state, so their completeness must
 * be derived from real backend data (`hasBackendNotes` /
 * `backendWorkStage`, fetched from GET /field-movements/{id} — see
 * SiteVisitScreen) when it's available. They fall back to the legacy
 * local-record signal only while that fetch hasn't resolved yet (e.g. a
 * cold/offline hub load), so the pill never regresses to "incomplete" just
 * because the network call hasn't returned.
 */
export function completionSummary(
  record: SiteVisitRecord,
  backend?: {
    hasNotes?: boolean;
    workStage?: string | null;
    materialsCount?: number;
    hasPeriodicPhotos?: boolean;
    hasVideo?: boolean;
    hasPhotos?: boolean;
  }
) {
  return {
    selfie: record.selfieProof.length > 0,
    generalPhotos: record.generalPhotos.length > 0 || (backend?.hasPhotos ?? false),
    installationPhotos: record.installationPhotos.length > 0,
    periodicPhotos: (backend?.hasPeriodicPhotos ?? false) || record.generalPhotos.length > 0,
    video: !!record.video || (backend?.hasVideo ?? false),
    measurements: record.measurements.length > 0,
    materials: (backend?.materialsCount ?? 0) > 0,
    documents: record.documents.length > 0,
    notes: Boolean(backend?.hasNotes || record.notes.trim().length > 0),
    equipmentBefore: !!record.equipment.before.confirmedAt,
    equipmentAfter: !!record.equipment.after.confirmedAt,
    siteEvidenceReview: false, // read-only module — never "complete", just viewed
    siteVisitForm: !!record.siteVisitFormCompleted,
    workProgress: ['work_completed', 'completed'].includes(
      (backend?.workStage ?? record.workStage) || ''
    ),
  };
}


// ---------------------------------------------------------------------------
// Field Technician: equipment custody starts BEFORE a field movement exists
// ("Material/Tool Check" happens at the depot, ahead of Start Tracking — see
// BACKEND_REQUIREMENTS.md #4). We hold that under a device-local pending key
// and migrate it onto the real field movement id the moment tracking starts.
// ---------------------------------------------------------------------------

const PENDING_EQUIPMENT_KEY = 'ssc_field_pending_equipment_before';

export async function savePendingEquipmentBefore(record: EquipmentRecord): Promise<void> {
  await AsyncStorage.setItem(PENDING_EQUIPMENT_KEY, JSON.stringify(record));
}

export async function loadPendingEquipmentBefore(): Promise<EquipmentRecord> {
  const raw = await AsyncStorage.getItem(PENDING_EQUIPMENT_KEY);
  if (!raw) return emptyEquipmentRecord();
  try {
    return { ...emptyEquipmentRecord(), ...(JSON.parse(raw) as Partial<EquipmentRecord>) };
  } catch {
    return emptyEquipmentRecord();
  }
}

export async function clearPendingEquipmentBefore(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_EQUIPMENT_KEY);
}

/** Called once a real field movement id exists — folds the pending equipment-before record into it. */
export async function linkPendingEquipmentToFieldMovement(fmId: string): Promise<SiteVisitRecord> {
  const pending = await loadPendingEquipmentBefore();
  const updated = await updateSiteVisitRecord(fmId, (r) => ({
    ...r,
    equipment: { ...r.equipment, before: pending },
    workStage: pending.confirmedAt ? 'travelling' : r.workStage,
  }));
  await clearPendingEquipmentBefore();
  return updated;
}
