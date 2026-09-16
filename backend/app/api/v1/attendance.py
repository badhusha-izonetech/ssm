from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.core.permissions import require_permissions, Permission
from app.core.security import get_current_user
from app.schemas.attendance import AttendanceRecordRead, AttendanceCheckIn
from app.services import attendance_service
from app.models.employee import Employee

router = APIRouter(prefix="/attendance", tags=["Attendance"])

@router.get("", response_model=List[AttendanceRecordRead])
async def list_attendance(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_permissions(Permission.LEAVE_READ)),
):
    return await attendance_service.list_attendance(db, current_user)

@router.post("/check-in", response_model=AttendanceRecordRead)
async def check_in(
    payload: AttendanceCheckIn,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_permissions(Permission.LEAVE_WRITE)),
):
    return await attendance_service.check_in(db, current_user, payload)

@router.post("/check-out", response_model=AttendanceRecordRead)
async def check_out(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_permissions(Permission.LEAVE_WRITE)),
):
    res = await attendance_service.check_out(db, current_user)
    if not res:
        raise HTTPException(status_code=400, detail="Not checked in today.")
    return res
