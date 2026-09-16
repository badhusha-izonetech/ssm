from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, UploadFile
import os
import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import selectinload

from app.models.site_visit import SiteVisit, SiteVisitLocation, SiteVisitPhoto
from app.models.lead import Lead
from app.models.employee import Employee
from app.schemas.site_visit import SiteVisitCreate, StartSiteVisitRequest, SiteVisitLocationCreate, CompleteSiteVisitRequest, AddSiteVisitEvidenceRequest
from app.utils.geofence import calculate_distance_meters
from app.core.config import settings
from app.websocket.events import WebSocketEvent, Events
MAX_ACCURACY_METERS = 5000


async def list_site_visits(db: AsyncSession, employee_id: str = None) -> list[SiteVisit]:
    stmt = select(SiteVisit).options(selectinload(SiteVisit.photos))
    if employee_id:
        stmt = stmt.where(SiteVisit.employee_id == employee_id)
    
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_marketing_site_products(db: AsyncSession, employee_id: str) -> list[SiteVisit]:
    stmt = (
        select(SiteVisit)
        .join(Lead, SiteVisit.lead_id == Lead.id)
        .where(
            SiteVisit.status == "Completed",
            Lead.assigned_employee_id == employee_id
        )
        .options(selectinload(SiteVisit.photos))
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_site_visit(db: AsyncSession, visit_id: str) -> SiteVisit:
    stmt = select(SiteVisit).options(
        selectinload(SiteVisit.photos),
        selectinload(SiteVisit.tracking_locations)
    ).where(SiteVisit.id == visit_id)
    
    result = await db.execute(stmt)
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Site visit not found")
    return visit


async def create_site_visit(db: AsyncSession, payload: SiteVisitCreate) -> SiteVisit:
    # Prevent assigning to an employee who already has active site visits
    if payload.employee_id:
        from sqlalchemy import select, func
        active_count_result = await db.execute(
            select(func.count()).select_from(SiteVisit).where(
                SiteVisit.employee_id == payload.employee_id,
                SiteVisit.status.in_(["Upcoming", "In Progress", "Revisit Required"])
            )
        )
        active_count = active_count_result.scalar() or 0
        if active_count > 0:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail="This site visitor already has active visits and cannot be assigned a new one."
            )

    visit = SiteVisit(**payload.model_dump())
    db.add(visit)
    
    if visit.lead_id:
        lead = await db.get(Lead, visit.lead_id)
        if lead:
            lead.status = "Site Visit Scheduled"
            
    if visit.project_id:
        from app.models.project import Project
        project = await db.get(Project, visit.project_id)
        if project and project.current_stage == "Installation":
            # Just an indicator, doesn't need to change project stage yet.
            pass

    await db.flush()
    
    # Broadcast site visit created + notify assigned employee
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.SITE_VISIT_CREATED, "SiteVisit", "Create", visit.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    if visit.lead_id:
        db.info.setdefault("ws_actions", []).append(
            ("broadcast", WebSocketEvent.create(Events.LEAD_UPDATED, "Lead", "Update", visit.lead_id))
        )
    if visit.employee_id:
        from app.models.notification import Notification
        title = "New Site Visit Assigned"
        message = f"You have been assigned a new site visit for {visit.customer_name}."
        
        if visit.site_type == "Final Review":
            title = "New Visit for Final Review Assigned"
            message = f"You have been assigned a new visit for final review for {visit.customer_name}."
        elif visit.site_type == "Project Installation":
            title = "Project Installation Assigned"
            message = f"You have been assigned a project installation visit for {visit.customer_name}."
            
        notif = Notification(
            title=title,
            message=message,
            recipient_id=visit.employee_id,
            priority="High",
            category="System"
        )
        db.add(notif)
        db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id} if notif.recipient_id else set(), {notif.department} if notif.department else set(), set()))
        
    await db.commit()
    return await get_site_visit(db, visit.id)


async def start_site_visit(db: AsyncSession, visit_id: str, employee_id: str, payload: StartSiteVisitRequest) -> SiteVisit:
    visit = await get_site_visit(db, visit_id)
    
    if visit.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Not assigned to this site visit")
        
    if visit.status != "Upcoming":
        raise HTTPException(status_code=400, detail="Site visit already started or completed")

    visit.status = "In Progress"
    visit.started_at = datetime.now(timezone.utc).replace(tzinfo=None)
    
    db.info.setdefault("ws_actions", []).append(
        ("broadcast", WebSocketEvent.create(Events.SITE_VISIT_UPDATED, "SiteVisit", "Start", visit.id))
    )
    await db.commit()
    return await get_site_visit(db, visit.id)


