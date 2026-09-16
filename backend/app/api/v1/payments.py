"""
Payments router — submit, proof upload, verify/reject.
"""

from typing import Optional
from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import Permission, require_permissions
from app.core.security import get_current_user
from app.schemas.payment import PaymentCreate, PaymentRead, PaymentReject, PaymentVerify, PaymentUpdate
from app.services import payment_service
from app.utils.pagination import PagedResponse, PaginationParams

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("", response_model=PagedResponse[PaymentRead])
async def list_payments(
    state: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.PAYMENTS_READ)),
):
    items, total = await payment_service.list_payments(db, state, project_id, params.offset, params.limit)
    return PagedResponse.create([PaymentRead.model_validate(p) for p in items], total, params)


@router.post("", response_model=PaymentRead, status_code=201)
async def create_payment(
    payload: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.PAYMENTS_WRITE)),
):
    p = await payment_service.create_payment(db, payload, current_user)
    return PaymentRead.model_validate(p)


@router.patch("/{payment_id}", response_model=PaymentRead)
async def update_payment(
    payment_id: str,
    payload: PaymentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.PAYMENTS_WRITE)),
):
    p = await payment_service.update_payment(db, payment_id, payload, current_user)
    return PaymentRead.model_validate(p)


@router.post("/{payment_id}/proof", status_code=201)
async def upload_proof(
    payment_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.PAYMENTS_PROOF)),
):
    proof = await payment_service.upload_proof(db, payment_id, file, current_user)
    return {"id": proof.id, "file_url": proof.file_url}


@router.patch("/{payment_id}/verify", response_model=PaymentRead)
async def verify_payment(
    payment_id: str,
    payload: PaymentVerify,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.PAYMENTS_VERIFY)),
):
    p = await payment_service.verify_payment(db, payment_id, payload, current_user)
    return PaymentRead.model_validate(p)


@router.patch("/{payment_id}/reject", response_model=PaymentRead)
async def reject_payment(
    payment_id: str,
    payload: PaymentReject,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.PAYMENTS_VERIFY)),
):
    p = await payment_service.reject_payment(db, payment_id, payload, current_user)
    return PaymentRead.model_validate(p)
