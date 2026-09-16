import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { BACKGROUND_LOCATION_TASK, setActiveTrackingSessionId } from './locationTask';
import { peekQueue, dequeueSent, markHeadAttemptFailed, isRetryExhausted } from './offlineQueue';
import { FieldMovementTrackingSocket, WsStatus } from './trackingSocket';
import { postLocation } from '../api/fieldMovements';
import { GpsFix } from '../types';
import { deriveSyncStatus, SyncStatusResult } from './syncStatus';

export type PermissionOutcome =
  | 'granted' // foreground + background both granted
  | 'foreground_only' // background denied — tracking will pause when backgrounded
  | 'denied';

export interface TrackingListeners {
  onWsStatus?: (status: WsStatus) => void;
  onError?: (message: string) => void;
  onQueueDepth?: (depth: number) => void;
  onFix?: (fix: GpsFix) => void;
  /** Fired whenever the unified operational status (Live/Offline/Syncing/…)
   * changes, computed from real network/GPS/queue/socket state — see
   * syncStatus.ts. This is the single source of truth the UI should render
   * instead of reading wsStatus/queueDepth separately. */
  onSyncStatus?: (result: SyncStatusResult) => void;
}

/**
 * Owns the full lifecycle of one active tracking session:
 *   requestPermissions -> start (background task + WS) -> stop
 * and the periodic pump that drains the offline queue (WS first, HTTP
 * fallback) whenever there's something to send and the app is reachable.
 *
 * Screens should only ever talk to this class, never to expo-location or
 * the socket directly, so permission/lifecycle handling stays in one place.
 */
export class TrackingManager {
  private fmId: string | null = null;
  private socket: FieldMovementTrackingSocket | null = null;
  private pumpTimer: ReturnType<typeof setInterval> | null = null;
  private gpsCheckTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSub: { remove: () => void } | null = null;
  private netInfoUnsub: (() => void) | null = null;
  private listeners: TrackingListeners = {};
  private draining = false;

  // Real signals feeding the unified sync-status derivation (syncStatus.ts).
  // Never faked/defaulted to a "healthy" value — start as unknown (null)
  // until an actual NetInfo/Location check reports in.
  private trackingActive = false;
  private netConnected: boolean | null = null;
  private gpsAvailable: boolean | null = null;
  private wsStatus: WsStatus = 'disconnected';
  private queueDepthValue = 0;
  private retryExhausted = false;
  private lastSyncedAt: number | null = null;

  async requestPermissions(): Promise<PermissionOutcome> {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return 'denied';

    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === 'granted' ? 'granted' : 'foreground_only';
  }

  async isLocationServicesEnabled(): Promise<boolean> {
    return Location.hasServicesEnabledAsync();
  }