async def track_location(db: AsyncSession, visit_id: str, employee_id: str, payload: SiteVisitLocationCreate) -> SiteVisitLocation:
    visit = await get_site_visit(db, visit_id)
    
    if visit.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Not assigned to this site visit")
        
    if visit.status != "In Progress":
        raise HTTPException(status_code=400, detail="Can only track location while site visit is In Progress")
        
    distance = None
    if visit.customer_latitude is not None and visit.customer_longitude is not None:
        distance = calculate_distance_meters(
            payload.latitude, payload.longitude,
            visit.customer_latitude, visit.customer_longitude
        )
        
    loc = SiteVisitLocation(
        site_visit_id=visit.id,
        employee_id=employee_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy=payload.accuracy,
        distance_from_customer=distance,
        captured_at=payload.captured_at
    )
    
    db.add(loc)
    await db.commit()
    await db.refresh(loc)
    return loc


async def upload_photo(
    db: AsyncSession, 
    visit_id: str, 
    employee_id: str,
    file: UploadFile,
    latitude: float,
    longitude: float,
    accuracy: float,
    captured_at: str,
    stage: str | None = None
) -> SiteVisitPhoto:
    visit = await get_site_visit(db, visit_id)
    
    if visit.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Not assigned to this site visit")
        
    if visit.status != "In Progress":
        raise HTTPException(status_code=400, detail="Can only upload photos while site visit is In Progress")
        
    # Compute distance from customer coords if available
    distance = None
    if visit.customer_latitude is not None and visit.customer_longitude is not None:
        distance = calculate_distance_meters(
            latitude, longitude,
            visit.customer_latitude, visit.customer_longitude
        )
        
    # Save the file securely to MinIO
    from app.utils.file_upload import save_field_visit_photo
    file_url = await save_field_visit_photo(file)
        
    dt_captured = datetime.fromisoformat(captured_at.replace("Z", "+00:00"))
    
    photo = SiteVisitPhoto(
        site_visit_id=visit.id,
        employee_id=employee_id,
        file_path=file_url,
        stage=stage,
        latitude=latitude,
        longitude=longitude,
        accuracy=accuracy,
        distance_from_customer=distance if distance is not None else 0.0,
        captured_at=dt_captured
    )
    
    db.add(photo)
    await db.commit()
    await db.refresh(photo)
    return photo


async def complete_stage(db: AsyncSession, visit_id: str, employee_id: str, stage: str) -> SiteVisit:
    visit = await get_site_visit(db, visit_id)
    if visit.employee_id != employee_id:
        employee = await db.get(Employee, employee_id)
        dept = getattr(employee, "department", "") if employee else ""
        desig = getattr(employee, "designation", "") if employee else ""
        if not employee or (dept not in ["CEO", "Project", "Site Visit", "Admin"] and desig not in ["CEO", "Project Head", "Field Technician", "Site Visitor"]):
            raise HTTPException(status_code=403, detail="Not assigned to this site visit")

    if visit.status != "In Progress":
        raise HTTPException(status_code=400, detail="Site visit must be In Progress")
    
    # Check if there is at least one photo for this stage in SiteVisitPhoto or ProjectUpload
    from sqlalchemy import select
    from app.models.site_visit import SiteVisitPhoto
    from app.models.project_upload import ProjectUpload

    photo_res = await db.scalars(
        select(SiteVisitPhoto)
        .where(SiteVisitPhoto.site_visit_id == visit_id)
        .where(SiteVisitPhoto.stage == stage)
    )
    has_photo = photo_res.first() is not None

    if not has_photo and visit.project_id:
        upload_res = await db.scalars(
            select(ProjectUpload)
            .where(ProjectUpload.project_id == visit.project_id)
            .where(ProjectUpload.stage == stage)
        )
        has_photo = upload_res.first() is not None

    if not has_photo:
        raise HTTPException(status_code=400, detail=f"Cannot complete stage '{stage}' without photo evidence")
        
    completed = list(visit.completed_stages or [])
    if stage not in completed:
        completed.append(stage)
        visit.completed_stages = completed
        await db.commit()
    
    return await get_site_visit(db, visit.id)

