"""
Projects router — create, stage transition, assign.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import Permission, require_permissions
from app.core.security import get_current_user
from app.schemas.project import ProjectAssign, ProjectCreate, ProjectPaymentBreakdown, ProjectRead, ProjectStageUpdate, ProjectUpdate
from app.services import project_service
from app.utils.pagination import PagedResponse, PaginationParams

router = APIRouter(prefix="/projects", tags=["Projects"])


def _to_project_read(p) -> ProjectRead:
    """Convert Project ORM to ProjectRead, explicitly injecting payment_breakdown."""
    r = ProjectRead.model_validate(p)
    if r.payment_breakdown is None:
        try:
            bd = p.payment_breakdown
            if bd:
                r.payment_breakdown = ProjectPaymentBreakdown(**bd)
        except Exception:
            pass
    return r


@router.get("", response_model=PagedResponse[ProjectRead])
async def list_projects(
    stage: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.PROJECTS_READ)),
):
    items, total = await project_service.list_projects(db, stage, status, params.offset, params.limit)
    return PagedResponse.create([_to_project_read(p) for p in items], total, params)


@router.post("", response_model=ProjectRead, status_code=201)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.PROJECTS_WRITE)),
):
    p = await project_service.create_project(db, payload, current_user)
    return ProjectRead.model_validate(p)


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.PROJECTS_READ)),
):
    p = await project_service._get_project(db, project_id)
    return _to_project_read(p)


@router.patch("/{project_id}/stage", response_model=ProjectRead)
async def advance_stage(
    project_id: str,
    payload: ProjectStageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.PROJECTS_STAGE)),
):
    p = await project_service.advance_stage(db, project_id, payload, current_user)
    return ProjectRead.model_validate(p)


@router.patch("/{project_id}/assign", response_model=ProjectRead)
async def assign_project(
    project_id: str,
    payload: ProjectAssign,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.PROJECTS_ASSIGN)),
):
    p = await project_service.assign_project(db, project_id, payload, current_user)
    return ProjectRead.model_validate(p)


@router.post("/{project_id}/uploads", response_model=ProjectRead)
async def upload_project_file(
    project_id: str,
    file_type: str = Form(...),
    stage: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Field Technician uploads photo/video for an assigned project.
    """
    p = await project_service.upload_project_file(
        db, project_id, current_user, file_type, file, stage, latitude, longitude
    )
    return ProjectRead.model_validate(p)


from pydantic import BaseModel as _BaseModel

class InstallationStatusUpdate(_BaseModel):
    installation_status: str  # "Not Started" | "In Progress" | "Completed"
    remarks: Optional[str] = None


@router.patch("/{project_id}/installation-status", response_model=ProjectRead)
async def update_installation_status(
    project_id: str,
    payload: InstallationStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Field Technician updates installation status.
    When marked 'Completed', Project Head is notified in real-time via WebSocket.
    """
    p = await project_service.update_installation_status(
        db, project_id, payload.installation_status, payload.remarks, current_user
    )
    return ProjectRead.model_validate(p)

