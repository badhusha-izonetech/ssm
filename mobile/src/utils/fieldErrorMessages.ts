import { ApiError } from '../api/client';

/**
 * Central mapping from a raw failure (network error, ApiError, or anything
 * else a try/catch can throw) to a short, safe, field-worker-facing
 * message. Every field-mobility screen should use this instead of writing
 * its own ad hoc string, so the wording is consistent and — more
 * importantly — so nothing that ever reaches one of these call sites can
 * leak a stack trace, a SQL/SQLAlchemy error, a MinIO internal error, or a
 * filesystem path to the phone screen.
 *
 * The backend's own global exception handler (app/core/exceptions.py)
 * already sanitizes 5xx responses to a generic "Internal server error"
 * before they ever leave the server, so `ApiError.message` is already safe
 * to display as-is for most cases. This layer exists for the cases that
 * happen entirely on-device and never reach that backend safety net at
 * all — no connectivity, timeouts, and generic thrown errors — plus to
 * give a single, intentional set of phrases for the situations field staff
 * actually hit.
 */

export type FieldFailureKind =
  | 'offline'
  | 'upload_failed'
  | 'tracking_interrupted'
  | 'auth_expired'
  | 'forbidden'
  | 'not_found'
  | 'generic';

export interface FieldFailure {
  kind: FieldFailureKind;
  message: string;
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 0;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message?: unknown }).message || '').toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('failed to fetch') ||
      msg.includes('econn')
    );
  }
  return false;
}

/**
 * Classify an upload failure (photo/video/document/measurement/selfie).
 * Queued items are always retried automatically by the media/GPS queues —
 * this message only tells the employee that happened, never why it failed
 * internally.
 */
export function describeUploadFailure(err: unknown): FieldFailure {
  if (isNetworkError(err)) {
    return { kind: 'offline', message: 'Network unavailable. Your update is queued.' };
  }
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return { kind: 'auth_expired', message: 'Your session has expired. Please sign in again.' };
    }
    if (err.status === 403) {
      return { kind: 'forbidden', message: 'You are not authorized to do this.' };
    }
    if (err.status === 404) {
      return { kind: 'not_found', message: 'This record could not be found. Please refresh and try again.' };
    }
  }
  return { kind: 'upload_failed', message: 'Upload failed. Saved for retry.' };
}

/** Classify a live GPS/WebSocket tracking failure. */
export function describeTrackingFailure(err?: unknown): FieldFailure {
  if (err && isNetworkError(err)) {
    return { kind: 'tracking_interrupted', message: 'Tracking connection interrupted. Reconnecting…' };
  }
  return { kind: 'tracking_interrupted', message: 'Tracking connection interrupted. Reconnecting…' };
}

/** Generic fallback for any other field-workflow action (save, submit, complete). */
export function describeActionFailure(err: unknown): FieldFailure {
  if (isNetworkError(err)) {
    return { kind: 'offline', message: 'Network unavailable. Your update is queued.' };
  }
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return { kind: 'auth_expired', message: 'Your session has expired. Please sign in again.' };
    }
    if (err.status === 403) {
      return { kind: 'forbidden', message: 'You are not authorized to do this.' };
    }
    if (err.status === 404) {
      return { kind: 'not_found', message: 'This record could not be found. Please refresh and try again.' };
    }
    if (err.status === 400 || err.status === 409 || err.status === 422) {
      // These are real, actionable validation/business-rule messages the
      // backend already writes for end users (e.g. "Complete all required
      // stages first: ..."), not internals — safe to show directly.
      return { kind: 'generic', message: err.message || 'Unable to complete this action.' };
    }
  }
  return { kind: 'generic', message: 'Unable to complete this action.' };
}
