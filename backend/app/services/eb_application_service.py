"""
EB Application Service for Data Follow-up workflows.
"""
from typing import List, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import UploadFile

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models.employee import Employee
from app.models.project import Project
from app.models.eb_application import EbApplication, EbStageHistory, EbDocument
from app.models.notification import Notification
from app.schemas.eb_application import (
    EbVerificationUpdate, EbPortalSubmission, EbHandover, EbDashboardCounters
)
from app.utils.file_upload import save_eb_document
from app.websocket.events import WebSocketEvent, Events

def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

async def _record_stage(db: AsyncSession, eb_app: EbApplication, to_stage: str, by_user_id: str, remarks: Optional[str] = None):
    history = EbStageHistory(
        eb_application_id=eb_app.id,
        from_stage=eb_app.current_stage,
        to_stage=to_stage,
        changed_by_id=by_user_id,
        remarks=remarks
    )
    eb_app.current_stage = to_stage
    db.add(history)


async def get_or_create_eb_application(db: AsyncSession, project_id: str, assigned_by_id: str, assigned_employee_id: str) -> EbApplication:
    # Check if exists
    result = await db.execute(select(EbApplication).where(EbApplication.project_id == project_id, EbApplication.is_deleted == False))
    eb_app = result.scalar_one_or_none()
    
    if eb_app:
        # Update assignment if needed
        if eb_app.assigned_employee_id != assigned_employee_id:
            eb_app.assigned_employee_id = assigned_employee_id
            db.add(eb_app)
        return eb_app

    # Create new
    eb_app = EbApplication(
        project_id=project_id,
        assigned_team="Data Follow-up",
        assigned_by_id=assigned_by_id,
        assigned_employee_id=assigned_employee_id,
        current_stage="Application Received",
    )
    db.add(eb_app)
    await db.flush()
    
    # Record initial stage history
    history = EbStageHistory(
        eb_application_id=eb_app.id,
        from_stage=None,
        to_stage="Application Received",
        changed_by_id=assigned_by_id,
        remarks="Project Head assigned to Data Follow-up Team"
    )
    db.add(history)
    return eb_app


async def list_eb_applications(
    db: AsyncSession, 
    current_user: Employee, 
    search: Optional[str] = None, 
    stage: Optional[str] = None,
    offset: int = 0,
    limit: int = 100
) -> Tuple[List[EbApplication], int]:
    q = select(EbApplication, Project).join(Project, Project.id == EbApplication.project_id).where(EbApplication.is_deleted == False).options(selectinload(EbApplication.documents))
    
    # RBAC filtering: Data Follow-up Team only sees apps assigned to them
    if current_user.designation == "Document Follow-up Executive":
        q = q.where(EbApplication.assigned_employee_id == current_user.id)
    
    if stage:
        q = q.where(EbApplication.current_stage == stage)
        
    if search:
        search = f"%{search}%"
        q = q.where(
            (Project.project_code.ilike(search)) | 
            (Project.customer_name.ilike(search)) |
            (Project.customer_mobile.ilike(search))
        )
        
    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar_one()
    
    result = await db.execute(q.order_by(EbApplication.created_at.desc()).offset(offset).limit(limit))
    rows = result.all()
    
    # Attach project details to eb_app for schema serialization
    for eb, proj in rows:
        eb.project_code = proj.project_code
        eb.customer_name = proj.customer_name
        eb.customer_mobile = proj.customer_mobile
        eb.project_details = f"{proj.site} - {proj.area}"
        
    return [row[0] for row in rows], total


async def get_eb_application(db: AsyncSession, application_id: str, current_user: Employee) -> EbApplication:
    result = await db.execute(
        select(EbApplication, Project).join(Project, Project.id == EbApplication.project_id)
        .where(EbApplication.id == application_id, EbApplication.is_deleted == False)
        .options(selectinload(EbApplication.documents))
    )
    row = result.first()
    if not row:
        raise NotFoundError("EB Application")
        
    eb, proj = row
    
    if current_user.designation == "Document Follow-up Executive" and eb.assigned_employee_id != current_user.id:
        raise BusinessRuleError("You are not authorized to view this application.")
        
    eb.project_code = proj.project_code
    eb.customer_name = proj.customer_name
    eb.customer_mobile = proj.customer_mobile
    eb.project_details = f"{proj.site} - {proj.area}"
    
    return eb


async def upload_document(
    db: AsyncSession, application_id: str, file: UploadFile, document_type: str, remarks: Optional[str], current_user: Employee
) -> EbDocument:
    eb = await get_eb_application(db, application_id, current_user)
    
    if eb.current_stage == "Application Received":
        await _record_stage(db, eb, "Document Collection", current_user.id, "Started document collection")
    
    file_url = await save_eb_document(file)
    
    doc = EbDocument(
        eb_application_id=eb.id,
        document_type=document_type,
        file_url=file_url,
        remarks=remarks,
        uploaded_by_id=current_user.id
    )
    db.add(doc)
    db.add(eb)
    await db.flush()
    return doc


