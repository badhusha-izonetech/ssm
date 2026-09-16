"""
Project service — stage-gated transitions, assignment, code generation.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models.employee import Employee
from app.models.project import Project, ProjectStageHistory
from app.schemas.project import ProjectAssign, ProjectCreate, ProjectStageUpdate, ProjectUpdate
from app.utils.project_code import generate_project_code
from app.services import eb_application_service
from app.services.activity_log_service import log_activity

STAGE_ORDER = [
    "Site Visit", "Quotation", "Advance Payment",
    "Project Execution", "Installation", "Final Connection", "Completed",
]


async def _get_project(db: AsyncSession, project_id: str) -> Project:
    result = await db.execute(
        select(Project).options(
            selectinload(Project.stage_history),
            selectinload(Project.payments),
            selectinload(Project.assignments),
            selectinload(Project.uploads),
            selectinload(Project.quotation)
        ).where(
            Project.id == project_id, Project.is_deleted == False
        )
    )
    p = result.scalar_one_or_none()
    if not p:
        raise NotFoundError("Project")
    return p


async def create_project(
    db: AsyncSession, payload: ProjectCreate, current_user: Employee
) -> Project:
    code = await generate_project_code(db)
    balance = payload.project_value - payload.advance_received

    project = Project(
        project_code=code,
        customer_id=payload.customer_id,
        customer_name=payload.customer_name,
        customer_mobile=payload.customer_mobile,
        site=payload.site,
        area=payload.area,
        quotation_id=payload.quotation_id,
        project_value=payload.project_value,
        advance_received=payload.advance_received,
        balance_amount=balance,
        capacity_kw=payload.capacity_kw,
        assigned_technician_id=payload.assigned_technician_id,
        assigned_doc_employee_id=payload.assigned_doc_employee_id,
        next_action=payload.next_action,
        due_date=payload.due_date,
        priority=payload.priority,
        current_stage="Site Visit",
        status="On Track",
    )
    db.add(project)
    await db.flush()

    # Record initial stage
    history = ProjectStageHistory(
        project_id=project.id,
        stage="Site Visit",
        changed_by_id=current_user.id,
        note="Project created",
    )
    db.add(history)
    await db.flush()

    from app.models.notification import Notification
    if project.assigned_technician_id and project.assigned_technician_id != current_user.id:
        notif_tech = Notification(
            title="Project Assigned",
            message=f"You have been assigned as Technician for project: {project.customer_name} ({project.project_code})",
            recipient_id=project.assigned_technician_id,
            priority="High",
            category="Project"
        )
        db.add(notif_tech)
        
    if project.assigned_doc_employee_id and project.assigned_doc_employee_id != current_user.id:
        notif_doc = Notification(
            title="Project Document Follow-up Assigned",
            message=f"You have been assigned for Document Follow-up for project: {project.customer_name} ({project.project_code})",
            recipient_id=project.assigned_doc_employee_id,
            priority="Medium",
            category="Project"
        )
        db.add(notif_doc)

    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.PROJECT_CREATED, "Project", "Create", project.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    if 'notif_tech' in locals():
        db.info.setdefault("ws_actions", []).append(
            ("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_tech.id), {notif_tech.recipient_id} if notif_tech.recipient_id else set(), {notif_tech.department} if notif_tech.department else set(), set())
        )
    if 'notif_doc' in locals():
        db.info.setdefault("ws_actions", []).append(
            ("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_doc.id), {notif_doc.recipient_id} if notif_doc.recipient_id else set(), {notif_doc.department} if notif_doc.department else set(), set())
        )

    await log_activity(
        db,
        actor=current_user.name,
        actor_id=current_user.id,
        department=current_user.department,
        action="Created new project",
        entity=project.customer_name,
        entity_type="Project",
        entity_id=project.id,
    )

    return project


async def advance_stage(
    db: AsyncSession, project_id: str, payload: ProjectStageUpdate, current_user: Employee
) -> Project:
    project = await _get_project(db, project_id)

    current_idx = STAGE_ORDER.index(project.current_stage) if project.current_stage in STAGE_ORDER else -1
    target_idx = STAGE_ORDER.index(payload.stage) if payload.stage in STAGE_ORDER else -1

    if target_idx <= current_idx:
        raise BusinessRuleError(f"Cannot move project backwards to stage '{payload.stage}'")

    # Gate: Advance Payment stage requires verified payment
    if payload.stage == "Project Execution":
        verified_payments = [
            p for p in project.payments if p.state == "Verified"
        ]
        verified_total = sum(Decimal(str(p.actual_amount or 0)) for p in verified_payments)
        required_advance = project.project_value * Decimal("0.5")
        if verified_total < required_advance:
            raise BusinessRuleError(
                f"Advance payment not verified. Need ≥50% (₹{required_advance:,.2f}), "
                f"verified so far: ₹{verified_total:,.2f}"
            )

    project.current_stage = payload.stage
    if payload.stage == "Completed":
        project.status = "Completed"
    db.add(project)

    history = ProjectStageHistory(
        project_id=project.id,
        stage=payload.stage,
        changed_by_id=current_user.id,
        note=payload.note,
    )
    db.add(history)
    await db.flush()
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.PROJECT_UPDATED, "Project", "AdvanceStage", project.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])

    await log_activity(
        db,
        actor=current_user.name,
        actor_id=current_user.id,
        department=current_user.department,
        action=f"Advanced project stage to {payload.stage}",
        entity=project.customer_name,
        entity_type="Project",
        entity_id=project.id,
        detail=payload.note
    )

    return project


async def assign_project(
    db: AsyncSession, project_id: str, payload: ProjectAssign, current_user: Employee
) -> Project:
    project = await _get_project(db, project_id)
    
    # Gate: Ensure stock is fully reserved or issued before allowing assignment
    has_assignment = (
        payload.assigned_technician_id or 
        payload.assigned_doc_employee_id or 
        payload.additional_technician_ids or 
        payload.additional_doc_employee_ids
    )
    if has_assignment:
        # Stock must be at least requested once and not merely in "Not Requested" state.
        if project.warehouse_status not in ["Reserved", "Issued"]:
            raise BusinessRuleError("Stock must be requested and Reserved by the Warehouse before you can assign a technician or document follow-up executive.")

        # STRICT RULE: Check all reservations for this project
        from app.models.stock_item import StockReservation
        from collections import defaultdict
        
        res_result = await db.execute(select(StockReservation).where(StockReservation.project_id == project_id))
        reservations = res_result.scalars().all()
        
        requested_qty = defaultdict(Decimal)
        reserved_qty = defaultdict(Decimal)
        
        for r in reservations:
            if r.status in ["Cancelled", "Returned"]:
                continue
            requested_qty[r.stock_item_id] += r.quantity
            if r.status in ["Reserved", "Issued"]:
                reserved_qty[r.stock_item_id] += r.quantity
                
        for item_id, req in requested_qty.items():
            if reserved_qty[item_id] < req:
                raise BusinessRuleError("All requested products must be fully reserved by the Warehouse before project members can be assigned.")

    from app.models.notification import Notification
    from app.models.project_assignment import ProjectAssignment

    # Manage Primary Technician
    if payload.assigned_technician_id is not None and project.assigned_technician_id != payload.assigned_technician_id:
        project.assigned_technician_id = payload.assigned_technician_id
        notif_tech = Notification(
            title="Project Assigned",
            message=f"You have been assigned as Primary Technician for project: {project.customer_name} ({project.project_code})",
            recipient_id=project.assigned_technician_id,
            priority="High",
            category="Project"
        )
        db.add(notif_tech)

    # Manage Primary Doc/Follow-Up
    if payload.assigned_doc_employee_id is not None:
        if project.assigned_doc_employee_id != payload.assigned_doc_employee_id:
            project.assigned_doc_employee_id = payload.assigned_doc_employee_id
            notif_doc = Notification(
                title="Project Document Follow-up Assigned",
                message=f"You have been assigned as Primary Document Follow-up for project: {project.customer_name} ({project.project_code})",
                recipient_id=project.assigned_doc_employee_id,
                priority="Medium",
                category="Project"
            )
            db.add(notif_doc)
        
        # Always ensure EB Application exists if doc employee is assigned
        await eb_application_service.get_or_create_eb_application(
            db, project.id, assigned_by_id=current_user.id, assigned_employee_id=payload.assigned_doc_employee_id
        )

    db.add(project)

    # Manage additional assignments in project_assignments table
    # Clear existing additional assignments
    existing_additionals = [a for a in project.assignments if a.assignment_type == "Additional"]
    for ea in existing_additionals:
        await db.delete(ea)
    
    additional_tech_notifs = []
    additional_doc_notifs = []

    # Add new additional technicians
    for tech_id in payload.additional_technician_ids:
        pa_tech = ProjectAssignment(
            project_id=project.id,
            employee_id=tech_id,
            role="Technician",
            assignment_type="Additional",
            assigned_by_id=current_user.id
        )
        db.add(pa_tech)
        notif_tech_add = Notification(
            title="Project Assigned",
            message=f"You have been assigned as an Additional Technician for project: {project.customer_name} ({project.project_code})",
            recipient_id=tech_id,
            priority="Medium",
            category="Project"
        )
        db.add(notif_tech_add)
        additional_tech_notifs.append(notif_tech_add)

    # Add new additional follow-up
    for doc_id in payload.additional_doc_employee_ids:
        pa_doc = ProjectAssignment(
            project_id=project.id,
            employee_id=doc_id,
            role="Follow-Up",
            assignment_type="Additional",
            assigned_by_id=current_user.id
        )
        db.add(pa_doc)
        notif_doc_add = Notification(
            title="Project Document Follow-up Assigned",
            message=f"You have been assigned as an Additional Document Follow-up for project: {project.customer_name} ({project.project_code})",
            recipient_id=doc_id,
            priority="Medium",
            category="Project"
        )
        db.add(notif_doc_add)
        additional_doc_notifs.append(notif_doc_add)

    await db.flush()
    await db.refresh(project)
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.PROJECT_UPDATED, "Project", "Assign", project.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    if 'notif_tech' in locals():
        db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_tech.id), {notif_tech.recipient_id} if notif_tech.recipient_id else set(), set(), set()))
    if 'notif_doc' in locals():
        db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_doc.id), {notif_doc.recipient_id} if notif_doc.recipient_id else set(), set(), set()))
    # Dispatch WS notifications for all additional tech/doc assignments (loop-safe)
    for n in additional_tech_notifs:
        db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", n.id), {n.recipient_id} if n.recipient_id else set(), set(), set()))
    for n in additional_doc_notifs:
        db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", n.id), {n.recipient_id} if n.recipient_id else set(), set(), set()))

    return project


async def list_projects(
    db: AsyncSession,
    stage_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    offset: int = 0,
    limit: int = 100,
) -> tuple[List[Project], int]:
    q = select(Project).options(
        selectinload(Project.stage_history),
        selectinload(Project.payments),
        selectinload(Project.assignments),
        selectinload(Project.uploads),
        selectinload(Project.quotation)
    ).where(Project.is_deleted == False)

    if stage_filter:
        q = q.where(Project.current_stage == stage_filter)
    if status_filter:
        q = q.where(Project.status == status_filter)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.order_by(Project.created_at.desc()).offset(offset).limit(limit))
    return result.scalars().all(), total


async def upload_project_file(
    db: AsyncSession,
    project_id: str,
    current_user: Employee,
    file_type: str,
    file,
    stage: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> Project:
    from app.models.project_upload import ProjectUpload
    from app.utils.file_upload import save_upload, ALLOWED_MEDIA_TYPES
    from fastapi import HTTPException
    
    project = await _get_project(db, project_id)
    
    # Verify assignment (allow Admins / CEO / Management / Project Head or assigned technician/doc employee)
    dept = getattr(current_user, "department", "")
    desig = getattr(current_user, "designation", "")
    assigned = False
    if dept in ["CEO", "Project", "Admin", "Management"] or desig in ["CEO", "Project Head"]:
        assigned = True
    elif project.assigned_technician_id == current_user.id or project.assigned_doc_employee_id == current_user.id:
        assigned = True
    else:
        for pa in project.assignments:
            if pa.employee_id == current_user.id:
                assigned = True
                break

    # Fallback: allow any Field Technician or Site Visit employee if no strict assignment blocked
    if not assigned and (dept in ["Site Visit", "Project"] or desig in ["Field Technician", "Site Visitor"]):
        assigned = True

    if not assigned:
        raise HTTPException(status_code=403, detail="Not assigned to this project")

    url = await save_upload(file, f"project_uploads/{project_id}", ALLOWED_MEDIA_TYPES)
    
    upload = ProjectUpload(
        project_id=project.id,
        employee_id=current_user.id,
        file_type=file_type,
        file_url=url,
        stage=stage,
        latitude=latitude,
        longitude=longitude
    )
    db.add(upload)
    await db.flush()
    project = await _get_project(db, project_id)
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.PROJECT_UPDATED, "Project", "UploadFile", project.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    return project


async def update_installation_status(
    db: AsyncSession, project_id: str, installation_status: str, remarks: Optional[str], current_user: Employee
) -> Project:
    """
    Called by Field Technician to update installation progress.
    When status becomes 'Completed', notifies Project Head in real-time.
    """
    project = await _get_project(db, project_id)

    old_status = project.installation_status
    project.installation_status = installation_status
    db.add(project)

    history = None
    if installation_status == "In Progress" and old_status == "Not Started":
        history = ProjectStageHistory(
            project_id=project.id,
            stage=project.current_stage,
            changed_by_id=current_user.id,
            note=f"Installation started by {current_user.name}. {remarks or ''}".strip()
        )
    elif installation_status == "Completed":
        history = ProjectStageHistory(
            project_id=project.id,
            stage="Installation",
            changed_by_id=current_user.id,
            note=f"Installation completed by {current_user.name}. {remarks or ''}".strip()
        )

    if history:
        db.add(history)

    await db.flush()

    from app.websocket.events import WebSocketEvent, Events
    ws_actions = [
        ("broadcast", WebSocketEvent.create(Events.PROJECT_UPDATED, "Project", "InstallationStatus", project.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update")),
    ]

    if installation_status == "Completed":
        from app.models.notification import Notification
        notif = Notification(
            title="Installation Work Completed",
            message=f"Field Technician '{current_user.name}' has completed the installation for project '{project.customer_name}' ({project.project_code}). Please review and advance to Final Connection stage.",
            department="Project",
            priority="High",
            category="Project"
        )
        db.add(notif)
        await db.flush()
        ws_actions.append(
            ("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id} if notif.recipient_id else set(), {notif.department} if notif.department else set(), set())
        )

    db.info.setdefault("ws_actions", []).extend(ws_actions)
    return project

