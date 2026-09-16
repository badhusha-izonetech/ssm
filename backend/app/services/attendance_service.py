from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timezone
import pytz

from app.models.attendance_record import AttendanceRecord
from app.models.employee import Employee
from app.schemas.attendance import AttendanceCheckIn

# IST timezone
IST = pytz.timezone('Asia/Kolkata')

async def list_attendance(db: AsyncSession, current_user: Employee):
    from app.core.permissions import portal_for

    # Admin sees all, employee sees own
    stmt = select(AttendanceRecord).order_by(AttendanceRecord.created_at.desc())
    if portal_for(current_user.designation) != "CEO":
        stmt = stmt.where(AttendanceRecord.employee_id == current_user.id)
    
    result = await db.execute(stmt)
    return result.scalars().all()

async def check_in(db: AsyncSession, current_user: Employee, payload: AttendanceCheckIn):
    now = datetime.now(IST)
    today = now.strftime('%Y-%m-%d')
    time_str = now.strftime('%I:%M %p')

    # Check if already checked in
    stmt = select(AttendanceRecord).where(
        and_(
            AttendanceRecord.employee_id == current_user.id,
            AttendanceRecord.date == today
        )
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        return existing
    
    record = AttendanceRecord(
        employee_id=current_user.id,
        employee_name=current_user.name,
        date=today,
        check_in_time=time_str,
        status="Present",
        type=payload.type
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record

async def check_out(db: AsyncSession, current_user: Employee):
    now = datetime.now(IST)
    today = now.strftime('%Y-%m-%d')
    time_str = now.strftime('%I:%M %p')

    stmt = select(AttendanceRecord).where(
        and_(
            AttendanceRecord.employee_id == current_user.id,
            AttendanceRecord.date == today
        )
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if not existing:
        return None
    
    if existing.check_out_time is None:
        existing.check_out_time = time_str
        await db.commit()
        await db.refresh(existing)
    
    return existing
