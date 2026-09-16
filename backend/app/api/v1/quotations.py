"""
Quotations router — create, revise, status update, document generation.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import Permission, require_permissions
from app.core.security import get_current_user
from app.schemas.quotation import QuotationCreate, QuotationRead, QuotationRevise, QuotationStatusUpdate, LineItemCreate
from app.services import quotation_service
from app.utils.pagination import PagedResponse, PaginationParams
from decimal import Decimal

router = APIRouter(prefix="/quotations", tags=["Quotations"])


from pydantic import BaseModel
from typing import List

class DashboardSummaryOut(BaseModel):
    total: int
    draft: int
    sent: int
    customerApproved: int
    customerRejected: int
    expired: int

class DashboardResponseOut(BaseModel):
    items: List[QuotationRead]
    total: int
    page: int
    size: int
    pages: int
    summary: DashboardSummaryOut

@router.get("/dashboard", response_model=DashboardResponseOut)
async def get_quotation_dashboard(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.QUOTATIONS_READ)),
):
    items, total, summary = await quotation_service.get_dashboard_quotations(
        db, current_user, search, status, from_date, to_date, params.offset, params.limit
    )
    pages = (total + params.limit - 1) // params.limit if params.limit > 0 else 1
    return {
        "items": [QuotationRead.model_validate(q) for q in items],
        "total": total,
        "page": params.page,
        "size": params.limit,
        "pages": pages,
        "summary": summary
    }


@router.get("", response_model=PagedResponse[QuotationRead])
async def list_quotations(
    lead_id: Optional[str] = Query(None),
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.QUOTATIONS_READ)),
):
    items, total = await quotation_service.list_quotations(db, current_user, lead_id, params.offset, params.limit)
    return PagedResponse.create([QuotationRead.model_validate(q) for q in items], total, params)


@router.get("/prefill/{lead_id}", response_model=list[LineItemCreate])
async def get_quotation_prefill(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.QUOTATIONS_READ)),
):
    from sqlalchemy import select, desc, or_
    from app.models.site_visit import SiteVisit
    
    stmt = select(SiteVisit).where(
        or_(
            SiteVisit.lead_id == lead_id,
            SiteVisit.project_id == lead_id,
            SiteVisit.customer_mobile == lead_id,
            SiteVisit.customer_name == lead_id
        ),
        SiteVisit.status == "Completed",
        SiteVisit.stock_availability_status == "Available",
        SiteVisit.is_deleted == False
    ).order_by(desc(SiteVisit.created_at)).limit(1)
    
    res = await db.execute(stmt)
    visit = res.scalar_one_or_none()
    
    line_items = []
    if visit and visit.raw_material_details:
        for idx, rm in enumerate(visit.raw_material_details):
            product_name = rm.get("item_name") or rm.get("itemName", "")
            line_items.append(
                LineItemCreate(
                    product=product_name,
                    itemName=product_name,
                    item_name=product_name,
                    product_name=product_name,
                    item_id=rm.get("item_id"),
                    product_id=rm.get("item_id"),
                    quantity=float(rm.get("quantity", 1)),
                    unit="Nos",
                    unit_price=0.0,
                    discount=0.0,
                    gst_percent=18.0,
                    labour_charge=0.0,
                    sort_order=idx
                )
            )
            
    return line_items


@router.post("", response_model=QuotationRead, status_code=201)
async def create_quotation(
    payload: QuotationCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.QUOTATIONS_WRITE)),
):
    q = await quotation_service.create_quotation(db, payload, current_user)
    return QuotationRead.model_validate(q)


@router.get("/{quotation_id}", response_model=QuotationRead)
async def get_quotation(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.QUOTATIONS_READ)),
):
    q = await quotation_service.get_quotation(db, quotation_id)
    return QuotationRead.model_validate(q)


@router.post("/{quotation_id}/revise", response_model=QuotationRead, status_code=201)
async def revise_quotation(
    quotation_id: str,
    payload: QuotationRevise,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.QUOTATIONS_REVISE)),
):
    q = await quotation_service.revise_quotation(db, quotation_id, payload, current_user)
    return QuotationRead.model_validate(q)


@router.patch("/{quotation_id}/status", response_model=QuotationRead)
async def update_status(
    quotation_id: str,
    payload: QuotationStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.QUOTATIONS_WRITE)),
):
    q = await quotation_service.get_quotation(db, quotation_id)
    old_status = q.status
    q.status = payload.status
    db.add(q)
    await db.flush()
    
    if old_status != "Sent" and payload.status == "Sent":
        from app.models.notification import Notification
        from app.models.employee import Employee
        from sqlalchemy import select
        
        qm_res = await db.execute(select(Employee).where(Employee.designation == "Quotation Manager"))
        qms = qm_res.scalars().all()
        for qm in qms:
            notif = Notification(
                title="New Quotation Arrived",
                message=f"A new quotation for {q.customer_name} has been sent to you.",
                recipient_id=qm.id,
                priority="High",
                category="System",
            )
            db.add(notif)
            from app.websocket.events import WebSocketEvent, Events
            db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id}, set(), set()))
        await db.flush()
    
    if payload.status == "Customer Approved" and old_status != payload.status:
        from datetime import datetime, timezone
        from app.models.employee import Employee
        from app.models.employee_revenue import EmployeeRevenue
        from app.models.lead import Lead
        from app.models.site_visit import SiteVisit
        from sqlalchemy import select
        from sqlalchemy.dialects.postgresql import insert
        
        eligible_employee_ids = set()
        if q.prepared_by_id:
            eligible_employee_ids.add(q.prepared_by_id)
            
        if q.lead_id:
            lead_res = await db.execute(select(Lead).where(Lead.id == q.lead_id))
            lead_obj = lead_res.scalar_one_or_none()
            if lead_obj:
                if lead_obj.created_by_id:
                    eligible_employee_ids.add(lead_obj.created_by_id)
                if lead_obj.assigned_employee_id:
                    eligible_employee_ids.add(lead_obj.assigned_employee_id)
                    
            site_visit_stmt = select(SiteVisit).where(SiteVisit.lead_id == q.lead_id).order_by(SiteVisit.created_at.desc()).limit(1)
            site_visit_res = await db.execute(site_visit_stmt)
            site_visit_obj = site_visit_res.scalar_one_or_none()
            if site_visit_obj and site_visit_obj.employee_id:
                eligible_employee_ids.add(site_visit_obj.employee_id)

        if eligible_employee_ids:
            emps_res = await db.execute(select(Employee).where(Employee.id.in_(eligible_employee_ids)))
            emps = emps_res.scalars().all()
            
            now_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            for emp in emps:
                if emp.designation in ("Accountant", "Partner / Payment Receiver") or emp.department == "Accounts":
                    continue
                    
                stmt = insert(EmployeeRevenue).values(
                    employee_id=emp.id,
                    project_id=None,
                    quotation_id=q.id,
                    revenue=q.grand_total,
                    revenue_date=now_date
                ).on_conflict_do_nothing(
                    index_elements=['quotation_id', 'employee_id']
                )
                await db.execute(stmt)
        await db.flush()
    
    if payload.status in ("Customer Approved", "Customer Rejected") and old_status != payload.status:
        from app.models.notification import Notification
        from app.websocket.events import WebSocketEvent, Events
        
        marketing_emp_id = None
        if q.lead_id:
            from app.models.lead import Lead
            from sqlalchemy import select
            lead_res = await db.execute(select(Lead).where(Lead.id == q.lead_id))
            lead_obj = lead_res.scalar_one_or_none()
            if lead_obj and lead_obj.assigned_employee_id:
                marketing_emp_id = lead_obj.assigned_employee_id
                
        if not marketing_emp_id:
            marketing_emp_id = q.prepared_by_id

        # Notify the marketing team (lead owner) if the current user isn't them
        if marketing_emp_id and marketing_emp_id != current_user.id:
            notif_mktg = Notification(
                title=f"Quotation {payload.status}",
                message=f"Quotation for {q.customer_name} has been {payload.status.lower()} (updated by {current_user.name}).",
                recipient_id=marketing_emp_id,
                priority="High",
                category="System",
            )
            db.add(notif_mktg)
            db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_mktg.id), {notif_mktg.recipient_id}, set(), set()))
            
        # Notify CEO if the current user isn't CEO
        if current_user.designation != "CEO":
            notif_ceo = Notification(
                title=f"Quotation {payload.status}",
                message=f"Quotation for {q.customer_name} has been {payload.status.lower()} by {current_user.name}.",
                department="CEO",
                priority="High",
                category="System",
            )
            db.add(notif_ceo)
            db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_ceo.id), set(), {notif_ceo.department}, set()))

    if old_status != "Customer Approved" and payload.status == "Customer Approved":
        from app.models.project import Project
        from sqlalchemy import select
        
        existing_proj = await db.execute(select(Project).where(Project.quotation_id == q.id, Project.is_deleted == False))
        if not existing_proj.scalars().first():
            from app.services.project_service import create_project
            from app.schemas.project import ProjectCreate
            from app.models.lead import Lead
            from app.models.customer import Customer

            lead = None
            customer_id = None
            if q.lead_id:
                lead_res = await db.execute(select(Lead).where(Lead.id == q.lead_id))
                lead = lead_res.scalar_one_or_none()
                if lead:
                    if not lead.customer_id:
                        # Auto-convert Lead to Customer
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
                        lead.status = "Converted"
                        db.add(lead)
                        customer_id = customer.id
                    else:
                        customer_id = lead.customer_id

            capacity = None
            if lead and lead.approximate_requirement:
                import re
                match = re.search(r"(\d+(?:\.\d+)?)", lead.approximate_requirement)
                if match:
                    capacity = Decimal(match.group(1))

            project_payload = ProjectCreate(
                customer_id=customer_id,
                customer_name=q.customer_name,
                customer_mobile=lead.mobile if lead else None,
                site=q.site,
                area=lead.area if lead else None,
                quotation_id=q.id,
                project_value=q.grand_total,
                advance_received=0,
                capacity_kw=capacity,
                priority="Medium",
            )
            
            project = await create_project(db, project_payload, current_user)
            
            # Transition to Advance Payment stage
            from app.models.project import ProjectStageHistory
            from app.models.notification import Notification
            
            project.current_stage = "Awaiting Advance Payment"
            history = ProjectStageHistory(
                project_id=project.id,
                stage="Awaiting Advance Payment",
                changed_by_id=current_user.id,
                note="Automatically transitioned from quotation approval",
            )
            db.add(project)
            db.add(history)
            
            # Notify Accounts department
            notif = Notification(
                title="Project Awaiting Advance",
                message=f"Project '{project.customer_name}' is awaiting advance payment. Please verify or collect.",
                department="Accounts",
                priority="High",
                category="Payment",
            )
            db.add(notif)
            from app.websocket.events import WebSocketEvent, Events
            db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), set(), {notif.department}, set()))
            
            # Notify Partner(s) directly
            from app.models.employee import Employee
            from sqlalchemy import select
            partners_res = await db.execute(select(Employee).where(Employee.designation == "Partner / Payment Receiver"))
            for p in partners_res.scalars().all():
                notif_partner = Notification(
                    title="New Project - Ready for Payment",
                    message=f"Project '{project.customer_name}' has been approved and is ready for payment collection.",
                    recipient_id=p.id,
                    priority="High",
                    category="Payment",
                )
                db.add(notif_partner)
                from app.websocket.events import WebSocketEvent, Events
                db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_partner.id), {notif_partner.recipient_id}, set(), set()))
            
            await db.flush()

    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.QUOTATION_UPDATED, "Quotation", "StatusUpdate", q.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])

    return QuotationRead.model_validate(q)


@router.get("/{quotation_id}/document", summary="Download quotation as PDF")
async def download_document(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.QUOTATIONS_READ)),
):
    from app.utils.pdf_generator import generate_quotation_pdf
    q = await quotation_service.get_quotation(db, quotation_id)
    pdf_bytes = generate_quotation_pdf(q)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{q.quotation_number}.pdf"'},
    )


@router.put("/{quotation_id}", response_model=QuotationRead)
async def update_quotation(
    quotation_id: str,
    payload: QuotationCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.QUOTATIONS_WRITE)),
):
    q = await quotation_service.update_quotation(db, quotation_id, payload, current_user)
    return QuotationRead.model_validate(q)


@router.delete("/{quotation_id}", status_code=204)
async def delete_quotation(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.QUOTATIONS_WRITE)),
):
    await quotation_service.delete_quotation(db, quotation_id)
    return Response(status_code=204)