async def complete_site_visit(db: AsyncSession, visit_id: str, employee_id: str, payload: CompleteSiteVisitRequest) -> SiteVisit:
    visit = await get_site_visit(db, visit_id)
    
    if visit.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Not assigned to this site visit")
        
    if visit.status != "In Progress":
        raise HTTPException(status_code=400, detail="Can only complete a site visit that is In Progress")
        
    # Validate stages if it's a project installation visit
    if visit.project_id and visit.system_type:
        common_stages = ["Structure Erection", "Electrical Work", "Panel Mounting", "DC Wiring Work", "Earthing and Lightning Arrestor"]
        required_stages = []
        if visit.system_type == "ON-GRID":
            required_stages = common_stages + ["Inverter Installation"]
        elif visit.system_type == "OFF-GRID":
            required_stages = common_stages + ["Battery Installation"]
        elif visit.system_type == "HYBRID":
            required_stages = common_stages + ["Inverter Installation", "Battery Installation"]
        elif visit.system_type == "SOLAR PUMPSET":
            required_stages = ["Structure Erection", "Structure Mounting", "Panel Mounting", "Final Output"]
            
        completed = set(visit.completed_stages)
        missing = [s for s in required_stages if s not in completed]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing required stages: {', '.join(missing)}")
        
    if payload.feasibility_result == "Revisit Required":
        visit.status = "Revisit Required"
    elif payload.feasibility_result in ("Not Feasible", "Customer Requirement Not Supported"):
        visit.status = "Rejected"
    else:
        visit.status = "Completed"
        
    visit.feasibility_result = payload.feasibility_result
    visit.rejection_reason = payload.rejection_reason
    visit.rejection_remarks = payload.rejection_remarks
    visit.notes = payload.notes
    visit.installation_area = payload.installation_area
    visit.measurements = payload.measurements
    visit.roof_ground_details = payload.roof_ground_details
    visit.raw_materials = payload.raw_materials
    if payload.raw_material_details is not None:
        visit.raw_material_details = payload.raw_material_details
        if len(payload.raw_material_details) > 0:
            visit.stock_availability_status = "Pending Check"
    visit.cable_accessories = payload.cable_accessories
    visit.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    
    lead = await db.get(Lead, visit.lead_id)
    if lead:
        if visit.status == "Revisit Required":
            lead.status = "Site Visit Required"
        elif visit.status == "Rejected":
            lead.status = "Lost"
            lead.lost_reason = payload.rejection_reason or "Technical Infeasibility"
            lead.lost_reason_detail = payload.rejection_remarks
        elif visit.status == "Completed":
            lead.status = "Quotation Stage"
            
            from app.models.quotation import Quotation
            from app.schemas.quotation import QuotationCreate
            from app.services.quotation_service import create_quotation
            from datetime import timedelta
            
            existing = await db.execute(select(Quotation).where(Quotation.lead_id == lead.id))
            if not existing.scalars().first():
                from app.models.employee import Employee
                creator_id = lead.assigned_employee_id or lead.created_by_id or employee_id
                quotation_owner = await db.get(Employee, creator_id)
                if not quotation_owner:
                    quotation_owner = await db.get(Employee, employee_id)
                
                if quotation_owner:
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
                    await create_quotation(db, q_payload, quotation_owner)
        from app.models.notification import Notification
        
        outcome_msg = ""
        if visit.status == "Revisit Required":
            outcome_msg = "A revisit is required."
        elif visit.status == "Rejected":
            outcome_msg = "The site visit resulted in a rejection (Not Feasible)."
        elif visit.status == "Completed":
            outcome_msg = "The site visit was completed successfully."

        message = f"Site Visit for lead '{lead.customer_name}' has been marked as {visit.status} by {visit.employee_name}. {outcome_msg}"

        # Notify CEO
        notif_ceo = Notification(
            title="Site Visit Outcome",
            message=message,
            department="CEO",
            priority="Medium",
            category="System"
        )
        db.add(notif_ceo)
        db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_ceo.id), {notif_ceo.recipient_id} if notif_ceo.recipient_id else set(), {notif_ceo.department} if notif_ceo.department else set(), set()))
        
        # Notify Marketing Employee
        if lead.assigned_employee_id:
            notif_mktg = Notification(
                title="Site Visit Outcome",
                message=message,
                recipient_id=lead.assigned_employee_id,
                priority="High",
                category="System"
            )
            db.add(notif_mktg)
            db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_mktg.id), {notif_mktg.recipient_id} if notif_mktg.recipient_id else set(), {notif_mktg.department} if notif_mktg.department else set(), set()))
            
    if visit.stock_availability_status == "Pending Check":
        from app.models.notification import Notification
        notif_warehouse = Notification(
            title="Pending Site Stock Check",
            message=f"Site Visit for '{visit.customer_name}' requires a stock availability check.",
            department="Warehouse",
            priority="High",
            category="Stock"
        )
        db.add(notif_warehouse)
        db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_warehouse.id), {notif_warehouse.recipient_id} if notif_warehouse.recipient_id else set(), {notif_warehouse.department} if notif_warehouse.department else set(), set()))
    
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.SITE_VISIT_UPDATED, "SiteVisit", "Complete", visit.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    if visit.lead_id:
        db.info.setdefault("ws_actions", []).append(
            ("broadcast", WebSocketEvent.create(Events.LEAD_UPDATED, "Lead", "Update", visit.lead_id))
        )
    await db.commit()
    return await get_site_visit(db, visit.id)


