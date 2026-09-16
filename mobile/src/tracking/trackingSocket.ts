import { WS_BASE_URL, tokenStore } from '../api/client';
import { GpsFix } from '../types';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * Thin wrapper around the same WebSocket protocol the web app's
 * useSiteVisitTracking hook uses against Site Visit tracking, pointed at
 * the generalized /field-movements/{id}/tracking endpoint added in Phase 1:
 * client sends {latitude, longitude, accuracy, speed?, heading?, timestamp},
 * server persists + broadcasts. Reconnects with backoff; the caller decides
 * what to do with fixes that fail to send (queue.ts owns retry policy).
 */
export class FieldMovementTrackingSocket {
  private ws: WebSocket | null = null;
  private fmId: string;
  private status: WsStatus = 'disconnected';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByCaller = false;

  onStatusChange: ((status: WsStatus) => void) | null = null;
  onError: ((message: string) => void) | null = null;

  constructor(fmId: string) {
    this.fmId = fmId;
  }

  getStatus() {
    return this.status;
  }

  async connect() {
    this.closedByCaller = false;
    const token = await tokenStore.getAccessToken();
    if (!token) {
      this.onError?.('Not authenticated for live tracking');
      return;
    }

    this.setStatus('connecting');
    const url = `${WS_BASE_URL}/field-movements/${this.fmId}/tracking?token=${token}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.error) this.onError?.(data.error);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {
      this.onError?.('Live tracking connection error');
    };

    ws.onclose = () => {
      this.setStatus('disconnected');
      this.ws = null;
      if (!this.closedByCaller) this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    // Exponential backoff, capped at 30s — avoids hammering the backend or
    // draining battery while the phone has no signal (e.g. in a basement).
    const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closedByCaller) this.connect();
    }, delay);
  }

  private setStatus(status: WsStatus) {
    this.status = status;
    this.onStatusChange?.(status);
  }

  /** Returns true if the fix was actually written to the socket. */
  send(fix: GpsFix): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(
      JSON.stringify({
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
        speed: fix.speed ?? null,
        heading: fix.heading ?? null,
        timestamp: new Date(fix.timestamp).toISOString(),
      })
    );
    return true;
  }

  close() {
    this.closedByCaller = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.setStatus('disconnected');
  }
}
