"""
Call logs router — nested under /leads/{lead_id}/calls.
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import Permission, require_permissions
from app.core.security import get_current_user
from app.schemas.call_log import CallLogCreate, CallLogRead
from app.services.call_log_service import create_call_log, list_call_logs, list_all_call_logs
from app.utils.pagination import PagedResponse, PaginationParams

router = APIRouter(tags=["Call Logs"])

@router.get("/call-logs", response_model=PagedResponse[CallLogRead])
async def get_all_call_logs(
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.CALL_LOGS_READ)),
):
    items, total = await list_all_call_logs(db, params.offset, params.limit)
    return PagedResponse.create([CallLogRead.model_validate(c) for c in items], total, params)


@router.get("/leads/{lead_id}/calls", response_model=List[CallLogRead])
async def get_call_logs(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.CALL_LOGS_READ)),
):
    return [CallLogRead.model_validate(c) for c in await list_call_logs(db, lead_id)]


@router.post("/leads/{lead_id}/calls", response_model=CallLogRead, status_code=201)
async def add_call_log(
    lead_id: str,
    payload: CallLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.CALL_LOGS_WRITE)),
):
    entry = await create_call_log(db, lead_id, payload, current_user)
    return CallLogRead.model_validate(entry)
