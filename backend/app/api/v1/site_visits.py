"""
Site Visits API Router.
"""

from fastapi import APIRouter, Depends, Form, UploadFile, File, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Set
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.core.permissions import require_permissions, Permission
from app.core.security import get_current_user, get_current_user_ws
from app.schemas.site_visit import (
    SiteVisitRead, SiteVisitCreate, SiteVisitLocationRead, SiteVisitLocationCreate,
    StartSiteVisitRequest, CompleteSiteVisitRequest, SiteVisitPhotoRead, AddSiteVisitEvidenceRequest
)
from app.services import site_visit_service

class TrackingConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, visit_id: str):
        await websocket.accept()
        if visit_id not in self.active_connections:
            self.active_connections[visit_id] = set()
        self.active_connections[visit_id].add(websocket)

    def disconnect(self, websocket: WebSocket, visit_id: str):
        if visit_id in self.active_connections:
            self.active_connections[visit_id].discard(websocket)
            if not self.active_connections[visit_id]:
                del self.active_connections[visit_id]

    async def broadcast(self, visit_id: str, message: dict):
        if visit_id in self.active_connections:
            for connection in list(self.active_connections[visit_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = TrackingConnectionManager()

router = APIRouter(prefix="/site-visits", tags=["Site Visits"])

_auth = require_permissions()  # Anyone authenticated can access basic operations based on their own assignments
_ceo_auth = require_permissions(Permission.PROJECTS_READ) # Generic CEO-level read

@router.get("", response_model=List[SiteVisitRead])
async def list_site_visits(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    ceo_override: bool = False
):
    dept = getattr(current_user, "department", "")
    desig = getattr(current_user, "designation", "")
    if ceo_override or dept in ["CEO", "Project", "Admin", "Management", "Sales", "Marketing", "Telecalling"] or desig in ["CEO", "Project Head", "Warehouse", "Warehouse Manager", "Stock Maintenance", "Telecaller", "Direct Marketing Executive"]:
        # CEO, Project Head, Warehouse, and Sales/Marketing can see all
        return await site_visit_service.list_site_visits(db)
    else:
        # Site Visitors / Field Techs only see their own assigned visits
        return await site_visit_service.list_site_visits(db, employee_id=current_user.id)

@router.get("/marketing-site-products", response_model=List[SiteVisitRead])
async def get_marketing_site_products(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(_auth)
):
    """Get completed site visits (Site Products) for leads assigned to the authenticated marketing user."""
    dept = getattr(current_user, "department", "")
    desig = getattr(current_user, "designation", "")
    allowed_roles = ["Telecaller", "Direct Marketing Executive", "CEO"]
    
    # Optional role validation, though data isolation guarantees they only see their own anyway
    if not (dept in ["Sales", "Marketing", "Telecalling", "Management", "CEO"] or desig in allowed_roles):
        return []

    return await site_visit_service.get_marketing_site_products(db, current_user.id)

@router.get("/project-stages", response_model=List[str])
async def get_project_stages(
    system_type: str = Query(..., description="System Type (e.g. ON-GRID, OFF-GRID)"),
    current_user = Depends(_auth)
):
    sys = system_type.upper()
    common = ["Structure Erection", "Electrical Work", "Panel Mounting", "DC Wiring Work", "Earthing and Lightning Arrestor"]
    
    if sys == "ON-GRID":
        return common + ["Inverter Installation"]
    elif sys == "OFF-GRID":
        return common + ["Battery Installation"]
    elif sys == "HYBRID":
        return common + ["Inverter Installation", "Battery Installation"]
    elif sys == "SOLAR PUMPSET":
        return ["Structure Erection", "Structure Mounting", "Panel Mounting", "Final Output"]
    else:
        return common + ["Inverter Installation"]


@router.post("", response_model=SiteVisitRead)
async def create_site_visit(
    payload: SiteVisitCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Depending on role, maybe only CEO or Site Visitor can create? We will assume standard auth allows it.
    return await site_visit_service.create_site_visit(db, payload)


@router.get("/{visit_id}", response_model=SiteVisitRead)
async def get_site_visit(
    visit_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    visit = await site_visit_service.get_site_visit(db, visit_id)
    return visit


@router.post("/{visit_id}/start", response_model=SiteVisitRead)
async def start_site_visit(
    visit_id: str,
    payload: StartSiteVisitRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await site_visit_service.start_site_visit(db, visit_id, current_user.id, payload)


@router.post("/{visit_id}/location", response_model=SiteVisitLocationRead)
async def track_location(
    visit_id: str,
    payload: SiteVisitLocationCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await site_visit_service.track_location(db, visit_id, current_user.id, payload)


@router.post("/{visit_id}/photos", response_model=SiteVisitPhotoRead)
async def upload_photo(
    visit_id: str,
    latitude: float = Form(...),
    longitude: float = Form(...),
    accuracy: float = Form(...),
    captured_at: str = Form(...),
    stage: str | None = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await site_visit_service.upload_photo(
        db, visit_id, current_user.id, file, latitude, longitude, accuracy, captured_at, stage
    )


@router.post("/{visit_id}/complete", response_model=SiteVisitRead)
async def complete_site_visit(
    visit_id: str,
    payload: CompleteSiteVisitRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await site_visit_service.complete_site_visit(db, visit_id, current_user.id, payload)


@router.patch("/{visit_id}/evidence", response_model=SiteVisitRead)
async def add_evidence(
    visit_id: str,
    payload: AddSiteVisitEvidenceRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    bypass_owner = current_user.designation in ["CEO", "Project Head", "Warehouse", "Warehouse Manager", "Stock Maintenance"]
    return await site_visit_service.add_site_visit_evidence(db, visit_id, current_user.id, payload, bypass_owner=bypass_owner)

@router.post("/{visit_id}/evidence/files", response_model=SiteVisitRead)
async def upload_evidence_file(
    visit_id: str,
    file_type: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    bypass_owner = current_user.designation in ["CEO", "Project Head", "Warehouse", "Warehouse Manager", "Stock Maintenance"]
    return await site_visit_service.upload_evidence_file(db, visit_id, current_user.id, file_type, file, bypass_owner=bypass_owner)


class CompleteStageRequest(BaseModel):
    stage: str

@router.post("/{visit_id}/stages/complete", response_model=SiteVisitRead)
async def complete_stage(
    visit_id: str,
    payload: CompleteStageRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await site_visit_service.complete_stage(db, visit_id, current_user.id, payload.stage)


@router.post("/{visit_id}/tools/before", response_model=SiteVisitRead)
async def upload_tool_photo_before(
    visit_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Upload before-work tool/equipment photo. Immutable after upload."""
    return await site_visit_service.upload_tool_photo(db, visit_id, current_user.id, file, 'before')


@router.post("/{visit_id}/tools/after", response_model=SiteVisitRead)
async def upload_tool_photo_after(
    visit_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Upload after-work tool/equipment photo. Immutable after upload."""
    return await site_visit_service.upload_tool_photo(db, visit_id, current_user.id, file, 'after')


@router.post("/{visit_id}/submit", response_model=SiteVisitRead)
async def submit_site_visit(
    visit_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Submit the completed site visit. Locks it from further edits."""
    return await site_visit_service.submit_site_visit(db, visit_id, current_user.id)


@router.websocket("/{visit_id}/tracking")
async def site_visit_tracking_ws(
    websocket: WebSocket,
    visit_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user_ws)
):
    await manager.connect(websocket, visit_id)
    is_field_worker = current_user.designation == "Site Visitor"
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if not is_field_worker:
                await websocket.send_json({"error": "Live tracking is available only for Field Workers."})
                continue
            
            # Validation
            visit = await site_visit_service.get_site_visit(db, visit_id)
            if not visit:
                await websocket.send_json({"error": "Site visit not found"})
                continue
            if visit.employee_id != current_user.id:
                await websocket.send_json({"error": "You are not assigned to this visit"})
                continue
            if visit.status != "In Progress":
                await websocket.send_json({"error": "Site visit is not in progress"})
                continue
                
            payload = {
                "site_visit_id": visit_id,
                "employee_id": current_user.id,
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "accuracy": data.get("accuracy"),
                "timestamp": data.get("timestamp")
            }
            
            # Store location history
            try:
                captured_dt = datetime.fromisoformat(data.get("timestamp").replace("Z", "+00:00"))
            except Exception:
                captured_dt = datetime.utcnow()
                
            loc_data = SiteVisitLocationCreate(
                latitude=data.get("latitude"),
                longitude=data.get("longitude"),
                accuracy=data.get("accuracy"),
                captured_at=captured_dt
            )
            await site_visit_service.track_location(db, visit_id, current_user.id, loc_data)
            
            # Broadcast to CEO/Viewers
            await manager.broadcast(visit_id, payload)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, visit_id)
