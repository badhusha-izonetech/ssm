"""
Leave service — submit leave request and raise linked Approval.
"""

from __future__ import annotations

from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.approval import Approval
from app.models.employee import Employee
from app.models.leave_request import LeaveRequest
from app.models.notification import Notification
from app.schemas.notification import LeaveCreate, LeaveDecision
from app.utils.date_utils import today_str
from app.websocket.events import WebSocketEvent, Events


async def submit_leave(
    db: AsyncSession, payload: LeaveCreate, current_user: Employee
) -> LeaveRequest:
    # Create linked Approval row
    approval = Approval(
        approval_type="Leave Request",
        requested_by=current_user.name,
        requested_by_id=current_user.id,
        department=current_user.department,
        summary=f"{payload.leave_type} leave from {payload.from_date} to {payload.to_date}: {payload.reason}",
        status="Pending",
        priority="Medium",
        entity_type="LeaveRequest",
    )
    db.add(approval)
    await db.flush()

    leave = LeaveRequest(
        employee_id=current_user.id,
        employee_name=current_user.name,
        leave_type=payload.leave_type,
        from_date=payload.from_date,
        to_date=payload.to_date,
        reason=payload.reason,
        status="Pending",
        applied_on=today_str(),
        approval_id=approval.id,
    )
    approval.entity_id = None  # will be set after flush
    db.add(leave)
    await db.flush()

    approval.entity_id = leave.id
    db.add(approval)
    
    # Notify CEO
    notif = Notification(
        title="New Leave Request",
        message=f"{current_user.name} has applied for {payload.leave_type} leave.",
        department="CEO",
        category="Leave",
        priority="Medium"
    )
    db.add(notif)
    db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id} if notif.recipient_id else set(), {notif.department} if notif.department else set(), set()))
    
    return leave


async def approve_leave(
    db: AsyncSession, leave_id: str, payload: LeaveDecision, current_user: Employee
) -> LeaveRequest:
    leave = await _get_leave(db, leave_id)
    leave.status = "Approved"
    leave.ceo_remarks = payload.get_remarks()
    db.add(leave)
    if leave.approval_id:
        await _update_approval(db, leave.approval_id, "Approved", current_user)
        
    # Notify employee
    notif = Notification(
        title="Leave Approved",
        message=f"Your {leave.leave_type} leave request has been approved.",
        recipient_id=leave.employee_id,
        category="Leave",
        priority="Medium"
    )
    db.add(notif)
    db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id} if notif.recipient_id else set(), {notif.department} if notif.department else set(), set()))
    
    return leave


async def reject_leave(
    db: AsyncSession, leave_id: str, payload: LeaveDecision, current_user: Employee
) -> LeaveRequest:
    leave = await _get_leave(db, leave_id)
    leave.status = "Rejected"
    leave.ceo_remarks = payload.get_remarks()
    db.add(leave)
    if leave.approval_id:
        await _update_approval(db, leave.approval_id, "Rejected", current_user)
        
    # Notify employee
    notif = Notification(
        title="Leave Rejected",
        message=f"Your {leave.leave_type} leave request has been rejected.",
        recipient_id=leave.employee_id,
        category="Leave",
        priority="Medium"
    )
    db.add(notif)
    db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id} if notif.recipient_id else set(), {notif.department} if notif.department else set(), set()))
    
    return leave


async def list_leaves(db: AsyncSession, current_user: Employee, status: str | None = None, offset: int = 0, limit: int = 100):
    from sqlalchemy import func
    from app.core.permissions import get_permissions, Permission
    q = select(LeaveRequest)
    
    # Filter by user unless they have permission to approve leaves (like CEO/HR)
    user_perms = get_permissions(current_user.designation)
    if Permission.LEAVE_APPROVE not in user_perms:
        q = q.where(LeaveRequest.employee_id == current_user.id)
        
    if status:
        q = q.where(LeaveRequest.status == status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.order_by(LeaveRequest.created_at.desc()).offset(offset).limit(limit))
    return result.scalars().all(), total


async def _get_leave(db: AsyncSession, leave_id: str) -> LeaveRequest:
    result = await db.execute(select(LeaveRequest).where(LeaveRequest.id == leave_id))
    leave = result.scalar_one_or_none()
    if not leave:
        raise NotFoundError("LeaveRequest")
    return leave


async def _update_approval(db: AsyncSession, approval_id: str, status: str, current_user: Employee):
    from datetime import datetime, timezone
    result = await db.execute(select(Approval).where(Approval.id == approval_id))
    approval = result.scalar_one_or_none()
    if approval:
        approval.status = status
        approval.approved_by_id = current_user.id
        approval.approved_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db.add(approval)
