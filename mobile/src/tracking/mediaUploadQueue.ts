import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Durable, persisted queue for media uploads that must survive app restart,
 * network loss, and a killed app — unlike a plain in-memory retry, which is
 * lost the moment the JS process dies (§30: "Uploads and mutations must not
 * be silently lost").
 *
 * Each entry captures everything needed to retry the exact same upload
 * later: which endpoint, the local file, and any extra form fields. A
 * client-generated operationId is sent as client_operation_id on every
 * (re)attempt so the backend can dedupe a retried upload against one that
 * already landed, instead of creating a duplicate row.
 */

export interface PendingMediaUpload {
  operationId: string;
  fieldMovementId: string;
  /** Path segment appended to `/field-movements/{fieldMovementId}/...` */
  endpoint: 'photo' | 'video' | 'measurements' | 'documents' | 'selfie';
  fileUri: string;
  fileName: string;
  mimeType: string;
  extraFields?: Record<string, string>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

const QUEUE_KEY = 'ssc_pending_media_uploads';

/**
 * Shared operationId scheme, reused anywhere a client-generated idempotency
 * key is needed for a retry-safe write (media queue entries here, but also
 * plain JSON POSTs like the site-visit materials flow — see
 * SiteVisitMaterialsScreen) rather than inventing a second id format.
 */
export function generateOperationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readQueue(): Promise<PendingMediaUpload[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeQueue(queue: PendingMediaUpload[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Persists the upload BEFORE the network call is attempted, so a failure —
 * or the app being killed mid-request — still leaves a durable record to
 * retry from, rather than the evidence existing only in a temp cache file
 * that may be cleared (§58).
 */
export async function enqueueMediaUpload(
  entry: Omit<PendingMediaUpload, 'operationId' | 'createdAt' | 'retryCount'>
): Promise<string> {
  const operationId = generateOperationId();
  const queue = await readQueue();
  queue.push({ ...entry, operationId, createdAt: new Date().toISOString(), retryCount: 0 });
  await writeQueue(queue);
  return operationId;
}

export async function removeFromQueue(operationId: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((e) => e.operationId !== operationId));
}

export async function markAttemptFailed(operationId: string, error: string): Promise<void> {
  const queue = await readQueue();
  const updated = queue.map((e) =>
    e.operationId === operationId ? { ...e, retryCount: e.retryCount + 1, lastError: error } : e
  );
  await writeQueue(updated);
}

export async function listPendingUploads(fieldMovementId?: string): Promise<PendingMediaUpload[]> {
  const queue = await readQueue();
  return fieldMovementId ? queue.filter((e) => e.fieldMovementId === fieldMovementId) : queue;
}

type UploadFn = (entry: PendingMediaUpload) => Promise<void>;

let draining = false;

/**
 * Sequentially retries every queued upload, oldest first, stopping at the
 * first failure to preserve ordering (mirrors TrackingManager's GPS drain
 * logic) rather than firing all retries in parallel and risking
 * out-of-order or duplicate-under-race uploads.
 */
export async function drainPendingUploads(uploadFn: UploadFn): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    const queue = await readQueue();
    for (const entry of queue) {
      try {
        await uploadFn(entry);
        await removeFromQueue(entry.operationId);
      } catch (err) {
        await markAttemptFailed(entry.operationId, err instanceof Error ? err.message : 'Upload failed');
        break; // stop draining on first failure; retry all from here next pump
      }
    }
  } finally {
    draining = false;
  }
}

/**
 * Wires the same network-reconnect / app-foreground triggers TrackingManager
 * already uses for GPS, so pending media uploads retry automatically
 * without the employee needing to remember to reopen the screen.
 */
export function attachMediaQueueAutoDrain(uploadFn: UploadFn): () => void {
  const netSub = NetInfo.addEventListener((state) => {
    if (state.isConnected) drainPendingUploads(uploadFn);
  });
  const appSub = AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'active') drainPendingUploads(uploadFn);
  });
  return () => {
    netSub();
    appSub.remove();
  };
}
