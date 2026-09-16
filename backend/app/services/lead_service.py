"""
Lead service — scoped list for Telecallers, status transitions, existing-customer flow.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.core.permissions import is_telecaller_scoped
from app.models.employee import Employee
from app.models.lead import Lead
from app.schemas.lead import (
    ExistingCustomerLeadCreate,
    LeadCreate,
    LeadReassign,
    LeadStatusUpdate,
    LeadUpdate,
)
from app.services.activity_log_service import log_activity
from app.utils.date_utils import today_str

FOLLOW_UP_STATUSES = {
    "Follow-up", "Site Visit Required", "Site Visit Scheduled",
    "Interested", "Contacted",
}


async def _get_lead(db: AsyncSession, lead_id: str) -> Lead:
    result = await db.execute(
        select(Lead).options(selectinload(Lead.call_logs)).where(
            Lead.id == lead_id, Lead.is_deleted == False
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise NotFoundError("Lead")
    return lead


async def create_lead(
    db: AsyncSession, payload: LeadCreate, current_user: Employee
) -> Lead:
    data = payload.model_dump()
    data["created_by_id"] = current_user.id
    if not data.get("first_contact_date"):
        data["first_contact_date"] = today_str()
        
    from app.core.permissions import Designation
    if current_user.designation == Designation.DOC_FOLLOWUP:
        data["assigned_employee_id"] = None
        data["status"] = "Pending CEO Assignment"
    else:
        if not data.get("assigned_employee_id"):
            data["assigned_employee_id"] = current_user.id
            
    lead = Lead(**data)
    db.add(lead)
    await db.flush()
    
    # Notify CEO of the new lead
    from app.models.notification import Notification
    notif = Notification(
        title="New Lead Created",
        message=f"A new lead '{lead.customer_name}' has been created.",
        department="CEO",
        priority="Medium",
        category="System"
    )
    db.add(notif)
    
    # Notify assigned employee if not self
    if lead.assigned_employee_id and lead.assigned_employee_id != current_user.id:
        notif_emp = Notification(
            title="Lead Assigned",
            message=f"You have been assigned a new lead: {lead.customer_name}",
            recipient_id=lead.assigned_employee_id,
            priority="Medium",
            category="System"
        )
        db.add(notif_emp)
    
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.LEAD_CREATED, "Lead", "Create", lead.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update")),
        ("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id} if notif.recipient_id else set(), {notif.department} if notif.department else set(), set())
    ])
    if 'notif_emp' in locals():
        db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_emp.id), {notif_emp.recipient_id} if notif_emp.recipient_id else set(), {notif_emp.department} if notif_emp.department else set(), set()))
        
    await log_activity(
        db,
        actor=current_user.name,
        actor_id=current_user.id,
        department=current_user.department,
        action="Created new lead",
        entity=lead.customer_name,
        entity_type="Lead",
        entity_id=lead.id,
    )
    return lead


async def list_leads(
    db: AsyncSession,
    current_user: Employee,
    status_filter: Optional[str] = None,
    offset: int = 0,
    limit: int = 100,
) -> tuple[List[Lead], int]:
    q = select(Lead).where(Lead.is_deleted == False)

    from app.core.permissions import Designation
    if is_telecaller_scoped(current_user.designation):
        q = q.where(Lead.assigned_employee_id == current_user.id)
    elif current_user.designation == Designation.DOC_FOLLOWUP:
        q = q.where(Lead.created_by_id == current_user.id)

    if status_filter:
        q = q.where(Lead.status == status_filter)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()
    result = await db.execute(q.order_by(Lead.created_at.desc()).offset(offset).limit(limit))
    return result.scalars().all(), total


async def list_follow_ups(
    db: AsyncSession,
    current_user: Employee,
    offset: int = 0,
    limit: int = 100,
) -> tuple[List[Lead], int]:
    """Follow-ups = leads in follow-up statuses (not a separate table)."""
    q = select(Lead).options(selectinload(Lead.call_logs)).where(
        Lead.is_deleted == False,
        Lead.status.in_(FOLLOW_UP_STATUSES),
    )
    if is_telecaller_scoped(current_user.designation):
        q = q.where(Lead.assigned_employee_id == current_user.id)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.order_by(Lead.created_at.desc()).offset(offset).limit(limit))
    return result.scalars().all(), total


async def update_lead_status(
    db: AsyncSession, lead_id: str, payload: LeadStatusUpdate, current_user: Employee
) -> Lead:
    lead = await _get_lead(db, lead_id)
    old_status = lead.status

    # Enforce Telecaller scope
    if is_telecaller_scoped(current_user.designation):
        if lead.assigned_employee_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your lead")

    if payload.status == "Lost":
        if not payload.lost_reason or not payload.lost_reason_detail:
            raise BusinessRuleError("lost_reason and lost_reason_detail are required when marking a lead as Lost")
        lead.lost_reason = payload.lost_reason
        lead.lost_reason_detail = payload.lost_reason_detail

    lead.status = payload.status
    if payload.remarks:
        new_note = f"{payload.status.lower()} : {payload.remarks}"
        if lead.remarks:
            if new_note not in lead.remarks:
                lead.remarks = f"{lead.remarks}\n\n{new_note}"
        else:
            lead.remarks = new_note
        
    if payload.status == "Converted" and old_status != "Converted" and not lead.customer_id:
        from app.models.customer import Customer
        customer = Customer(
            name=lead.customer_name,
            mobile=lead.mobile,
            alternate_mobile=lead.alternate_mobile,
            email=lead.email,
            customer_type=lead.customer_type,
            address=lead.address,
            area=lead.area,
            city=lead.city,
            source_lead_id=lead.id
        )
        db.add(customer)
        await db.flush()
        lead.customer_id = customer.id
        
    db.add(lead)
    await db.flush()

    if payload.status == "Quotation Stage" and old_status != "Quotation Stage":
        from app.models.quotation import Quotation
        from app.schemas.quotation import QuotationCreate
        from app.services.quotation_service import create_quotation
        from datetime import datetime, timedelta, timezone
        
        existing = await db.execute(select(Quotation).where(Quotation.lead_id == lead.id))
        if not existing.scalars().first():
            q_payload = QuotationCreate(
                customer_name=lead.customer_name,
                customer_phone=lead.mobile,
                site=lead.address or lead.area,
                date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                valid_until=(datetime.now(timezone.utc) + timedelta(days=15)).strftime("%Y-%m-%d"),
                project_type=lead.product_interested or "Solar Rooftop",
                line_items=[],
                lead_id=lead.id
            )
            await create_quotation(db, q_payload, current_user)
    from app.core.permissions import Designation
    from app.models.notification import Notification
    
    if old_status == "New" and payload.status != "New" and current_user.designation in (Designation.TELECALLER, Designation.DIRECT_MARKETING):
        notif = Notification(
            title="New Lead Attended",
            message=f"{current_user.name} attended to the new lead '{lead.customer_name}' and marked it as '{payload.status}'.",
            department="CEO",
            priority="Low",
            category="System"
        )
        db.add(notif)
    elif old_status != "New" and current_user.designation in (Designation.TELECALLER, Designation.DIRECT_MARKETING) and payload.remarks:
        notif = Notification(
            title="Lead Follow-up Updated",
            message=f"{current_user.name} recorded a follow-up for lead '{lead.customer_name}'. Status: {payload.status}.",
            department="CEO",
            priority="Low",
            category="System"
        )
        db.add(notif)
        
    # Notify CEO and Site Visit department for Site Visits
    if payload.status in ("Site Visit Required", "Site Visit Scheduled") and old_status not in ("Site Visit Required", "Site Visit Scheduled"):
        notif_ceo = Notification(
            title="Site Visit Requested",
            message=f"Lead '{lead.customer_name}' requires a site visit. Please assign a site visitor.",
            department="CEO",
            priority="High",
            category="System"
        )
        db.add(notif_ceo)
        
        notif_sv = Notification(
            title="Site Visit Requested",
            message=f"A new site visit request has been raised for lead '{lead.customer_name}'.",
            department="Site Visit",
            priority="Medium",
            category="System"
        )
        db.add(notif_sv)
        
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.LEAD_UPDATED, "Lead", "UpdateStatus", lead.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    if 'notif' in locals():
        db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id} if notif.recipient_id else set(), {notif.department} if notif.department else set(), set()))
    if 'notif_ceo' in locals():
        db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_ceo.id), {notif_ceo.recipient_id} if notif_ceo.recipient_id else set(), {notif_ceo.department} if notif_ceo.department else set(), set()))
    if 'notif_sv' in locals():
        db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_sv.id), {notif_sv.recipient_id} if notif_sv.recipient_id else set(), {notif_sv.department} if notif_sv.department else set(), set()))
        
    await log_activity(
        db,
        actor=current_user.name,
        actor_id=current_user.id,
        department=current_user.department,
        action=f"Updated lead status to {payload.status}",
        entity=lead.customer_name,
        entity_type="Lead",
        entity_id=lead.id,
        detail=f"Status changed from {old_status} to {payload.status}"
    )
    return lead


async def reassign_lead(
    db: AsyncSession, lead_id: str, payload: LeadReassign
) -> Lead:
    lead = await _get_lead(db, lead_id)
    lead.assigned_employee_id = payload.assigned_employee_id
    
    if lead.status == "Pending CEO Assignment":
        lead.status = "New"
        
    db.add(lead)
    
    from app.models.notification import Notification
    
    notif = Notification(
        title="Lead Assigned",
        message=f"You have been assigned a new lead: {lead.customer_name}",
        recipient_id=payload.assigned_employee_id,
        priority="Medium",
        category="System"
    )
    db.add(notif)
    
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.LEAD_UPDATED, "Lead", "Reassign", lead.id)),
        ("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id} if notif.recipient_id else set(), {notif.department} if notif.department else set(), set()),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    
    return lead


async def create_existing_customer_lead(
    db: AsyncSession, payload: ExistingCustomerLeadCreate, current_user: Employee
) -> Lead:
    """
    New enquiry from an existing customer — never mutates the prior project.
    Creates a new Lead with customerOrigin='Existing Customer'.
    """
    # Fetch from Lead instead of Customer since Lead is single source of truth
    customer_res = await db.execute(
        select(Lead).where(Lead.id == payload.customer_id, Lead.is_deleted == False)
    )
    customer = customer_res.scalar_one_or_none()
    if not customer:
        raise NotFoundError("Customer (Lead)")

    lead = Lead(
        customer_name=customer.customer_name,
        mobile=customer.mobile,
        alternate_mobile=customer.alternate_mobile,
        email=customer.email,
        customer_type=customer.customer_type,
        address=customer.address,
        area=customer.area,
        city=customer.city,
        lead_source=payload.lead_source,
        product_interested=payload.product_interested,
        requirement_description=payload.requirement_description,
        approximate_requirement=payload.approximate_requirement,
        priority=payload.priority,
        assigned_employee_id=payload.assigned_employee_id or current_user.id,
        created_by_id=current_user.id,
        customer_origin="Existing Customer",
        prior_project_id=payload.prior_project_id,
        customer_id=customer.customer_id, # maintain link if any
        first_contact_date=today_str(),
        status="New",
    )
    db.add(lead)
    await db.flush()

    if lead.assigned_employee_id and lead.assigned_employee_id != current_user.id:
        from app.models.notification import Notification
        notif_emp = Notification(
            title="Lead Assigned",
            message=f"You have been assigned a new lead (Existing Customer): {lead.customer_name}",
            recipient_id=lead.assigned_employee_id,
            priority="Medium",
            category="System"
        )
        db.add(notif_emp)

    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.LEAD_CREATED, "Lead", "CreateExisting", lead.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    if 'notif_emp' in locals():
        db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_emp.id), {notif_emp.recipient_id} if notif_emp.recipient_id else set(), {notif_emp.department} if notif_emp.department else set(), set()))

    await log_activity(
        db,
        actor=current_user.name,
        actor_id=current_user.id,
        department=current_user.department,
        action="Created existing customer lead",
        entity=lead.customer_name,
        entity_type="Lead",
        entity_id=lead.id,
    )
    return lead
