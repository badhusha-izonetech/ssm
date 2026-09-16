from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
from app.core.security import get_current_user_ws
from app.models.employee import Employee
from app.websocket.manager import manager

router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    current_user: Employee = Depends(get_current_user_ws)
):
    await manager.connect(websocket, current_user)
    try:
        while True:
            # Maintain connection and respond to heartbeat
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await manager.disconnect(websocket, current_user)
    except asyncio.CancelledError:
        await manager.disconnect(websocket, current_user)
    except Exception as e:
        import logging
        logging.error(f"WebSocket error for user {current_user.id}: {e}")
        await manager.disconnect(websocket, current_user)
