"""
Revenue router — CEO-only endpoints.
"""

from typing import Optional, List

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import Permission, require_permissions
from app.services import revenue_service

router = APIRouter(prefix="/revenue", tags=["Revenue"])


@router.get("/summary")
async def revenue_summary(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.DASHBOARD_CEO)),
):
    """
    Returns revenue summary cards + per-project breakdown + date-wise chart data.
    All filtered by fully_paid_date within [date_from, date_to].
    CEO access only.
    """
    data = await revenue_service.get_revenue_data(db, date_from, date_to)
    return data

@router.get("/employees")
async def get_employee_revenue_summary(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.DASHBOARD_CEO)),
):
    from app.services.employee_revenue_service import get_employee_revenue_summary as get_summary
    return await get_summary(db, date_from, date_to)

@router.get("/employees/{employee_id}")
async def get_employee_revenue_details(
    employee_id: str,
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.DASHBOARD_CEO)),
):
    from app.services.employee_revenue_service import get_employee_revenue_details as get_details
    details = await get_details(db, employee_id, date_from, date_to)
    if not details:
        raise HTTPException(status_code=404, detail="Employee not found")
    return details