async def add_site_visit_evidence(db: AsyncSession, visit_id: str, employee_id: str, payload: AddSiteVisitEvidenceRequest, bypass_owner: bool = False) -> SiteVisit:
    visit = await get_site_visit(db, visit_id)
    if not bypass_owner and visit.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Not assigned to this site visit")
    
    from app.utils.file_upload import save_base64_file
    
    if payload.photo:
        url = await save_base64_file(payload.photo)
        if url:
            photo = SiteVisitPhoto(
                site_visit_id=visit.id, employee_id=employee_id, file_path=url,
                latitude=0.0, longitude=0.0, accuracy=0.0, distance_from_customer=0.0,
                captured_at=datetime.now(timezone.utc).replace(tzinfo=None)
            )
            db.add(photo)
    
    if payload.video:
        url = await save_base64_file(payload.video)
        if url: visit.videos = list(visit.videos or []) + [url]
        
    if payload.measurement_image:
        url = await save_base64_file(payload.measurement_image)
        if url: visit.measurement_images = list(visit.measurement_images or []) + [url]
        
    if payload.document:
        url = await save_base64_file(payload.document)
        if url: visit.documents = list(visit.documents or []) + [url]
        
    if payload.note:
        visit.notes = (visit.notes + "\n\n" + payload.note) if visit.notes else payload.note
        
    if payload.stock_availability_status:
        if payload.stock_availability_status == "Available" and visit.raw_material_details:
            from app.models.stock_item import StockItem
            from sqlalchemy import select
            
            for rm in visit.raw_material_details:
                item_id = rm.get("item_id")
                if item_id:
                    result = await db.execute(select(StockItem).where(StockItem.id == item_id))
                    stock_item = result.scalar_one_or_none()
                    if not stock_item:
                        raise HTTPException(status_code=400, detail=f"Stock item {rm.get('itemName', 'Unknown')} not found in inventory")
                    qty = float(rm.get("quantity", 0))
                    # Removed strict stock validation here to allow warehouse to override system stock 
                    # if they physically verified availability.
                    # if float(stock_item.available_quantity) < qty:
                    #     raise HTTPException(
                    #         status_code=400, 
                    #         detail=f"Insufficient stock for {stock_item.product_name}. Available: {stock_item.available_quantity}, Required: {qty}"
                    #     )
        
        old_stock_status = visit.stock_availability_status
        visit.stock_availability_status = payload.stock_availability_status
        
        if old_stock_status != "Available" and payload.stock_availability_status == "Available":
            from app.models.notification import Notification
            notif_ceo = Notification(
                title="Stock Available for Site Visit",
                message=f"Warehouse has verified that stock is available for the site visit of '{visit.customer_name}'.",
                department="CEO",
                priority="Medium",
                category="Stock"
            )
            db.add(notif_ceo)
            db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_ceo.id), set(), {notif_ceo.department}, set()))

            if visit.lead_id:
                from app.models.lead import Lead
                from sqlalchemy import select
                lead_res = await db.execute(select(Lead).where(Lead.id == visit.lead_id))
                lead = lead_res.scalar_one_or_none()
                if lead and lead.assigned_employee_id:
                    notif_mktg = Notification(
                        title="Stock Available - Ready for Quotation",
                        message=f"Stock for '{visit.customer_name}' is available. You can now proceed to create the quotation.",
                        recipient_id=lead.assigned_employee_id,
                        priority="High",
                        category="Stock"
                    )
                    db.add(notif_mktg)
                    db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_mktg.id), {notif_mktg.recipient_id}, set(), set()))
        
        
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.SITE_VISIT_UPDATED, "SiteVisit", "Update", visit.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    await db.commit()
    await db.refresh(visit)
    return await get_site_visit(db, visit.id)

