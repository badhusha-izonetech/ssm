import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { generateOperationId } from './mediaUploadQueue';

/**
 * Durable, persisted queue for plain-JSON field mutations that carry no
 * file (Site Notes, Work Progress stage updates) — the JSON-POST
 * counterpart to mediaUploadQueue.ts's file-upload queue, following the
 * same "persist before attempting the network call, survive app kill,
 * retry on reconnect" contract (§A/§B/§G: AsyncStorage may only hold a
 * temporary draft/pending mutation/retry-metadata, never permanent
 * business state — the backend note/work-update record is authoritative
 * once synced).
 */

export type PendingMutationKind = 'note' | 'work_update';

export interface PendingNotePayload {
  note: string;
}

export interface PendingWorkUpdatePayload {
  stage: string;
  remarks?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

export interface PendingMutation {
  operationId: string;
  fieldMovementId: string;
  kind: PendingMutationKind;
  payload: PendingNotePayload | PendingWorkUpdatePayload;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

const QUEUE_KEY = 'ssc_pending_mutations';

async function readQueue(): Promise<PendingMutation[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeQueue(queue: PendingMutation[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/** Persists the mutation BEFORE the network call is attempted — same reasoning as enqueueMediaUpload. */
export async function enqueueMutation(
  entry: Omit<PendingMutation, 'operationId' | 'createdAt' | 'retryCount'>
): Promise<string> {
  const operationId = generateOperationId();
  const queue = await readQueue();
  queue.push({ ...entry, operationId, createdAt: new Date().toISOString(), retryCount: 0 });
  await writeQueue(queue);
  return operationId;
}

export async function removeFromMutationQueue(operationId: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((e) => e.operationId !== operationId));
}

async function markMutationFailed(operationId: string, error: string): Promise<void> {
  const queue = await readQueue();
  const updated = queue.map((e) =>
    e.operationId === operationId ? { ...e, retryCount: e.retryCount + 1, lastError: error } : e
  );
  await writeQueue(updated);
}

export async function listPendingMutations(fieldMovementId?: string, kind?: PendingMutationKind): Promise<PendingMutation[]> {
  const queue = await readQueue();
  return queue.filter(
    (e) => (!fieldMovementId || e.fieldMovementId === fieldMovementId) && (!kind || e.kind === kind)
  );
}

type MutationFn = (entry: PendingMutation) => Promise<void>;

let draining = false;

/** Sequentially retries every queued mutation, oldest first — same ordering guarantee as drainPendingUploads. */
export async function drainPendingMutations(mutationFn: MutationFn): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    const queue = await readQueue();
    for (const entry of queue) {
      try {
        await mutationFn(entry);
        await removeFromMutationQueue(entry.operationId);
      } catch (err) {
        await markMutationFailed(entry.operationId, err instanceof Error ? err.message : 'Save failed');
        break; // stop draining on first failure; retry all from here next pump
      }
    }
  } finally {
    draining = false;
  }
}

/** Same network-reconnect / app-foreground auto-drain triggers as attachMediaQueueAutoDrain. */
export function attachMutationQueueAutoDrain(mutationFn: MutationFn): () => void {
  const netSub = NetInfo.addEventListener((state) => {
    if (state.isConnected) drainPendingMutations(mutationFn);
  });
  const appSub = AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'active') drainPendingMutations(mutationFn);
  });
  return () => {
    netSub();
    appSub.remove();
  };
}
