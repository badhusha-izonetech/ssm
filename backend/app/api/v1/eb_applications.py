"""
EB Applications Router
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, File, UploadFile, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import Permission, require_permissions
from app.core.security import get_current_user
from app.utils.pagination import PagedResponse, PaginationParams
from app.schemas.eb_application import (
    EbApplicationRead, EbVerificationUpdate, EbPortalSubmission, EbHandover, EbDashboardCounters, EbStageHistoryRead, EbDocumentRead
)
from app.services import eb_application_service

router = APIRouter(prefix="/eb-applications", tags=["EB Applications"])

@router.get("", response_model=PagedResponse[EbApplicationRead])
async def list_eb_applications(
    search: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user), # All can read, service handles filtering
):
    items, total = await eb_application_service.list_eb_applications(
        db, current_user, search, stage, params.offset, params.limit
    )
    return PagedResponse.create([EbApplicationRead.model_validate(p) for p in items], total, params)

@router.get("/dashboard", response_model=EbDashboardCounters)
async def get_dashboard_counters(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await eb_application_service.get_dashboard_counters(db, current_user)

@router.get("/{application_id}", response_model=EbApplicationRead)
async def get_eb_application(
    application_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    eb = await eb_application_service.get_eb_application(db, application_id, current_user)
    return EbApplicationRead.model_validate(eb)

@router.get("/{application_id}/history", response_model=List[EbStageHistoryRead])
async def get_stage_history(
    application_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    history = await eb_application_service.get_stage_history(db, application_id)
    return [EbStageHistoryRead.model_validate(h) for h in history]


@router.post("/{application_id}/documents", response_model=EbDocumentRead, status_code=201)
async def upload_document(
    application_id: str,
    document_type: str = Form(...),
    remarks: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    doc = await eb_application_service.upload_document(db, application_id, file, document_type, remarks, current_user)
    return EbDocumentRead.model_validate(doc)


@router.patch("/{application_id}/verify", response_model=EbApplicationRead)
async def verify_documents(
    application_id: str,
    payload: EbVerificationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    eb = await eb_application_service.verify_documents(db, application_id, payload, current_user)
    return EbApplicationRead.model_validate(eb)


@router.patch("/{application_id}/portal-submit", response_model=EbApplicationRead)
async def submit_portal(
    application_id: str,
    payload: EbPortalSubmission,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    eb = await eb_application_service.submit_portal(db, application_id, payload, current_user)
    return EbApplicationRead.model_validate(eb)


@router.patch("/{application_id}/handover", response_model=EbApplicationRead)
async def handover_application(
    application_id: str,
    payload: EbHandover,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    eb = await eb_application_service.handover(db, application_id, payload, current_user)
    return EbApplicationRead.model_validate(eb)
