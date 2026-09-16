"""
Leads router — includes /existing-customer and /follow-ups sub-paths.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import Permission, require_permissions
from app.core.security import get_current_user
from app.schemas.lead import (
    ExistingCustomerLeadCreate,
    LeadCreate,
    LeadRead,
    LeadReassign,
    LeadStatusUpdate,
    LeadUpdate,
)
from app.services import lead_service
from app.utils.pagination import PagedResponse, PaginationParams

router = APIRouter(prefix="/leads", tags=["Leads"])

_read = require_permissions(Permission.LEADS_READ, Permission.LEADS_READ_OWN)
_write = require_permissions(Permission.LEADS_WRITE)


def _read_or_own():
    from app.core.permissions import Permission, get_permissions
    from fastapi import Depends, HTTPException, status
    async def dep(current_user=Depends(get_current_user)):
        perms = get_permissions(current_user.designation)
        if Permission.LEADS_READ not in perms and Permission.LEADS_READ_OWN not in perms:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return current_user
    return dep


@router.get("", response_model=PagedResponse[LeadRead])
async def list_leads(
    status: Optional[str] = Query(None),
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_read_or_own()),
):
    items, total = await lead_service.list_leads(db, current_user, status, params.offset, params.limit)
    return PagedResponse.create([LeadRead.model_validate(l) for l in items], total, params)


@router.post("", response_model=LeadRead, status_code=201)
async def create_lead(
    payload: LeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.LEADS_WRITE)),
):
    lead = await lead_service.create_lead(db, payload, current_user)
    return LeadRead.model_validate(lead)


@router.post("/existing-customer", response_model=LeadRead, status_code=201)
async def create_existing_customer_lead(
    payload: ExistingCustomerLeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.LEADS_WRITE)),
):
    lead = await lead_service.create_existing_customer_lead(db, payload, current_user)
    return LeadRead.model_validate(lead)


@router.get("/follow-ups", response_model=PagedResponse[LeadRead])
async def follow_ups(
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_read_or_own()),
):
    items, total = await lead_service.list_follow_ups(db, current_user, params.offset, params.limit)
    return PagedResponse.create([LeadRead.model_validate(l) for l in items], total, params)


@router.get("/{lead_id}", response_model=LeadRead)
async def get_lead(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(_read_or_own()),
):
    from sqlalchemy import select
    from app.models.lead import Lead
    result = await db.execute(select(Lead).where(Lead.id == lead_id, Lead.is_deleted == False))
    return LeadRead.model_validate(result.scalar_one())


@router.patch("/{lead_id}/status", response_model=LeadRead)
async def update_lead_status(
    lead_id: str,
    payload: LeadStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.LEADS_WRITE)),
):
    lead = await lead_service.update_lead_status(db, lead_id, payload, current_user)
    return LeadRead.model_validate(lead)


@router.patch("/{lead_id}/reassign", response_model=LeadRead)
async def reassign_lead(
    lead_id: str,
    payload: LeadReassign,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.LEADS_REASSIGN)),
):
    lead = await lead_service.reassign_lead(db, lead_id, payload)
    return LeadRead.model_validate(lead)
