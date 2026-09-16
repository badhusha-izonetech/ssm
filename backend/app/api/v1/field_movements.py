"""
Field movements router — CEO all, self-only endpoints, plus real-time GPS
tracking (REST fallback + live WebSocket) and tracking history retrieval.
"""

from typing import Dict, Set

from fastapi import APIRouter, Depends, File, UploadFile, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import Permission, require_permissions, get_permissions
from app.core.security import get_current_user, get_current_user_ws
from app.schemas.field_movement import (
    FieldMovementRead,
    FieldMovementStart,
    FieldMovementUpdate,
    NoteCreate,
    NoteRead,
    PhotoRead,
    FieldMovementLocationCreate,
    FieldMovementLocationRead,
)
from app.services import field_movement_service
from app.utils.pagination import PagedResponse, PaginationParams

router = APIRouter(prefix="/field-movements", tags=["Field Movements"])

_read = require_permissions(Permission.FIELD_MOVEMENTS_READ, Permission.FIELD_MOVEMENTS_READ_OWN)
_write = require_permissions(Permission.FIELD_MOVEMENTS_WRITE)


# ── Live tracking WebSocket connection manager ──────────────────────────────
# Same pattern as TrackingConnectionManager in api/v1/site_visits.py, scoped
# per field_movement_id ("room" = one tracking session). Kept in-process/
# in-memory, consistent with the existing Site Visit implementation — this is
# not a new infrastructure pattern, just the same one applied generically.
class FieldMovementTrackingManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, fm_id: str):
        await websocket.accept()
        self.active_connections.setdefault(fm_id, set()).add(websocket)

    def disconnect(self, websocket: WebSocket, fm_id: str):
        if fm_id in self.active_connections:
            self.active_connections[fm_id].discard(websocket)
            if not self.active_connections[fm_id]:
                del self.active_connections[fm_id]

    async def broadcast(self, fm_id: str, message: dict):
        if fm_id in self.active_connections:
            for connection in list(self.active_connections[fm_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    pass


manager = FieldMovementTrackingManager()


def _read_any_or_own():
    from app.core.permissions import get_permissions
    from fastapi import HTTPException, status
    async def dep(current_user=Depends(get_current_user)):
        perms = get_permissions(current_user.designation)
        if Permission.FIELD_MOVEMENTS_READ not in perms and Permission.FIELD_MOVEMENTS_READ_OWN not in perms:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
        return current_user
    return dep


@router.get("", response_model=PagedResponse[FieldMovementRead])
async def list_all(
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_read_any_or_own()),
):
    emp_id = None
    from app.core.permissions import get_permissions
    perms = get_permissions(current_user.designation)
    if Permission.FIELD_MOVEMENTS_READ not in perms:
        emp_id = current_user.id
        
    items, total = await field_movement_service.list_field_movements(db, employee_id=emp_id, offset=params.offset, limit=params.limit)
    return PagedResponse.create([FieldMovementRead.model_validate(i) for i in items], total, params)


@router.get("/mine", response_model=PagedResponse[FieldMovementRead])
async def list_mine(
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_read_any_or_own()),
):
    items, total = await field_movement_service.list_field_movements(
        db, employee_id=current_user.id, offset=params.offset, limit=params.limit
    )
    return PagedResponse.create([FieldMovementRead.model_validate(i) for i in items], total, params)


@router.post("/start", response_model=FieldMovementRead, status_code=201)
async def start(
    payload: FieldMovementStart,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.FIELD_MOVEMENTS_WRITE)),
):
    fm = await field_movement_service.start_field_movement(db, payload, current_user)
    return FieldMovementRead.model_validate(fm)


@router.patch("/{fm_id}", response_model=FieldMovementRead)
async def update(
    fm_id: str,
    payload: FieldMovementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.FIELD_MOVEMENTS_WRITE)),
):
    fm = await field_movement_service.update_field_movement(db, fm_id, payload, current_user)
    return FieldMovementRead.model_validate(fm)


@router.post("/{fm_id}/photo", response_model=PhotoRead, status_code=201)
async def upload_photo(
    fm_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.FIELD_MOVEMENTS_WRITE)),
):
    photo = await field_movement_service.add_photo(db, fm_id, file, current_user)
    return PhotoRead.model_validate(photo)


@router.post("/{fm_id}/notes", response_model=NoteRead, status_code=201)
async def add_note(
    fm_id: str,
    payload: NoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.FIELD_MOVEMENTS_WRITE)),
):
    note = await field_movement_service.add_note(db, fm_id, payload, current_user)
    return NoteRead.model_validate(note)


@router.post("/{fm_id}/stop", response_model=FieldMovementRead)
async def stop(
    fm_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.FIELD_MOVEMENTS_WRITE)),
):
    """STOP WORK -> Tracking ENDED. Explicit endpoint alongside the generic
    PATCH so mobile clients have one unambiguous call to end a session."""
    fm = await field_movement_service.stop_field_movement(db, fm_id, current_user)
    return FieldMovementRead.model_validate(fm)


