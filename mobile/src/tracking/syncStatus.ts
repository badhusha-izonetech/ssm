import { WsStatus } from './trackingSocket';

/**
 * The set of operational states shown to the field employee (and, via the
 * same inputs on the web side, to CEO/Project Head monitoring). Each state
 * must be derivable from real signals only — never a static/fake label:
 *
 *   - trackingActive : is a FieldMovement/SiteVisit tracking session running
 *   - netConnected    : NetInfo's actual connectivity state
 *   - gpsAvailable    : device location services are actually enabled
 *   - wsStatus         : the live tracking WebSocket's real connection state
 *   - queueDepth        : how many GPS fixes are durably queued, unsent
 *   - retryExhausted     : the queue's oldest item has failed to send
 *                           repeatedly and needs attention
 *   - lastSyncedAt         : real timestamp of the last fix that was
 *                             confirmed sent to the backend
 */
export type SyncStatus =
  | 'live'
  | 'network_delayed'
  | 'offline'
  | 'reconnecting'
  | 'upload_pending'
  | 'syncing'
  | 'synced'
  | 'failed_retry'
  | 'gps_unavailable'
  | 'stopped';

export interface SyncStatusInputs {
  trackingActive: boolean;
  netConnected: boolean | null; // null = not yet known
  gpsAvailable: boolean | null; // null = not yet known
  wsStatus: WsStatus;
  queueDepth: number;
  draining: boolean;
  retryExhausted: boolean;
  lastSyncedAt: number | null;
}

export interface SyncStatusResult {
  status: SyncStatus;
  label: string;
  lastSyncedAt: number | null;
}

const LABELS: Record<SyncStatus, string> = {
  live: 'Live',
  network_delayed: 'Network Delayed',
  offline: 'Offline',
  reconnecting: 'Reconnecting',
  upload_pending: 'Upload Pending',
  syncing: 'Syncing',
  synced: 'Synced',
  failed_retry: 'Failed / Retry Required',
  gps_unavailable: 'GPS Unavailable',
  stopped: 'Tracking Stopped',
};

/**
 * Pure, side-effect-free state derivation so it's easy to reason about and
 * unit-test independently of NetInfo/WebSocket/AsyncStorage. Order of the
 * checks matters — it encodes priority (e.g. a stuck retry is worse than a
 * plain queue backlog, but GPS being off is only reported while tracking is
 * actually meant to be running).
 */
export function deriveSyncStatus(input: SyncStatusInputs): SyncStatusResult {
  const { trackingActive, netConnected, gpsAvailable, wsStatus, queueDepth, draining, retryExhausted, lastSyncedAt } = input;

  let status: SyncStatus;

  if (!trackingActive) {
    // Tracking genuinely stopped (employee ended it, or the session was
    // never started) — must never be conflated with a temporary network
    // loss. This is the one state that ISN'T derived from connectivity.
    status = 'stopped';
  } else if (retryExhausted) {
    // The oldest queued fix has failed to send repeatedly. It is NOT
    // dropped (durability is preserved — see offlineQueue.ts) but this
    // needs surfacing distinctly from an ordinary backlog so the employee
    // or a monitor knows something needs attention (e.g. bad accuracy
    // value the server keeps rejecting), not just "still catching up".
    status = 'failed_retry';
  } else if (gpsAvailable === false) {
    // Device location services are off. Tracking can still continue into
    // the offline queue once GPS returns — this state just reports the
    // current fact, it does not stop anything.
    status = 'gps_unavailable';
  } else if (netConnected === false) {
    // No network at all — everything is queuing locally.
    status = queueDepth > 0 ? 'offline' : 'offline';
  } else if (wsStatus === 'connecting') {
    status = 'reconnecting';
  } else if (wsStatus === 'disconnected' && netConnected) {
    // Network is up but the live socket isn't — fixes are still going out
    // via the durable HTTP fallback, so this is "delayed", not "offline".
    status = queueDepth > 0 ? 'upload_pending' : 'network_delayed';
  } else if (draining && queueDepth > 0) {
    status = 'syncing';
  } else if (queueDepth > 0) {
    status = 'upload_pending';
  } else if (wsStatus === 'connected') {
    status = 'live';
  } else {
    status = 'synced';
  }

  return { status, label: LABELS[status], lastSyncedAt };
}
