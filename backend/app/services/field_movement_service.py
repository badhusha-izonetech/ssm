"""
Remaining services: FieldMovement, Customer, Leave, Approval, Dashboard, and stubs.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import UploadFile
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import set_committed_value
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError, ForbiddenError
from app.models.employee import Employee
from app.models.field_movement import (
    FieldMovement,
    FieldMovementNote,
    FieldMovementPhoto,
    FieldMovementRoutePoint,
    FieldMovementLocation,
)
from app.schemas.field_movement import FieldMovementStart, FieldMovementUpdate, NoteCreate, FieldMovementLocationCreate
from app.utils.file_upload import save_field_visit_photo

ACTIVE_TRACKING_STATUSES = ("Checked In", "On Field", "Returning")
MAX_LOCATION_ACCURACY_METERS = 5000


# ── FieldMovement ─────────────────────────────────────────────────────────────

async def start_field_movement(
    db: AsyncSession, payload: FieldMovementStart, current_user: Employee
) -> FieldMovement:
    # Enforce: only one active visit per employee
    active = await db.execute(
        select(FieldMovement).where(
            FieldMovement.employee_id == current_user.id,
            FieldMovement.status.in_(["Checked In", "On Field"]),
        )
    )
    if active.scalar_one_or_none():
        raise BusinessRuleError("You already have an active field visit. Check out first.")

    fm = FieldMovement(
        employee_id=current_user.id,
        employee_name=current_user.name,
        role=current_user.designation,
        status="Checked In",
        current_location=payload.current_location,
        destination=payload.destination,
        lead_id=payload.lead_id,
        purpose=payload.purpose,
    )
    db.add(fm)
    await db.flush()
    await db.refresh(fm, ["start_time", "last_update", "created_at"])
    set_committed_value(fm, "route_points", [])
    set_committed_value(fm, "photos", [])
    set_committed_value(fm, "notes", [])
    return fm


async def get_field_movement(db: AsyncSession, fm_id: str) -> FieldMovement:
    result = await db.execute(select(FieldMovement).where(FieldMovement.id == fm_id))
    fm = result.scalar_one_or_none()
    if not fm:
        raise NotFoundError("FieldMovement")
    return fm


async def track_field_movement_location(
    db: AsyncSession, fm_id: str, current_user: Employee, payload: FieldMovementLocationCreate
) -> FieldMovementLocation:
    fm = await get_field_movement(db, fm_id)
    if fm.employee_id != current_user.id:
        raise ForbiddenError("You are not the owner of this field movement")
    if fm.status not in ACTIVE_TRACKING_STATUSES:
        raise BusinessRuleError("Tracking is only available while the field movement is active")
    if payload.accuracy > MAX_LOCATION_ACCURACY_METERS:
        raise BusinessRuleError("GPS accuracy is too low to record this location")
    loc = FieldMovementLocation(
        field_movement_id=fm.id, employee_id=current_user.id, latitude=payload.latitude,
        longitude=payload.longitude, accuracy=payload.accuracy, speed=payload.speed,
        heading=payload.heading,
        captured_at=payload.captured_at.replace(tzinfo=None) if payload.captured_at.tzinfo else payload.captured_at,
    )
    db.add(loc)
    fm.last_latitude = payload.latitude
    fm.last_longitude = payload.longitude
    fm.last_accuracy = payload.accuracy
    fm.last_speed = payload.speed
    fm.last_heading = payload.heading
    fm.last_location_at = loc.captured_at
    fm.last_update = datetime.now(timezone.utc).replace(tzinfo=None)
    if fm.status == "Checked In":
        fm.status = "On Field"
    db.add(fm)
    await db.flush()
    await db.commit()
    await db.refresh(loc)
    return loc


async def get_downsampled_locations(db: AsyncSession, fm_id: str, max_points: int = 300) -> tuple[List[FieldMovementLocation], int]:
    HARD_FETCH_CEILING = 8000
    max_points = max(10, min(max_points, 2000))
    result = await db.execute(
        select(FieldMovementLocation)
        .where(FieldMovementLocation.field_movement_id == fm_id)
        .order_by(FieldMovementLocation.captured_at.asc())
        .limit(HARD_FETCH_CEILING)
    )
    points = result.scalars().all()
    total = len(points)
    if total <= max_points:
        return points, total
    stride = total / max_points
    downsampled = [points[int(i * stride)] for i in range(max_points)]
    if downsampled[-1].id != points[-1].id:
        downsampled[-1] = points[-1]
    return downsampled, total


async def list_field_movement_locations(db: AsyncSession, fm_id: str, current_user: Employee, offset: int = 0, limit: int = 500) -> tuple[List[FieldMovementLocation], int]:
    await get_field_movement(db, fm_id)
    q = select(FieldMovementLocation).where(FieldMovementLocation.field_movement_id == fm_id)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.order_by(FieldMovementLocation.captured_at.asc()).offset(offset).limit(limit))
    return result.scalars().all(), total


async def stop_field_movement(db: AsyncSession, fm_id: str, current_user: Employee) -> FieldMovement:
    fm = await get_field_movement(db, fm_id)
    if fm.employee_id != current_user.id:
        raise ForbiddenError("You are not the owner of this field movement")
    if fm.status == "Checked Out":
        raise BusinessRuleError("This field movement is already checked out")
    fm.status = "Checked Out"
    fm.end_time = datetime.now(timezone.utc).replace(tzinfo=None)
    fm.last_update = fm.end_time
    db.add(fm)
    await db.flush()
    await db.commit()
    await db.refresh(fm)
    return fm


async def update_field_movement(
    db: AsyncSession, fm_id: str, payload: FieldMovementUpdate, current_user: Employee
) -> FieldMovement:
    result = await db.execute(
        select(FieldMovement).options(
            selectinload(FieldMovement.route_points),
            selectinload(FieldMovement.photos),
            selectinload(FieldMovement.notes),
        ).where(FieldMovement.id == fm_id)
    )
    fm = result.scalar_one_or_none()
    if not fm:
        raise NotFoundError("FieldMovement")

    if payload.current_location:
        fm.current_location = payload.current_location
        # Append route point
        rp = FieldMovementRoutePoint(
            field_movement_id=fm.id,
            location=payload.current_location,
        )
        db.add(rp)

    if payload.status:
        fm.status = payload.status
        if payload.status == "Checked Out":
            fm.end_time = datetime.now(timezone.utc).replace(tzinfo=None)

    if payload.destination:
        fm.destination = payload.destination

    fm.last_update = datetime.now(timezone.utc).replace(tzinfo=None)
    db.add(fm)
    await db.flush()
    return fm


async def add_photo(
    db: AsyncSession, fm_id: str, file: UploadFile, current_user: Employee
) -> FieldMovementPhoto:
    file_url = await save_field_visit_photo(file)
    photo = FieldMovementPhoto(
        field_movement_id=fm_id,
        file_url=file_url,
        uploaded_by_id=current_user.id,
    )
    db.add(photo)
    await db.flush()
    return photo


async def add_note(
    db: AsyncSession, fm_id: str, payload: NoteCreate, current_user: Employee
) -> FieldMovementNote:
    note = FieldMovementNote(
        field_movement_id=fm_id,
        note=payload.note,
        created_by_id=current_user.id,
    )
    db.add(note)
    await db.flush()
    return note


async def list_field_movements(
    db: AsyncSession, employee_id: Optional[str] = None, offset: int = 0, limit: int = 100
) -> tuple[List[FieldMovement], int]:
    q = select(FieldMovement).options(
        selectinload(FieldMovement.route_points),
        selectinload(FieldMovement.photos),
        selectinload(FieldMovement.notes),
    )
    if employee_id:
        q = q.where(FieldMovement.employee_id == employee_id)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.order_by(FieldMovement.start_time.desc()).offset(offset).limit(limit))
    return result.scalars().all(), total
