"""
Approval service — CEO approve/reject with linked entity sync.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.approval import Approval
from app.models.employee import Employee
from app.schemas.notification import ApprovalCreate, ApprovalDecision
from app.websocket.events import WebSocketEvent, Events


async def create_approval(
    db: AsyncSession, payload: ApprovalCreate, current_user: Employee
) -> Approval:
    approval = Approval(
        approval_type=payload.approval_type,
        requested_by=current_user.name,
        requested_by_id=current_user.id,
        department=current_user.department,
        summary=payload.summary,
        priority=payload.priority,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        status="Pending",
    )
    db.add(approval)
    await db.flush()
    return approval


async def _sync_entity(
    db: AsyncSession, approval: Approval, status: str, payload: ApprovalDecision, current_user: Employee
):
    if approval.entity_type == "LeaveRequest" and approval.entity_id:
        from app.models.leave_request import LeaveRequest
        from app.models.notification import Notification
        result = await db.execute(select(LeaveRequest).where(LeaveRequest.id == approval.entity_id))
        leave = result.scalar_one_or_none()
        if leave:
            leave.status = status
            leave.ceo_remarks = payload.rejection_reason
            db.add(leave)
            
            notif = Notification(
                title=f"Leave {status}",
                message=f"Your {leave.leave_type} leave request has been {status.lower()}.",
                recipient_id=leave.employee_id,
                category="Leave",
                priority="Medium"
            )
            db.add(notif)
            db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id} if notif.recipient_id else set(), {notif.department} if notif.department else set(), set()))
            
    # Placeholders for future entities mentioned
    elif approval.entity_type == "StockClearance" and approval.entity_id:
        pass
    elif approval.entity_type == "Expense" and approval.entity_id:
        pass


async def approve(
    db: AsyncSession, approval_id: str, payload: ApprovalDecision, current_user: Employee
) -> Approval:
    approval = await _get(db, approval_id)
    approval.status = "Approved"
    approval.approved_by_id = current_user.id
    approval.approved_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.add(approval)
    
    await _sync_entity(db, approval, "Approved", payload, current_user)
    
    return approval


async def reject(
    db: AsyncSession, approval_id: str, payload: ApprovalDecision, current_user: Employee
) -> Approval:
    approval = await _get(db, approval_id)
    approval.status = "Rejected"
    approval.approved_by_id = current_user.id
    approval.approved_at = datetime.now(timezone.utc).replace(tzinfo=None)
    approval.rejection_reason = payload.rejection_reason
    db.add(approval)
    
    await _sync_entity(db, approval, "Rejected", payload, current_user)
    
    return approval


async def list_approvals(
    db: AsyncSession, status: Optional[str] = None, offset: int = 0, limit: int = 100
):
    q = select(Approval)
    if status:
        q = q.where(Approval.status == status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.order_by(Approval.raised_on.desc()).offset(offset).limit(limit))
    return result.scalars().all(), total


async def _get(db: AsyncSession, approval_id: str) -> Approval:
    result = await db.execute(select(Approval).where(Approval.id == approval_id))
    a = result.scalar_one_or_none()
    if not a:
        raise NotFoundError("Approval")
    return a
