import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueFix } from './offlineQueue';
import { GpsFix } from '../types';

export const BACKGROUND_LOCATION_TASK = 'ssc-field-background-location';

// The task callback has no React context, so "which session is active" is
// tracked via a tiny AsyncStorage flag that TrackingManager keeps in sync —
// this is the one piece of state that must survive process death, since the
// OS can restart the background task without restarting the JS app fully.
const ACTIVE_SESSION_KEY = 'ssc_field_active_tracking_session';
const LAST_TASK_ERROR_KEY = 'ssc_field_last_location_error';

export async function setActiveTrackingSessionId(fmId: string | null) {
  if (fmId) await AsyncStorage.setItem(ACTIVE_SESSION_KEY, fmId);
  else await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
}

export async function getActiveTrackingSessionId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_SESSION_KEY);
}

/**
 * The task callback can outlive any mounted screen, so a permission
 * revocation or GPS-disabled error it hits has nowhere to surface directly.
 * It's recorded here instead; TrackingScreen checks this on every foreground
 * transition (see its AppState listener) so the employee isn't silently
 * un-tracked without ever finding out.
 */
export async function recordLocationTaskError(message: string) {
  await AsyncStorage.setItem(LAST_TASK_ERROR_KEY, JSON.stringify({ message, at: Date.now() }));
}

export async function consumeLastLocationTaskError(): Promise<{ message: string; at: number } | null> {
  const raw = await AsyncStorage.getItem(LAST_TASK_ERROR_KEY);
  if (!raw) return null;
  await AsyncStorage.removeItem(LAST_TASK_ERROR_KEY);
  return JSON.parse(raw);
}

/**
 * IMPORTANT: this file must be imported once at module scope (see App.tsx)
 * BEFORE Location.startLocationUpdatesAsync() is ever called, and the task
 * must be defined outside of any component/hook — this is how Expo wires a
 * JS callback to fire even while the app is backgrounded, driven by the
 * native Android foreground-service location updates (see app.config.js's
 * isAndroidForegroundServiceEnabled).
 *
 * The task only ever *records* fixes into the durable offline queue — it
 * does not touch the network or React state directly, since it can run
 * outside of any mounted screen. TrackingManager's queue pump (running
 * whenever the app/task is alive) is responsible for actually sending them.
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[locationTask] error', error.message);
    await recordLocationTaskError(error.message);
    return;
  }
  const { locations } = (data as { locations: Location.LocationObject[] }) || { locations: [] };
  if (!locations?.length) return;

  const activeFmId = await getActiveTrackingSessionId();
  if (!activeFmId) return; // no active session — drop stray fixes defensively

  for (const loc of locations) {
    const fix: GpsFix = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? 9999,
      speed: loc.coords.speed,
      heading: loc.coords.heading,
      timestamp: loc.timestamp,
    };
    await enqueueFix(activeFmId, fix);
  }
});
