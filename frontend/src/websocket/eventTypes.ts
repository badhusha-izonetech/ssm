export interface WebSocketEvent {
    event: string;
    module: string;
    action: string;
    entity_id?: string;
    data: Record<string, any>;
    timestamp: string;
}