@router.post("/{fm_id}/location", response_model=FieldMovementLocationRead, status_code=201)
async def track_location(
    fm_id: str,
    payload: FieldMovementLocationCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.FIELD_MOVEMENTS_WRITE)),
):
    """
    HTTP fallback for recording a GPS fix — used by the mobile app's offline
    queue to flush locations captured while the WebSocket was disconnected
    (network loss), and usable on its own by any client that doesn't want to
    hold a live socket open.
    """
    loc = await field_movement_service.track_field_movement_location(db, fm_id, current_user, payload)
    return FieldMovementLocationRead.model_validate(loc)


@router.get("/{fm_id}/locations", response_model=PagedResponse[FieldMovementLocationRead])
async def list_locations(
    fm_id: str,
    params: PaginationParams = Depends(),
    max_points: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_read_any_or_own()),
):
    """
    Tracking history retrieval for a single session.

    - Default (no `max_points`): plain offset/limit pagination, oldest-first.
    - `?max_points=N`: ignores pagination and returns an evenly-downsampled
      full-session route capped at N points — this is what the CEO route
      review screen uses so a full-day session never ships thousands of
      points to the browser at once.
    """
    perms = get_permissions(current_user.designation)
    if Permission.FIELD_MOVEMENTS_READ not in perms:
        fm = await field_movement_service.get_field_movement(db, fm_id)
        if fm.employee_id != current_user.id:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    if max_points is not None:
        items, total = await field_movement_service.get_downsampled_locations(db, fm_id, max_points)
        return PagedResponse(items=[FieldMovementLocationRead.model_validate(i) for i in items], total=total, page=1, page_size=len(items), total_pages=1)

    items, total = await field_movement_service.list_field_movement_locations(
        db, fm_id, current_user, offset=params.offset, limit=params.limit
    )
    return PagedResponse.create([FieldMovementLocationRead.model_validate(i) for i in items], total, params)


@router.websocket("/{fm_id}/tracking")
async def field_movement_tracking_ws(
    websocket: WebSocket,
    fm_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user_ws),
):
    """
    Live GPS WebSocket, mirroring the Site Visit tracking WS
    (api/v1/site_visits.py) but generalized to any FieldMovement session:

      - The owning field worker sends {latitude, longitude, accuracy,
        speed?, heading?, timestamp} frames; each is persisted via
        track_field_movement_location and broadcast to every other socket
        connected to the same fm_id "room" (i.e. the CEO's live map).
      - Any other authenticated, authorized socket (CEO/manager) can connect
        purely to listen — it never needs to send anything.
    """
    await manager.connect(websocket, fm_id)

    perms = get_permissions(current_user.designation)
    can_view = Permission.FIELD_MOVEMENTS_READ in perms or Permission.FIELD_MOVEMENTS_READ_OWN in perms
    if not can_view:
        await websocket.send_json({"error": "Not authorized for field movement tracking"})
        manager.disconnect(websocket, fm_id)
        await websocket.close()
        return

    try:
        fm = await field_movement_service.get_field_movement(db, fm_id)
    except Exception:
        await websocket.send_json({"error": "Field movement not found"})
        manager.disconnect(websocket, fm_id)
        await websocket.close()
        return

    is_owner = fm.employee_id == current_user.id

    try:
        while True:
            data = await websocket.receive_json()

            if not is_owner:
                await websocket.send_json({"error": "Only the assigned employee can send location updates."})
                continue

            from app.schemas.field_movement import FieldMovementLocationCreate as _LocCreate
            from datetime import datetime as _dt

            try:
                captured_dt = _dt.fromisoformat(str(data.get("timestamp")).replace("Z", "+00:00"))
            except Exception:
                captured_dt = _dt.utcnow()

            try:
                loc_payload = _LocCreate(
                    latitude=data.get("latitude"),
                    longitude=data.get("longitude"),
                    accuracy=data.get("accuracy"),
                    speed=data.get("speed"),
                    heading=data.get("heading"),
                    captured_at=captured_dt,
                )
                await field_movement_service.track_field_movement_location(db, fm_id, current_user, loc_payload)
            except Exception as exc:
                await websocket.send_json({"error": str(getattr(exc, "detail", exc))})
                continue

            payload = {
                "field_movement_id": fm_id,
                "employee_id": current_user.id,
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "accuracy": data.get("accuracy"),
                "speed": data.get("speed"),
                "heading": data.get("heading"),
                "timestamp": data.get("timestamp"),
            }
            await manager.broadcast(fm_id, payload)

    except WebSocketDisconnect:
        manager.disconnect(websocket, fm_id)
