import { API_BASE_URL } from '../api/client';
import type { WebSocketEvent } from './eventTypes';

type EventHandler = (event: WebSocketEvent) => void;
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
type StateChangeHandler = (state: ConnectionState) => void;

export class WebSocketClient {
    private ws: WebSocket | null = null;
    private handlers: Map<string, Set<EventHandler>> = new Map();
    private stateHandlers: Set<StateChangeHandler> = new Set();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private isIntentionallyClosed = false;
    private pingInterval: number | null = null;
    private reconnectTimeout: number | null = null;
    private currentState: ConnectionState = 'disconnected';

    private getUrl(): string {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let baseUrl = API_BASE_URL;
        if (baseUrl.startsWith('http')) {
            baseUrl = baseUrl.replace(/^http(s?):\/\//, `${wsProtocol}//`);
        } else if (baseUrl.startsWith('/')) {
            baseUrl = `${wsProtocol}//${window.location.host}${baseUrl}`;
        }
        // Ensure no double slashes before /ws
        return `${baseUrl.replace(/\/+$/, '')}/ws`;
    }

    private setState(newState: ConnectionState) {
        if (this.currentState !== newState) {
            this.currentState = newState;
            this.stateHandlers.forEach(handler => handler(newState));
        }
    }

    public getState(): ConnectionState {
        return this.currentState;
    }

    public onStateChange(handler: StateChangeHandler) {
        this.stateHandlers.add(handler);
        handler(this.currentState); // Immediate feedback
        return () => this.stateHandlers.delete(handler);
    }

    public connect() {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        this.isIntentionallyClosed = false;
        
        if (this.ws) {
            // Close existing to prevent multiple
            this.ws.close();
            this.ws = null;
        }

        if (this.reconnectTimeout !== null) {
            window.clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

        const url = new URL(this.getUrl());
        url.searchParams.set('token', token);

        const currentWs = new WebSocket(url.toString());
        this.ws = currentWs;

        currentWs.onopen = () => {
            if (this.ws !== currentWs) return;
            console.log('[WebSocket] Connected');
            this.reconnectAttempts = 0;
            this.setState('connected');
            
            if (this.pingInterval !== null) {
                window.clearInterval(this.pingInterval);
            }
            this.pingInterval = window.setInterval(() => {
                if (this.ws?.readyState === WebSocket.OPEN) {
                    this.ws.send('ping');
                }
            }, 30000);
        };

        currentWs.onmessage = (message) => {
            if (this.ws !== currentWs) return;
            if (message.data === 'pong') return;
            try {
                const event: WebSocketEvent = JSON.parse(message.data);
                this.emit(event.event, event);
                this.emit('*', event);
            } catch (err) {
                console.error('[WebSocket] Parse error:', err);
            }
        };

        currentWs.onclose = (e) => {
            if (this.ws !== currentWs) return;
            console.log('[WebSocket] Disconnected', e.code, e.reason);
            this.setState('disconnected');
            if (this.pingInterval !== null) {
                window.clearInterval(this.pingInterval);
                this.pingInterval = null;
            }
            if (!this.isIntentionallyClosed) {
                this.reconnect();
            }
        };

        currentWs.onerror = (error) => {
            if (this.ws !== currentWs) return;
            console.error('[WebSocket] Error:', error);
            this.setState('error');
        };
    }

    private reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WebSocket] Max reconnect attempts reached');
            this.setState('disconnected');
            return;
        }

        const timeout = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.setState('reconnecting');
        
        if (this.reconnectTimeout !== null) {
            window.clearTimeout(this.reconnectTimeout);
        }
        
        this.reconnectTimeout = window.setTimeout(() => {
            console.log(`[WebSocket] Reconnecting (Attempt ${this.reconnectAttempts + 1})...`);
            this.reconnectAttempts++;
            this.connect(); // uses latest token automatically
        }, timeout);
    }

    public disconnect() {
        this.isIntentionallyClosed = true;
        this.reconnectAttempts = 0;
        
        if (this.pingInterval !== null) {
            window.clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        if (this.reconnectTimeout !== null) {
            window.clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.setState('disconnected');
    }

    public on(eventType: string, handler: EventHandler) {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }
        this.handlers.get(eventType)!.add(handler);
    }

    public off(eventType: string, handler: EventHandler) {
        if (this.handlers.has(eventType)) {
            this.handlers.get(eventType)!.delete(handler);
        }
    }

    private emit(eventType: string, event: WebSocketEvent) {
        const typeHandlers = this.handlers.get(eventType);
        if (typeHandlers) {
            typeHandlers.forEach(handler => handler(event));
        }
    }
}

export const wsClient = new WebSocketClient();
