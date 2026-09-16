"""
Stub services for: call_log, notification, performance, report, activity_log.
Each is small enough to live without a dedicated file but is provided for completeness.
"""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog
from app.models.call_log import CallLogEntry
from app.models.employee import Employee
from app.models.notification import Notification
from app.models.performance_record import PerformanceRecord
from app.schemas.call_log import CallLogCreate
from app.schemas.notification import PerformanceCreate
from app.websocket.events import WebSocketEvent, Events


# ── Call Log ──────────────────────────────────────────────────────────────────
async def create_call_log(
    db: AsyncSession, lead_id: str, payload: CallLogCreate, current_user: Employee
) -> CallLogEntry:
    entry = CallLogEntry(
        lead_id=lead_id,
        date=payload.date,
        time=payload.time,
        called_by=current_user.name,
        called_by_id=current_user.id,
        outcome=payload.outcome,
        notes=payload.notes,
        next_follow_up_date=payload.next_follow_up_date,
    )
    db.add(entry)
    
    # Notify CEO if a new lead is attended
    from app.models.lead import Lead
    from app.core.permissions import Designation
    from app.models.notification import Notification

    lead = await db.scalar(select(Lead).where(Lead.id == lead_id))
    if lead and lead.status == "New" and current_user.designation in (Designation.TELECALLER, Designation.DIRECT_MARKETING):
        notif = Notification(
            title="New Lead Attended",
            message=f"{current_user.name} attended to the new lead '{lead.customer_name}'.",
            department="CEO",
            priority="Low",
            category="System"
        )
        db.add(notif)
        db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id} if notif.recipient_id else set(), {notif.department} if notif.department else set(), set()))
        
    await db.flush()
    return entry


async def list_call_logs(db: AsyncSession, lead_id: str):
    result = await db.execute(
        select(CallLogEntry).where(CallLogEntry.lead_id == lead_id).order_by(CallLogEntry.created_at.desc())
    )
    return result.scalars().all()


async def list_all_call_logs(db: AsyncSession, offset: int = 0, limit: int = 100):
    q = select(CallLogEntry).order_by(CallLogEntry.created_at.desc())
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.offset(offset).limit(limit))
    return result.scalars().all(), total


# ── Notification ──────────────────────────────────────────────────────────────
async def list_notifications(db: AsyncSession, current_user: Employee, offset: int = 0, limit: int = 50):
    from sqlalchemy import or_, and_
    q = select(Notification).where(
        or_(
            Notification.recipient_id == current_user.id,
            Notification.department == current_user.department,
            and_(Notification.recipient_id.is_(None), Notification.department.is_(None)),
        )
    ).order_by(Notification.timestamp.desc())
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.offset(offset).limit(limit))
    return result.scalars().all(), total


async def mark_read(db: AsyncSession, notification_id: str):
    result = await db.execute(select(Notification).where(Notification.id == notification_id))
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
        db.add(notif)
        db.info.setdefault("ws_actions", []).append(("broadcast", WebSocketEvent.create(Events.NOTIFICATION_UPDATED, "Notification", "Update", notif.id)))


async def mark_all_read(db: AsyncSession, current_user: Employee):
    from sqlalchemy import or_, update
    await db.execute(
        update(Notification)
        .where(
            or_(Notification.recipient_id == current_user.id, Notification.department == current_user.department)
        )
        .values(is_read=True)
    )

async def clear_all_notifications(db: AsyncSession, current_user: Employee):
    from sqlalchemy import or_, delete
    await db.execute(
        delete(Notification)
        .where(
            or_(Notification.recipient_id == current_user.id, Notification.department == current_user.department)
        )
    )


# ── Performance ───────────────────────────────────────────────────────────────
async def create_performance(db: AsyncSession, payload: PerformanceCreate, current_user: Employee) -> PerformanceRecord:
    emp_res = await db.execute(select(Employee).where(Employee.id == payload.employee_id))
    emp = emp_res.scalar_one_or_none()
    record = PerformanceRecord(
        employee_id=payload.employee_id,
        employee_name=emp.name if emp else "Unknown",
        department=emp.department if emp else "",
        role=emp.designation if emp else "",
        period=payload.period,
        score=payload.score,
        completed_work=payload.completed_work,
        pending_work=payload.pending_work,
        efficiency=payload.efficiency,
        remarks=payload.remarks,
    )
    db.add(record)
    await db.flush()
    return record


async def list_performance(db: AsyncSession, offset: int = 0, limit: int = 100):
    q = select(PerformanceRecord)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.order_by(PerformanceRecord.created_at.desc()).offset(offset).limit(limit))
    return result.scalars().all(), total


# ── Activity Log ──────────────────────────────────────────────────────────────
async def log_activity(
    db: AsyncSession,
    actor: str,
    action: str,
    department: str | None = None,
    entity: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    detail: str | None = None,
    actor_id: str | None = None,
):
    log = ActivityLog(
        actor=actor,
        actor_employee_id=actor_id,
        department=department,
        action=action,
        entity=entity,
        entity_type=entity_type,
        entity_id=entity_id,
        detail=detail,
    )
    db.add(log)


async def list_activity(db: AsyncSession, offset: int = 0, limit: int = 100):
    q = select(ActivityLog).order_by(ActivityLog.timestamp.desc())
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.offset(offset).limit(limit))
    return result.scalars().all(), total