async def upload_evidence_file(db: AsyncSession, visit_id: str, employee_id: str, file_type: str, file: UploadFile, bypass_owner: bool = False) -> SiteVisit:
    visit = await get_site_visit(db, visit_id)
    if not bypass_owner and visit.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Not assigned to this site visit")
    
    from app.utils.file_upload import save_upload, ALLOWED_MEDIA_TYPES, ALLOWED_DOC_TYPES, ALLOWED_IMAGE_TYPES
    
    url = None
    if file_type == 'video':
        url = await save_upload(file, "site_visit_evidence/videos", ALLOWED_MEDIA_TYPES)
        if url: visit.videos = list(visit.videos or []) + [url]
    elif file_type == 'document':
        url = await save_upload(file, "site_visit_evidence/documents", ALLOWED_DOC_TYPES)
        if url: visit.documents = list(visit.documents or []) + [url]
    elif file_type == 'measurementImage':
        url = await save_upload(file, "site_visit_evidence/measurements", ALLOWED_IMAGE_TYPES)
        if url: visit.measurement_images = list(visit.measurement_images or []) + [url]
    elif file_type == 'photo':
        url = await save_upload(file, "field_visit_photos", ALLOWED_IMAGE_TYPES)
        if url:
            from app.models.site_visit import SiteVisitPhoto
            photo = SiteVisitPhoto(
                site_visit_id=visit.id, employee_id=employee_id, file_path=url,
                latitude=0.0, longitude=0.0, accuracy=0.0, distance_from_customer=0.0,
                captured_at=datetime.now(timezone.utc).replace(tzinfo=None)
            )
            db.add(photo)
    else:
        raise HTTPException(status_code=400, detail="Invalid file_type")
        
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.SITE_VISIT_UPDATED, "SiteVisit", "Update", visit.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    await db.commit()
    return await get_site_visit(db, visit.id)

async def upload_tool_photo(
    db: AsyncSession,
    visit_id: str,
    employee_id: str,
    file: "UploadFile",
    photo_type: str,  # 'before' or 'after'
) -> SiteVisit:
    """Upload before-work or after-work tool/equipment photo."""
    from app.utils.file_upload import save_upload, ALLOWED_IMAGE_TYPES
    visit = await get_site_visit(db, visit_id)

    if visit.employee_id != employee_id:
        employee = await db.get(Employee, employee_id)
        dept = getattr(employee, "department", "") if employee else ""
        desig = getattr(employee, "designation", "") if employee else ""
        if not employee or (dept not in ["CEO", "Project", "Site Visit", "Admin"] and desig not in ["CEO", "Project Head", "Field Technician", "Site Visitor"]):
            raise HTTPException(status_code=403, detail="Not assigned to this site visit")

    if visit.submitted_at is not None:
        raise HTTPException(status_code=400, detail="Site visit already submitted. Cannot modify.")

    if photo_type not in ['before', 'after']:
        raise HTTPException(status_code=400, detail="photo_type must be 'before' or 'after'")

    url = await save_upload(file, f"tool_photos/{visit_id}", ALLOWED_IMAGE_TYPES)

    if photo_type == 'before':
        visit.tool_photo_before = url
    else:
        visit.tool_photo_after = url

    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.SITE_VISIT_UPDATED, "SiteVisit", "Update", visit.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    await db.commit()
    return await get_site_visit(db, visit.id)