async def get_stage_history(db: AsyncSession, application_id: str) -> List[EbStageHistory]:
    result = await db.execute(
        select(EbStageHistory).where(EbStageHistory.eb_application_id == application_id).order_by(EbStageHistory.changed_at.desc())
    )
    return list(result.scalars().all())


async def verify_documents(db: AsyncSession, application_id: str, payload: EbVerificationUpdate, current_user: Employee) -> EbApplication:
    eb = await get_eb_application(db, application_id, current_user)
    
    if len(eb.documents) == 0:
        raise BusinessRuleError("Cannot verify without any uploaded documents.")
        
    if payload.status == "NOT_VERIFIED" and not payload.reason:
        raise BusinessRuleError("Reason is mandatory when documents are not verified.")
        
    eb.verification_status = payload.status
    eb.verification_reason = payload.reason
    eb.verified_by_id = current_user.id
    eb.verification_date = _now()
    
    if payload.status == "VERIFIED":
        await _record_stage(db, eb, "Document Verification", current_user.id, "Documents Verified")
    else:
        await _record_stage(db, eb, "Document Verification", current_user.id, f"Documents Not Verified: {payload.reason}")
        
    db.add(eb)
    await db.flush()
    return eb


async def submit_portal(db: AsyncSession, application_id: str, payload: EbPortalSubmission, current_user: Employee) -> EbApplication:
    eb = await get_eb_application(db, application_id, current_user)
    
    if eb.verification_status != "VERIFIED":
        raise BusinessRuleError("Cannot submit to portal unless documents are VERIFIED.")
        
    eb.portal_submission_status = "COMPLETED"
    eb.submitted_by_id = current_user.id
    eb.submission_date = _now()
    eb.portal_reference = payload.reference_number
    eb.portal_remarks = payload.remarks
    
    await _record_stage(db, eb, "EB/TANGEDCO Portal Submission", current_user.id, "Portal Submission Completed")
    
    # Also update state to EB Process awaiting further action
    await _record_stage(db, eb, "EB Process / Awaiting Further Action", current_user.id, "Waiting for TANGEDCO response")

    # Update project eb_status to Application Submitted
    project_result = await db.execute(select(Project).where(Project.id == eb.project_id))
    project = project_result.scalar_one()
    project.eb_status = "Application Submitted"
    
    db.add(eb)
    db.add(project)
    await db.flush()
    return eb


async def handover(db: AsyncSession, application_id: str, payload: EbHandover, current_user: Employee) -> EbApplication:
    eb = await get_eb_application(db, application_id, current_user)
    
    if eb.portal_submission_status != "COMPLETED":
        raise BusinessRuleError("Cannot handover unless portal submission is completed.")
        
    eb.handover_status = "COMPLETED"
    eb.handed_over_by_id = current_user.id
    eb.handover_date = _now()
    eb.meter_supply_details = payload.meter_supply_details
    eb.handover_remarks = payload.remarks
    
    await _record_stage(db, eb, "Handover Application with EB Meter Supply", current_user.id, "Handover Completed")
    
    # Update project eb_status
    project_result = await db.execute(select(Project).where(Project.id == eb.project_id))
    project = project_result.scalar_one()
    project.eb_status = "Meter Installed"
    
    # Notify Project Head
    notif = Notification(
        title="EB Handover Completed",
        message=f"EB Application for project '{project.customer_name}' has been completed and handed over with meter supply details.",
        department="Project",
        priority="High",
        category="Project"
    )
    db.add(notif)
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.PROJECT_UPDATED, "Project", "EbHandover", str(project.id))),
        ("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id} if notif.recipient_id else set(), {notif.department} if notif.department else set(), set()),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update")),
    ])
    
    db.add(eb)
    db.add(project)
    await db.flush()
    return eb


async def get_dashboard_counters(db: AsyncSession, current_user: Employee) -> dict:
    q = select(EbApplication).where(EbApplication.is_deleted == False)
    
    if current_user.designation == "Document Follow-up Executive":
        q = q.where(EbApplication.assigned_employee_id == current_user.id)
        
    apps = (await db.execute(q)).scalars().all()
    
    counters = {
        "application_received": sum(1 for a in apps if a.current_stage == "Application Received" or a.current_stage == "Document Collection"),
        "documents_pending": sum(1 for a in apps if a.current_stage in ["Application Received", "Document Collection", "Document Verification"] and a.verification_status != "VERIFIED"),
        "documents_not_verified": sum(1 for a in apps if a.verification_status == "NOT_VERIFIED"),
        "documents_verified": sum(1 for a in apps if a.verification_status == "VERIFIED"),
        "portal_submission_pending": sum(1 for a in apps if a.verification_status == "VERIFIED" and a.portal_submission_status != "COMPLETED"),
        "portal_submitted": sum(1 for a in apps if a.portal_submission_status == "COMPLETED"),
        "handover_pending": sum(1 for a in apps if a.portal_submission_status == "COMPLETED" and a.handover_status != "COMPLETED"),
        "completed": sum(1 for a in apps if a.handover_status == "COMPLETED"),
    }
    return counters
