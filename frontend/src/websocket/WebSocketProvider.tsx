import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { wsClient } from './websocketClient';
import { useAuth } from '../auth/AuthContext';
import type { ConnectionState } from './websocketClient';
import type { WebSocketEvent } from './eventTypes';

interface WebSocketContextType {
    connected: boolean;
    connectionState: ConnectionState;
    subscribe: (eventType: string, handler: (e: WebSocketEvent) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const [connectionState, setConnectionState] = useState<ConnectionState>(wsClient.getState());

    const { employee } = useAuth();

    useEffect(() => {
        const unsubscribeState = wsClient.onStateChange((newState) => {
            setConnectionState(newState);
        });

        if (employee) {
            wsClient.connect();
        } else {
            wsClient.disconnect();
        }

        return () => {
            unsubscribeState();
            wsClient.disconnect();
        };
    }, [employee]);

    // Use useCallback to ensure the subscribe function reference is stable across renders
    const subscribe = useCallback((eventType: string, handler: (e: WebSocketEvent) => void) => {
        wsClient.on(eventType, handler);
        return () => {
            wsClient.off(eventType, handler);
        };
    }, []);

    const connected = connectionState === 'connected';

    return (
        <WebSocketContext.Provider value={{ connected, connectionState, subscribe }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
};
