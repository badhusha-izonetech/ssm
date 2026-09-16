"""
Payment service — submit, proof upload, verify/reject (Accountant-only), project stage gate.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models.employee import Employee
from app.models.payment import Payment, PaymentProof
from app.schemas.payment import PaymentCreate, PaymentReject, PaymentVerify, PaymentUpdate
from app.utils.file_upload import save_payment_proof
from app.services.activity_log_service import log_activity


async def _get_payment(db: AsyncSession, payment_id: str) -> Payment:
    result = await db.execute(
        select(Payment).options(selectinload(Payment.proofs)).where(Payment.id == payment_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise NotFoundError("Payment")
    return p


async def create_payment(
    db: AsyncSession, payload: PaymentCreate, current_user: Employee
) -> Payment:
    payment = Payment(
        **payload.model_dump(),
        submitted_by=current_user.name,
        submitted_by_id=current_user.id,
        state="Pending",
    )
    db.add(payment)
    await db.flush()
    # Re-fetch with proofs eagerly loaded so that Pydantic serialisation does
    # not trigger an async lazy-load (MissingGreenlet) when the route returns.
    result = await db.execute(
        select(Payment).options(selectinload(Payment.proofs)).where(Payment.id == payment.id)
    )
    
    from app.models.notification import Notification
    notif_acc = Notification(
        title="New Payment Submitted",
        message=f"A new payment of ₹{payload.actual_amount} has been submitted by partner '{current_user.name}' for '{payload.customer_name}' and is pending verification.",
        department="Accounts",
        priority="High",
        category="Payment"
    )
    db.add(notif_acc)
    await db.flush()

    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.PAYMENT_CREATED, "Payment", "Create", payment.id)),
        ("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_acc.id), {notif_acc.recipient_id} if notif_acc.recipient_id else set(), {notif_acc.department} if notif_acc.department else set(), set()),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    
    await log_activity(
        db,
        actor=current_user.name,
        actor_id=current_user.id,
        department=current_user.department,
        action="Submitted payment",
        entity=payload.customer_name,
        entity_type="Payment",
        entity_id=payment.id,
        detail=f"Amount: ₹{payload.actual_amount}"
    )
    
    return result.scalar_one()


async def update_payment(
    db: AsyncSession, payment_id: str, payload: PaymentUpdate, current_user: Employee
) -> Payment:
    payment = await _get_payment(db, payment_id)

    # Restrict edits if already processed
    if payment.state in ("Verified", "Rejected"):
        raise BusinessRuleError("Cannot edit a processed payment.")

    if payload.project_id is not None:
        payment.project_id = payload.project_id
    if payload.customer_name is not None:
        payment.customer_name = payload.customer_name
    if payload.quotation_id is not None:
        payment.quotation_id = payload.quotation_id
    if payload.expected_amount is not None:
        payment.expected_amount = payload.expected_amount
    if payload.actual_amount is not None:
        payment.actual_amount = payload.actual_amount
    if payload.payment_type is not None:
        payment.payment_type = payload.payment_type
    if payload.payment_date is not None:
        payment.payment_date = payload.payment_date
    if payload.payment_mode is not None:
        payment.payment_mode = payload.payment_mode
    if payload.transaction_reference is not None:
        payment.transaction_reference = payload.transaction_reference
    if payload.remarks is not None:
        payment.remarks = payload.remarks

    db.add(payment)
    await db.flush()
    
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.PAYMENT_UPDATED, "Payment", "Update", payment.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    return payment


async def upload_proof(
    db: AsyncSession, payment_id: str, file: UploadFile, current_user: Employee
) -> PaymentProof:
    payment = await _get_payment(db, payment_id)
    file_url = await save_payment_proof(file)

    proof = PaymentProof(
        payment_id=payment.id,
        file_url=file_url,
        uploaded_by_id=current_user.id,
    )
    db.add(proof)
    payment.state = "Proof Uploaded"
    db.add(payment)
    
    from app.models.notification import Notification
    notif_acc = Notification(
        title="Payment Proof Uploaded",
        message=f"A new payment proof has been uploaded for {payment.customer_name} and is ready for verification.",
        department="Accounts",
        priority="High",
        category="Payment"
    )
    db.add(notif_acc)
    
    await db.flush()
    
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.PAYMENT_UPDATED, "Payment", "Update", payment.id)),
        ("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_acc.id), {notif_acc.recipient_id} if notif_acc.recipient_id else set(), {notif_acc.department} if notif_acc.department else set(), set()),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    return proof


async def verify_payment(
    db: AsyncSession, payment_id: str, payload: PaymentVerify, current_user: Employee
) -> Payment:
    if current_user.designation not in ("Accountant", "CEO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accountant access required")

    payment = await _get_payment(db, payment_id)
    if payload.customer_name:
        payment.customer_name = payload.customer_name
    if payload.project_id:
        payment.project_id = payload.project_id
    if payload.quotation_id:
        payment.quotation_id = payload.quotation_id
    if payload.payment_type:
        payment.payment_type = payload.payment_type
    payment.actual_amount = payload.actual_amount
    payment.payment_mode = payload.payment_mode
    if payload.transaction_reference:
        payment.transaction_reference = payload.transaction_reference
    payment.remarks = payload.remarks
    payment.state = "Verified"
    payment.verified_by = current_user.name
    payment.verified_by_id = current_user.id
    payment.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.add(payment)

    # Update project advance_received
    from app.models.project import Project, ProjectStageHistory
    from sqlalchemy.orm import selectinload

    project = None
    target_project_id = payload.project_id or payment.project_id
    target_quotation_id = payload.quotation_id or payment.quotation_id

    if target_project_id:
        project_res = await db.execute(select(Project).options(selectinload(Project.payments), selectinload(Project.quotation)).where(Project.id == target_project_id, Project.is_deleted == False))
        project = project_res.scalar_one_or_none()

    if not project and target_quotation_id:
        project_res = await db.execute(select(Project).options(selectinload(Project.payments), selectinload(Project.quotation)).where(Project.quotation_id == target_quotation_id, Project.is_deleted == False))
        project = project_res.scalar_one_or_none()

    if not project and payment.customer_name:
        project_res = await db.execute(select(Project).options(selectinload(Project.payments), selectinload(Project.quotation)).where(func.lower(Project.customer_name) == func.lower(payment.customer_name), Project.is_deleted == False))
        project = project_res.scalars().first()

    if project:
        payment.project_id = project.id
        if not payment.quotation_id and project.quotation_id:
            payment.quotation_id = project.quotation_id

        await db.flush()
        await db.refresh(project, ["payments"])
        
        breakdown = project.payment_breakdown
        project.advance_received = breakdown["total_verified_paid"] - breakdown["second_50_paid"]
        project.balance_amount = breakdown["final_outstanding"]
        
        if project.current_stage in ["Awaiting Advance Payment", "Site Visit", "Quotation", "Advance Payment"]:
            # Check if advance requirement is satisfied using the breakdown
            advance_satisfied = (
                breakdown["first_50_pending"] == Decimal("0") or 
                breakdown["final_outstanding"] == Decimal("0")
            )

            if advance_satisfied:
                project.current_stage = "Project Execution"
                history = ProjectStageHistory(
                    project_id=project.id,
                    stage="Project Execution",
                    changed_by_id=current_user.id,
                    note=f"Payment of ₹{payload.actual_amount} verified. Advance satisfied."
                )
                db.add(history)
                
                from app.models.notification import Notification
                new_proj_notif = Notification(
                    title="New project detected for you",
                    message=f"Project for '{project.customer_name}' has received advance payment and is cleared for execution.",
                    department="Project",
                    priority="High",
                    category="Project"
                )
                db.add(new_proj_notif)
            else:
                project.current_stage = "Advance Payment"
                history = ProjectStageHistory(
                    project_id=project.id,
                    stage="Advance Payment",
                    changed_by_id=current_user.id,
                    note=f"Payment of ₹{payload.actual_amount} verified by Accounts (Partial)"
                )
                db.add(history)
            
        db.add(project)

        # Update quotation status if it was waiting for advance
        if project.quotation_id:
            from app.models.quotation import Quotation
            quot_res = await db.execute(select(Quotation).where(Quotation.id == project.quotation_id))
            quot = quot_res.scalar_one_or_none()
            if quot and quot.status in ["Awaiting Advance", "Customer Approved"]:
                quot.status = "Verified"
                db.add(quot)

    from app.models.notification import Notification
    
    notif_proj = Notification(
        title="Payment Verified",
        message=f"Payment of ₹{payload.actual_amount} for '{payment.customer_name}' has been verified. Project is cleared to proceed.",
        department="Project",
        priority="High",
        category="Payment"
    )
    db.add(notif_proj)

    notif_ceo = Notification(
        title="Payment Verified",
        message=f"Payment of ₹{payload.actual_amount} for '{payment.customer_name}' has been verified.",
        department="CEO",
        priority="Medium",
        category="Payment"
    )
    db.add(notif_ceo)

    if payment.project_id:
        # We need the customer name from project, but payment.customer_name is often the same
        # Let's delete it generically for this customer
        await db.execute(delete(Notification).where(
            Notification.title == "Project Awaiting Advance",
            Notification.message.like(f"%'{payment.customer_name}' is awaiting advance payment%")
        ))

    await db.flush()
    
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.PAYMENT_UPDATED, "Payment", "Verify", payment.id)),
        ("broadcast", WebSocketEvent.create(Events.PROJECT_UPDATED, "Project", "Update", payment.project_id if payment.project_id else "")),
        ("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_proj.id), {notif_proj.recipient_id} if notif_proj.recipient_id else set(), {notif_proj.department} if notif_proj.department else set(), set()),
        ("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_ceo.id), {notif_ceo.recipient_id} if notif_ceo.recipient_id else set(), {notif_ceo.department} if notif_ceo.department else set(), set()),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    if 'new_proj_notif' in locals():
        db.info.setdefault("ws_actions", []).append(
            ("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", new_proj_notif.id), {new_proj_notif.recipient_id} if new_proj_notif.recipient_id else set(), {new_proj_notif.department} if new_proj_notif.department else set(), set())
        )
        
    await log_activity(
        db,
        actor=current_user.name,
        actor_id=current_user.id,
        department=current_user.department,
        action="Verified payment",
        entity=payment.customer_name,
        entity_type="Payment",
        entity_id=payment.id,
        detail=f"Amount: ₹{payload.actual_amount}"
    )
        
    return payment


async def reject_payment(
    db: AsyncSession, payment_id: str, payload: PaymentReject, current_user: Employee
) -> Payment:
    if current_user.designation not in ("Accountant", "CEO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accountant access required")

    if not payload.remarks:
        raise BusinessRuleError("Remarks are required when rejecting a payment")

    payment = await _get_payment(db, payment_id)
    payment.state = "Rejected"
    payment.remarks = payload.remarks
    payment.verified_by = current_user.name
    payment.verified_by_id = current_user.id
    payment.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.add(payment)
    await db.flush()
    
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.PAYMENT_UPDATED, "Payment", "Reject", payment.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    
    await log_activity(
        db,
        actor=current_user.name,
        actor_id=current_user.id,
        department=current_user.department,
        action="Rejected payment",
        entity=payment.customer_name,
        entity_type="Payment",
        entity_id=payment.id,
        detail=payload.remarks
    )
    
    return payment


async def list_payments(
    db: AsyncSession,
    state_filter: Optional[str] = None,
    project_id: Optional[str] = None,
    offset: int = 0,
    limit: int = 100,
) -> tuple[List[Payment], int]:
    q = select(Payment).options(selectinload(Payment.proofs))
    if state_filter:
        q = q.where(Payment.state == state_filter)
    if project_id:
        q = q.where(Payment.project_id == project_id)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.order_by(Payment.created_at.desc()).offset(offset).limit(limit))
    return result.scalars().all(), total