  async start(fmId: string, listeners: TrackingListeners = {}): Promise<void> {
    this.fmId = fmId;
    this.listeners = listeners;
    this.trackingActive = true;
    this.retryExhausted = false;
    this.lastSyncedAt = null;
    await setActiveTrackingSessionId(fmId);

    // Seed real network/GPS state immediately rather than leaving the
    // status derivation guessing until the first event/pump fires.
    const netState = await NetInfo.fetch();
    this.netConnected = !!netState.isConnected;
    this.gpsAvailable = await this.isLocationServicesEnabled();
    this.emitStatus();

    // Live channel — best-effort; the offline queue means fixes are never
    // lost even if this never connects (e.g. no signal at start of shift).
    this.socket = new FieldMovementTrackingSocket(fmId);
    this.socket.onStatusChange = (status) => {
      this.wsStatus = status;
      this.listeners.onWsStatus?.(status);
      this.emitStatus();
    };
    this.socket.onError = (msg) => this.listeners.onError?.(msg);
    await this.socket.connect();

    const already = await TaskManager_isTaskRegisteredSafe(BACKGROUND_LOCATION_TASK);
    if (!already) {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        // 10s / 30m: frequent enough for a meaningful live trail on a map,
        // sparse enough to be reasonable on battery for a full field day.
        // Tune per real-device battery testing in Phase 4.
        timeInterval: 10000,
        distanceInterval: 30,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Success Solar — Field tracking active',
          notificationBody: 'Your location is being shared while field work is in progress.',
        },
        pausesUpdatesAutomatically: false,
      });
    }

    // Drain the queue on a steady cadence, and immediately whenever
    // connectivity comes back — that's the moment queued fixes matter most.
    this.pumpTimer = setInterval(() => this.drainQueue(), 5000);
    this.netInfoUnsub = NetInfo.addEventListener((state) => {
      this.netConnected = !!state.isConnected;
      this.emitStatus();
      if (state.isConnected) this.drainQueue();
    });
    this.appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        this.refreshGpsAvailability();
        this.drainQueue();
      }
    });
    // GPS can be toggled off/on mid-shift with no event to listen for
    // cross-platform in expo-location, so poll it on the same cadence as
    // the queue pump — cheap, and this is exactly the signal
    // "GPS Unavailable" needs to be real rather than assumed.
    this.gpsCheckTimer = setInterval(() => this.refreshGpsAvailability(), 5000);
  }

  private async refreshGpsAvailability(): Promise<void> {
    const enabled = await this.isLocationServicesEnabled();
    if (enabled !== this.gpsAvailable) {
      this.gpsAvailable = enabled;
      this.emitStatus();
    }
  }

  private emitStatus(): void {
    const result = deriveSyncStatus({
      trackingActive: this.trackingActive,
      netConnected: this.netConnected,
      gpsAvailable: this.gpsAvailable,
      wsStatus: this.wsStatus,
      queueDepth: this.queueDepthValue,
      draining: this.draining,
      retryExhausted: this.retryExhausted,
      lastSyncedAt: this.lastSyncedAt,
    });
    this.listeners.onSyncStatus?.(result);
  }

  /** Sends everything currently queued, WS first, falling back to HTTP per-fix. */
  private async drainQueue(): Promise<void> {
    if (!this.fmId || this.draining) return;
    this.draining = true;
    this.emitStatus();
    try {
      const queue = await peekQueue(this.fmId);
      this.queueDepthValue = queue.length;
      this.listeners.onQueueDepth?.(queue.length);
      if (!queue.length) {
        this.retryExhausted = false;
        this.emitStatus();
        return;
      }

      let sent = 0;
      for (const fix of queue) {
        const wsOk = this.socket?.send(fix) ?? false;
        if (wsOk) {
          sent += 1;
          this.lastSyncedAt = Date.now();
          this.listeners.onFix?.(fix);
          continue;
        }
        // WS not connected/available — fall back to the REST endpoint so
        // fixes still make it to the backend even mid-outage. The backend
        // upsert on (field_movement_id, captured_at) makes this fallback
        // safe to retry without creating duplicate points.
        try {
          await postLocation(this.fmId, fix);
          sent += 1;
          this.lastSyncedAt = Date.now();
          this.listeners.onFix?.(fix);
        } catch {
          // Record the failed attempt against the still-queued item
          // (never dropped — durability) and stop draining this pass,
          // keeping ordering; the next pump retries it.
          await markHeadAttemptFailed(this.fmId);
          break;
        }
      }
      if (sent > 0) {
        await dequeueSent(this.fmId, sent);
      }
      this.queueDepthValue = (await peekQueue(this.fmId)).length;
      this.listeners.onQueueDepth?.(this.queueDepthValue);
      this.retryExhausted = await isRetryExhausted(this.fmId);
    } finally {
      this.draining = false;
      this.emitStatus();
    }
  }

  /** Manual immediate fix, e.g. for "start work" GPS validation before a session exists. */
  async getCurrentFix(): Promise<GpsFix> {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? 9999,
      speed: pos.coords.speed,
      heading: pos.coords.heading,
      timestamp: pos.timestamp,
    };
  }

  async stop(): Promise<void> {
    const fmId = this.fmId;
    if (this.pumpTimer) clearInterval(this.pumpTimer);
    this.pumpTimer = null;
    if (this.gpsCheckTimer) clearInterval(this.gpsCheckTimer);
    this.gpsCheckTimer = null;
    this.netInfoUnsub?.();
    this.netInfoUnsub = null;
    this.appStateSub?.remove();
    this.appStateSub = null;

    // One last drain attempt so nothing captured right up to "stop" is lost.
    // Tracking is still marked active during this final flush, so the
    // status correctly reads "Syncing"/"Upload Pending" rather than jumping
    // straight to "Tracking Stopped" while there's still real work queued.
    if (fmId) await this.drainQueue();

    this.trackingActive = false;
    this.emitStatus();

    const registered = await TaskManager_isTaskRegisteredSafe(BACKGROUND_LOCATION_TASK);
    if (registered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
    await setActiveTrackingSessionId(null);

    this.socket?.close();
    this.socket = null;
    this.fmId = null;
  }
}

async function TaskManager_isTaskRegisteredSafe(taskName: string): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(taskName);
  } catch {
    return false;
  }
}

export const trackingManager = new TrackingManager();
