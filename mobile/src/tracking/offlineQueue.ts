import AsyncStorage from '@react-native-async-storage/async-storage';
import { GpsFix } from '../types';

/**
 * Simple durable FIFO queue for GPS fixes, keyed per active tracking
 * session (field_movement id) so a queue never leaks across sessions.
 * Everything is stored as one JSON array per session — fine at field-tracking
 * volumes (a fix every few seconds for a work day is a few thousand small
 * objects at most), and keeps flush logic trivial and crash-safe.
 */

/** A GPS fix plus how many times sending it has failed. `attempts` is only
 * ever incremented, never used to drop the item — a fix that keeps failing
 * is surfaced as "Failed / Retry Required" (see syncStatus.ts), not lost. */
export type QueuedFix = GpsFix & { attempts: number };

// Past this many consecutive failures on the oldest item, the UI reports
// "Failed / Retry Required" instead of a plain backlog — the item is still
// retried on every pump, this only changes what status is shown.
export const RETRY_EXHAUSTED_THRESHOLD = 5;

function queueKey(fmId: string) {
  return `ssc_field_gps_queue_${fmId}`;
}

async function readRaw(fmId: string): Promise<QueuedFix[]> {
  const raw = await AsyncStorage.getItem(queueKey(fmId));
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  // Backward-compatible with any queue written before `attempts` existed.
  return parsed.map((item: GpsFix & { attempts?: number }) => ({ ...item, attempts: item.attempts ?? 0 }));
}

async function writeRaw(fmId: string, queue: QueuedFix[]): Promise<void> {
  await AsyncStorage.setItem(queueKey(fmId), JSON.stringify(queue));
}

export async function enqueueFix(fmId: string, fix: GpsFix): Promise<void> {
  const queue = await readRaw(fmId);
  queue.push({ ...fix, attempts: 0 });
  await writeRaw(fmId, queue);
}

export async function peekQueue(fmId: string): Promise<GpsFix[]> {
  return readRaw(fmId);
}

/** Removes the first `count` items (the ones that were just successfully sent). */
export async function dequeueSent(fmId: string, count: number): Promise<void> {
  const queue = await readRaw(fmId);
  await writeRaw(fmId, queue.slice(count));
}

/** Marks the oldest still-queued item as having failed one more send attempt.
 * Never removes it — durability requires the fix stays queued until it
 * actually sends, however long that takes. */
export async function markHeadAttemptFailed(fmId: string): Promise<void> {
  const queue = await readRaw(fmId);
  if (!queue.length) return;
  queue[0] = { ...queue[0], attempts: queue[0].attempts + 1 };
  await writeRaw(fmId, queue);
}

/** True once the oldest queued item has failed enough consecutive times to
 * warrant surfacing "Failed / Retry Required" rather than a plain backlog. */
export async function isRetryExhausted(fmId: string): Promise<boolean> {
  const queue = await readRaw(fmId);
  return !!queue.length && queue[0].attempts >= RETRY_EXHAUSTED_THRESHOLD;
}

export async function clearQueue(fmId: string): Promise<void> {
  await AsyncStorage.removeItem(queueKey(fmId));
}

export async function queueDepth(fmId: string): Promise<number> {
  return (await peekQueue(fmId)).length;
}
