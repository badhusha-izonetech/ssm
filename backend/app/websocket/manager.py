from typing import Dict, List, Set
from fastapi import WebSocket
import asyncio
from app.models.employee import Employee
from app.websocket.events import WebSocketEvent
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Maps employee_id -> List of active WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Maps employee_id -> Employee object for fast role/dept lookup
        self.user_meta: Dict[str, Employee] = {}
        self.lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user: Employee):
        await websocket.accept()
        async with self.lock:
            if user.id not in self.active_connections:
                self.active_connections[user.id] = []
            self.active_connections[user.id].append(websocket)
            self.user_meta[user.id] = user
        logger.info(f"WebSocket connected for user {user.id} ({user.name})")

    async def disconnect(self, websocket: WebSocket, user: Employee):
        async with self.lock:
            if user.id in self.active_connections:
                if websocket in self.active_connections[user.id]:
                    self.active_connections[user.id].remove(websocket)
                if not self.active_connections[user.id]:
                    del self.active_connections[user.id]
                    if user.id in self.user_meta:
                        del self.user_meta[user.id]
        logger.info(f"WebSocket disconnected for user {user.id} ({user.name})")

    async def send_personal_message(self, event: WebSocketEvent, user_id: str):
        connections = self.active_connections.get(user_id, [])
        dead_connections = []
        for connection in list(connections): # iterate over copy
            try:
                await connection.send_text(event.model_dump_json())
            except Exception as e:
                logger.warning(f"Failed to send personal message to {user_id}: {e}")
                dead_connections.append(connection)
        
        # Cleanup dead connections
        if dead_connections:
            async with self.lock:
                for dead in dead_connections:
                    if user_id in self.active_connections and dead in self.active_connections[user_id]:
                        self.active_connections[user_id].remove(dead)
                if user_id in self.active_connections and not self.active_connections[user_id]:
                    del self.active_connections[user_id]
                    if user_id in self.user_meta:
                        del self.user_meta[user_id]

    async def broadcast(self, event: WebSocketEvent):
        for user_id, connections in list(self.active_connections.items()):
            dead_connections = []
            for connection in list(connections):
                try:
                    await connection.send_text(event.model_dump_json())
                except Exception as e:
                    logger.warning(f"Failed to broadcast to {user_id}: {e}")
                    dead_connections.append(connection)
            
            # Cleanup dead connections
            if dead_connections:
                async with self.lock:
                    for dead in dead_connections:
                        if user_id in self.active_connections and dead in self.active_connections[user_id]:
                            self.active_connections[user_id].remove(dead)
                    if user_id in self.active_connections and not self.active_connections[user_id]:
                        del self.active_connections[user_id]
                        if user_id in self.user_meta:
                            del self.user_meta[user_id]

    async def send_to_department(self, event: WebSocketEvent, department: str):
        for user_id, user in list(self.user_meta.items()):
            if user.department == department:
                await self.send_personal_message(event, user_id)

    async def send_to_role(self, event: WebSocketEvent, designation: str):
        for user_id, user in list(self.user_meta.items()):
            if user.designation == designation:
                await self.send_personal_message(event, user_id)
                
    async def send_to_authorized_users(self, event: WebSocketEvent, user_ids: Set[str], departments: Set[str] = None, roles: Set[str] = None):
        """Send to a combination of specific users, departments, and roles without duplicating."""
        departments = departments or set()
        roles = roles or set()
        
        target_users = set(user_ids)
        for user_id, user in list(self.user_meta.items()):
            if user.department in departments or user.designation in roles:
                target_users.add(user_id)
                
        for user_id in target_users:
            await self.send_personal_message(event, user_id)

manager = ConnectionManager()