async def submit_site_visit(
    db: AsyncSession,
    visit_id: str,
    employee_id: str,
    system_type: str | None = None,
) -> SiteVisit:
    """Submit the site visit after all required work is done."""
    visit = await get_site_visit(db, visit_id)

    if visit.employee_id != employee_id:
        employee = await db.get(Employee, employee_id)
        dept = getattr(employee, "department", "") if employee else ""
        desig = getattr(employee, "designation", "") if employee else ""
        if not employee or (dept not in ["CEO", "Project", "Site Visit", "Admin"] and desig not in ["CEO", "Project Head", "Field Technician", "Site Visitor"]):
            raise HTTPException(status_code=403, detail="Not assigned to this site visit")

    if visit.status != "In Progress":
        raise HTTPException(status_code=400, detail="Site visit must be In Progress to submit")

    if visit.submitted_at is not None:
        raise HTTPException(status_code=400, detail="Site visit already submitted")

    # Fallback to ProjectUpload if tool photos are not directly set on visit object
    from app.models.project_upload import ProjectUpload
    if not visit.tool_photo_before and visit.project_id:
        u_before = (await db.scalars(
            select(ProjectUpload)
            .where(ProjectUpload.project_id == visit.project_id)
            .where(ProjectUpload.file_type == "Tool Photo Before")
        )).first()
        if u_before:
            visit.tool_photo_before = u_before.file_url

    if not visit.tool_photo_after and visit.project_id:
        u_after = (await db.scalars(
            select(ProjectUpload)
            .where(ProjectUpload.project_id == visit.project_id)
            .where(ProjectUpload.file_type == "Tool Photo After")
        )).first()
        if u_after:
            visit.tool_photo_after = u_after.file_url

    # Validate: tool photos required
    if not visit.tool_photo_before:
        raise HTTPException(status_code=400, detail="Before-work tool/equipment photo is required")
    if not visit.tool_photo_after:
        raise HTTPException(status_code=400, detail="After-work tool/equipment photo is required")

    # Validate: required stages must be completed
    sv_system_type = visit.system_type or system_type
    if visit.project_id and sv_system_type and visit.site_type != "Final Review":
        common_stages = ["Structure Erection", "Electrical Work", "Panel Mounting", "DC Wiring Work", "Earthing and Lightning Arrestor"]
        required_stages: list[str] = []
        st = sv_system_type.upper()
        if st == "ON-GRID":
            required_stages = common_stages + ["Inverter Installation"]
        elif st == "OFF-GRID":
            required_stages = common_stages + ["Battery Installation"]
        elif st == "HYBRID":
            required_stages = common_stages + ["Inverter Installation", "Battery Installation"]
        elif st == "SOLAR PUMPSET":
            required_stages = ["Structure Erection", "Structure Mounting", "Panel Mounting", "Final Output"]

        completed = set(visit.completed_stages or [])
        missing = [s for s in required_stages if s not in completed]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Complete all required stages first: {', '.join(missing)}"
            )

    visit.status = "Completed"
    visit.submitted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    visit.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)

    # Update parent project
    if visit.project_id:
        from app.models.project import Project
        result = await db.scalars(select(Project).where(Project.id == visit.project_id))
        project = result.first()
        if project:
            if visit.site_type == "Final Review":
                project.review_completed = True
                project.current_stage = "Completed"
                project.status = "Completed"
            else:
                project.installation_status = "Completed"
                if project.current_stage not in ["Final Connection", "Completed"]:
                    project.current_stage = "Final Connection"
                
        from app.models.notification import Notification
        
        if visit.site_type == "Final Review":
            msg = f"Final Review for project '{project.customer_name}' has been completed by {visit.employee_name}. Feedback collected and project closed."
            title = "Final Review Completed"
        else:
            msg = f"Installation Site Visit for project '{project.customer_name}' ({project.project_code}) has been completed by {visit.employee_name}."
            title = "Installation Completed"
        
        # Notify CEO
        notif_ceo = Notification(
            title=title,
            message=msg,
            department="CEO",
            priority="Medium",
            category="Project"
        )
        db.add(notif_ceo)
        db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_ceo.id), {notif_ceo.recipient_id} if notif_ceo.recipient_id else set(), {notif_ceo.department} if notif_ceo.department else set(), set()))
        
        # Notify Project Head
        notif_proj = Notification(
            title=title,
            message=msg,
            department="Project",
            priority="High",
            category="Project"
        )
        db.add(notif_proj)
        db.info.setdefault("ws_actions", []).append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_proj.id), {notif_proj.recipient_id} if notif_proj.recipient_id else set(), {notif_proj.department} if notif_proj.department else set(), set()))

    db.info.setdefault("ws_actions", []).append(
        ("broadcast", WebSocketEvent.create(Events.SITE_VISIT_UPDATED, "SiteVisit", "CompleteProject", visit.id))
    )
    await db.commit()
    return await get_site_visit(db, visit.id)
