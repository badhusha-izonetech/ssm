/**
 * Local Site Visit / Equipment "sync outbox" types.
 *
 * IMPORTANT — read BACKEND_REQUIREMENTS.md at the repo root. The backend
 * has no endpoints yet for notes, measurements list, documents metadata,
 * equipment custody, or work-stage (only photo/video/document *files* reach
 * the backend today, via the existing generic upload endpoint). Everything
 * in this file is therefore held locally as a pending-sync outbox — NOT a
 * permanent data store — and every screen that reads/writes it must surface
 * a "pending sync" state to the employee (see SyncPendingNote component) so
 * nobody mistakes this for confirmed backend persistence.
 */

export interface CapturedPhoto {
  id: string;
  uri: string;
  takenAt: string; // ISO
  uploaded: boolean; // true once the underlying FILE reached the backend via uploadFieldFile
  caption?: string;
}

export interface SelfieProof extends CapturedPhoto {
  employeeName: string;
  distanceMeters: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /**
   * URI of the final composited evidence image (photo + burned-in
   * name/date/time/distance/location/GPS overlay), produced by
   * react-native-view-shot. This composed image — not the raw camera
   * frame — is what's uploaded, so the verification metadata stays
   * physically part of the proof file rather than living only in app UI.
   */
  compositedUri: string;
}

export interface SiteVideo {
  uri: string;
  durationSeconds: number;
  recordedAt: string;
  uploaded: boolean;
}

export type MeasurementCategory = 'Length' | 'Width' | 'Height' | 'Other';

export interface MeasurementPhoto extends CapturedPhoto {
  category: MeasurementCategory;
}

export interface SiteDocument {
  id: string;
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  addedAt: string;
  uploaded: boolean;
}

export interface EquipmentItem {
  id: string;
  name: string;
  quantity: string;
  condition: string;
}

export interface EquipmentRecord {
  photo: CapturedPhoto | null;
  items: EquipmentItem[];
  remarks: string;
  confirmedAt: string | null;
}

/** Field Technician explicit work states — see BACKEND_REQUIREMENTS.md #5 (work_stage). */
export type WorkStage =
  | 'equipment_ready'
  | 'travelling'
  | 'arrived'
  | 'site_verified'
  | 'ready_to_start'
  | 'in_progress'
  | 'work_completed'
  | 'returning'
  | 'completed';

export const WORK_STAGE_LABELS: Record<WorkStage, string> = {
  equipment_ready: 'Equipment Ready',
  travelling: 'Travelling',
  arrived: 'Arrived',
  site_verified: 'Site Verified',
  ready_to_start: 'Ready to Start Work',
  in_progress: 'Work In Progress',
  work_completed: 'Work Completed',
  returning: 'Returning',
  completed: 'Completed',
};

export interface ReturnMovement {
  /** 'returning' once the employee taps Start Returning; real GPS resumes on the same field movement id. */
  status: 'idle' | 'returning' | 'completed';
  startedAt: string | null;
  completedAt: string | null;
  distanceMeters: number | null;
}

export interface SiteVisitRecord {
  fmId: string;
  selfieProof: SelfieProof[];
  generalPhotos: CapturedPhoto[];
  installationPhotos: CapturedPhoto[];
  video: SiteVideo | null;
  measurements: MeasurementPhoto[];
  documents: SiteDocument[];
  notes: string;
  notesSavedAt: string | null;
  destinationMarkedAt: string | null;
  destinationAddress: string | null;
  destinationCoords?: { latitude: number; longitude: number } | null;
  geofenceRadiusMeters?: number;
  travelledDistanceMeters: number | null;
  siteVisitFormCompleted?: boolean;
  siteVisitFormData?: {
    installationArea?: string;
    measurements?: string;
    notes?: string;
    feasibilityResult?: string;
    products?: any[];
  };
  equipment: {
    before: EquipmentRecord;
    after: EquipmentRecord;
  };
  workStage: WorkStage | null;
  outboundCompletedAt: string | null;
  returnMovement: ReturnMovement;
}

export function emptyEquipmentRecord(): EquipmentRecord {
  return { photo: null, items: [], remarks: '', confirmedAt: null };
}

export function emptyReturnMovement(): ReturnMovement {
  return { status: 'idle', startedAt: null, completedAt: null, distanceMeters: null };
}

export function emptySiteVisitRecord(fmId: string): SiteVisitRecord {
  return {
    fmId,
    selfieProof: [],
    generalPhotos: [],
    installationPhotos: [],
    video: null,
    measurements: [],
    documents: [],
    notes: '',
    notesSavedAt: null,
    destinationMarkedAt: null,
    destinationAddress: null,
    destinationCoords: null,
    geofenceRadiusMeters: 60,
    travelledDistanceMeters: null,
    siteVisitFormCompleted: false,
    siteVisitFormData: undefined,
    equipment: { before: emptyEquipmentRecord(), after: emptyEquipmentRecord() },
    workStage: null,
    outboundCompletedAt: null,
    returnMovement: emptyReturnMovement(),
  };
}

