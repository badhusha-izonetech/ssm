"""
Quotation service — number generation, server-side totals, revision chain.
"""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models.employee import Employee
from app.models.quotation import Quotation, QuotationLineItem
from app.schemas.quotation import QuotationCreate, QuotationRevise
from app.utils.quotation_number import generate_quotation_number
from app.utils.quotation_totals import LineItemInput, compute_quotation_totals
from app.services.activity_log_service import log_activity
from decimal import Decimal


async def _load_quotation(db: AsyncSession, quotation_id: str) -> Quotation:
    result = await db.execute(
        select(Quotation).options(
            selectinload(Quotation.line_items),
            selectinload(Quotation.lead)
        ).where(Quotation.id == quotation_id)
    )
    return result.scalar_one()


def _map_line_inputs(items) -> List[LineItemInput]:
    return [
        LineItemInput(
            quantity=Decimal(str(item.quantity)),
            unit_price=Decimal(str(item.unit_price)),
            discount=Decimal(str(item.discount)),
            gst_percent=Decimal(str(item.gst_percent)),
            labour_charge=Decimal(str(item.labour_charge)),
        )
        for item in items
    ]


async def create_quotation(
    db: AsyncSession, payload: QuotationCreate, current_user: Employee
) -> Quotation:
    number = await generate_quotation_number(db)
    totals = compute_quotation_totals(
        _map_line_inputs(payload.line_items),
        Decimal(str(payload.advance_percentage)),
        Decimal(str(payload.other_charges)),
    )

    quotation = Quotation(
        quotation_number=number,
        revision_number=0,
        customer_name=payload.customer_name,
        site=payload.site,
        date=payload.date,
        valid_until=payload.valid_until,
        prepared_by=current_user.name,
        prepared_by_id=current_user.id,
        project_type=payload.project_type,
        eb_number=payload.eb_number,
        solar_panel=payload.solar_panel,
        solar_inverter=payload.solar_inverter,
        advance_percentage=payload.advance_percentage,
        other_charges=payload.other_charges,
        payment_terms=payload.payment_terms,
        installation_terms=payload.installation_terms,
        warranty_terms=payload.warranty_terms,
        notes=payload.notes,
        lead_id=payload.lead_id,
        customer_phone=payload.customer_phone,
        created_by_ceo=(current_user.designation == "CEO"),
        subtotal=totals.subtotal,
        discount_total=totals.discount_total,
        tax_total=totals.tax_total,
        labour_total=totals.labour_total,
        grand_total=totals.grand_total,
        advance_amount=totals.advance_amount,
        balance_amount=totals.balance_amount,
        status="Quotation Created",
    )
    db.add(quotation)
    await db.flush()

    for idx, (item_schema, line_result) in enumerate(
        zip(payload.line_items, totals.line_results)
    ):
        line = QuotationLineItem(
            quotation_id=quotation.id,
            sort_order=item_schema.sort_order or idx,
            product=item_schema.product,
            brand=item_schema.brand,
            description=item_schema.description,
            quantity=item_schema.quantity,
            unit=item_schema.unit,
            unit_price=item_schema.unit_price,
            discount=item_schema.discount,
            gst_percent=item_schema.gst_percent,
            labour_charge=item_schema.labour_charge,
            line_base=line_result.line_base,
            line_discount_amount=line_result.line_discount_amount,
            line_tax_amount=line_result.line_tax_amount,
            line_total=line_result.line_total,
        )
        db.add(line)

    await db.flush()
    
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.QUOTATION_CREATED, "Quotation", "Create", quotation.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    
    await log_activity(
        db,
        actor=current_user.name,
        actor_id=current_user.id,
        department=current_user.department,
        action="Created new quotation",
        entity=quotation.quotation_number,
        entity_type="Quotation",
        entity_id=quotation.id,
        detail=f"Amount: ₹{totals.grand_total}"
    )
    
    return await _load_quotation(db, quotation.id)


async def revise_quotation(
    db: AsyncSession, quotation_id: str, payload: QuotationRevise, current_user: Employee
) -> Quotation:
    """
    Append-only revision: never edits or deletes the original.
    Original → Expired, new row → Draft with same quotationNumber, revisionNumber+1.
    """
    result = await db.execute(
        select(Quotation).options(
            selectinload(Quotation.line_items),
            selectinload(Quotation.lead)
        ).where(
            Quotation.id == quotation_id, Quotation.is_deleted == False
        )
    )
    original = result.scalar_one_or_none()
    if not original:
        raise NotFoundError("Quotation")

    if original.status in ("Expired", "Customer Approved"):
        raise BusinessRuleError(
            f"Cannot revise a quotation with status '{original.status}'"
        )

    advance_pct = Decimal(str(payload.advance_percentage)) if payload.advance_percentage else original.advance_percentage
    other_charges = Decimal(str(payload.other_charges)) if payload.other_charges else original.other_charges

    totals = compute_quotation_totals(
        _map_line_inputs(payload.line_items),
        advance_pct,
        other_charges,
    )

    # Flip original to Expired
    original.status = "Expired"
    db.add(original)

    new_quotation = Quotation(
        quotation_number=original.quotation_number,
        revision_number=original.revision_number + 1,
        previous_quotation_id=original.id,
        revision_reason=payload.revision_reason,
        customer_name=original.customer_name,
        site=original.site,
        date=original.date,
        valid_until=original.valid_until,
        prepared_by=current_user.name,
        prepared_by_id=current_user.id,
        project_type=original.project_type,
        eb_number=original.eb_number,
        solar_panel=original.solar_panel,
        solar_inverter=original.solar_inverter,
        advance_percentage=advance_pct,
        other_charges=other_charges,
        payment_terms=original.payment_terms,
        installation_terms=original.installation_terms,
        warranty_terms=original.warranty_terms,
        notes=payload.notes or original.notes,
        lead_id=original.lead_id,
        customer_phone=original.customer_phone,
        created_by_ceo=original.created_by_ceo,
        subtotal=totals.subtotal,
        discount_total=totals.discount_total,
        tax_total=totals.tax_total,
        labour_total=totals.labour_total,
        grand_total=totals.grand_total,
        advance_amount=totals.advance_amount,
        balance_amount=totals.balance_amount,
        status="Quotation Created",
    )
    db.add(new_quotation)
    await db.flush()

    for idx, (item_schema, line_result) in enumerate(
        zip(payload.line_items, totals.line_results)
    ):
        line = QuotationLineItem(
            quotation_id=new_quotation.id,
            sort_order=item_schema.sort_order or idx,
            product=item_schema.product,
            brand=item_schema.brand,
            description=item_schema.description,
            quantity=item_schema.quantity,
            unit=item_schema.unit,
            unit_price=item_schema.unit_price,
            discount=item_schema.discount,
            gst_percent=item_schema.gst_percent,
            labour_charge=item_schema.labour_charge,
            line_base=line_result.line_base,
            line_discount_amount=line_result.line_discount_amount,
            line_tax_amount=line_result.line_tax_amount,
            line_total=line_result.line_total,
        )
        db.add(line)

    await db.flush()
    
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.QUOTATION_UPDATED, "Quotation", "Revise", new_quotation.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    
    await log_activity(
        db,
        actor=current_user.name,
        actor_id=current_user.id,
        department=current_user.department,
        action="Revised quotation",
        entity=new_quotation.quotation_number,
        entity_type="Quotation",
        entity_id=new_quotation.id,
        detail=f"Revision {new_quotation.revision_number}: {payload.revision_reason}"
    )
    
    return await _load_quotation(db, new_quotation.id)


async def list_quotations(
    db: AsyncSession,
    current_user: Employee,
    lead_id: Optional[str] = None,
    offset: int = 0,
    limit: int = 100,
) -> tuple[List[Quotation], int]:
    from app.models.lead import Lead
    from sqlalchemy import or_

    q = select(Quotation).options(
        selectinload(Quotation.line_items),
        selectinload(Quotation.lead)
    ).where(
        Quotation.is_deleted == False
    )

    if current_user.designation in ("Telecaller", "Direct Marketing Executive", "Document Follow-up Executive"):
        q = q.outerjoin(Lead, Quotation.lead_id == Lead.id)
        q = q.where(
            or_(
                Quotation.prepared_by_id == current_user.id,
                Lead.assigned_employee_id == current_user.id
            )
        )

    if lead_id:
        q = q.where(Quotation.lead_id == lead_id)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.order_by(Quotation.created_at.desc()).offset(offset).limit(limit))
    return result.scalars().all(), total

async def get_dashboard_quotations(
    db: AsyncSession,
    current_user: Employee,
    search: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    offset: int = 0,
    limit: int = 100,
) -> tuple[List[Quotation], int, dict]:
    from sqlalchemy import or_, and_, cast, Date
    from datetime import datetime
    from app.models.lead import Lead

    q = select(Quotation).options(
        selectinload(Quotation.line_items),
        selectinload(Quotation.lead)
    ).where(
        Quotation.is_deleted == False
    )

    base_q = select(Quotation).where(Quotation.is_deleted == False)

    if current_user.designation in ("Telecaller", "Direct Marketing Executive", "Document Follow-up Executive"):
        q = q.outerjoin(Lead, Quotation.lead_id == Lead.id)
        q = q.where(
            or_(
                Quotation.prepared_by_id == current_user.id,
                Lead.assigned_employee_id == current_user.id
            )
        )
        base_q = base_q.outerjoin(Lead, Quotation.lead_id == Lead.id)
        base_q = base_q.where(
            or_(
                Quotation.prepared_by_id == current_user.id,
                Lead.assigned_employee_id == current_user.id
            )
        )

    if search:
        search_filter = f"%{search}%"
        q = q.where(
            or_(
                Quotation.quotation_number.ilike(search_filter),
                Quotation.customer_name.ilike(search_filter),
                Quotation.customer_phone.ilike(search_filter)
            )
        )

    if status:
        q = q.where(Quotation.status == status)

    if from_date:
        try:
            fd = datetime.strptime(from_date, "%Y-%m-%d").date()
            q = q.where(cast(Quotation.created_at, Date) >= fd)
        except ValueError:
            pass

    if to_date:
        try:
            td = datetime.strptime(to_date, "%Y-%m-%d").date()
            q = q.where(cast(Quotation.created_at, Date) <= td)
        except ValueError:
            pass

    # For counts
    all_quotations = await db.execute(base_q)
    all_quotations_list = all_quotations.scalars().all()
    
    summary = {
        "total": len(all_quotations_list),
        "draft": sum(1 for q in all_quotations_list if q.status in ("Quotation Created", "Draft")),
        "sent": sum(1 for q in all_quotations_list if q.status == "Sent"),
        "customerApproved": sum(1 for q in all_quotations_list if q.status == "Customer Approved"),
        "customerRejected": sum(1 for q in all_quotations_list if q.status == "Customer Rejected"),
        "expired": sum(1 for q in all_quotations_list if q.status == "Expired"),
    }

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.order_by(Quotation.created_at.desc()).offset(offset).limit(limit))
    
    return result.scalars().all(), total, summary


async def get_quotation(db: AsyncSession, quotation_id: str) -> Quotation:
    result = await db.execute(
        select(Quotation).options(
            selectinload(Quotation.line_items),
            selectinload(Quotation.lead)
        ).where(
            Quotation.id == quotation_id, Quotation.is_deleted == False
        )
    )
    q = result.scalar_one_or_none()
    if not q:
        raise NotFoundError("Quotation")
    return q


async def update_quotation(
    db: AsyncSession, quotation_id: str, payload: QuotationCreate, current_user: Employee
) -> Quotation:
    result = await db.execute(
        select(Quotation).options(selectinload(Quotation.line_items)).where(
            Quotation.id == quotation_id, Quotation.is_deleted == False
        )
    )
    q = result.scalar_one_or_none()
    if not q:
        raise NotFoundError("Quotation")
    
    if q.status in ("Expired",):
        raise BusinessRuleError(f"Quotations with status '{q.status}' cannot be edited directly.")
    
    totals = compute_quotation_totals(
        _map_line_inputs(payload.line_items),
        Decimal(str(payload.advance_percentage)),
        Decimal(str(payload.other_charges)),
    )
    # Increment version upon editing only if it has already been sent to customer (or beyond)
    pre_sent_statuses = ("Quotation Created", "Draft", "Submitted")
    if q.status not in pre_sent_statuses:
        q.revision_number = (q.revision_number or 0) + 1
    
    q.customer_name = payload.customer_name
    q.site = payload.site
    q.date = payload.date
    q.valid_until = payload.valid_until
    q.prepared_by = current_user.name
    q.prepared_by_id = current_user.id
    q.project_type = payload.project_type
    q.eb_number = payload.eb_number
    q.solar_panel = payload.solar_panel
    q.solar_inverter = payload.solar_inverter
    q.advance_percentage = payload.advance_percentage
    q.other_charges = payload.other_charges
    q.payment_terms = payload.payment_terms
    q.installation_terms = payload.installation_terms
    q.warranty_terms = payload.warranty_terms
    q.notes = payload.notes
    q.lead_id = payload.lead_id
    q.customer_phone = payload.customer_phone
    
    q.subtotal = totals.subtotal
    q.discount_total = totals.discount_total
    q.tax_total = totals.tax_total
    q.labour_total = totals.labour_total
    q.grand_total = totals.grand_total
    q.advance_amount = totals.advance_amount
    q.balance_amount = totals.balance_amount
    
    q.line_items.clear()
    for idx, (item_schema, line_result) in enumerate(
        zip(payload.line_items, totals.line_results)
    ):
        line = QuotationLineItem(
            quotation_id=q.id,
            sort_order=item_schema.sort_order or idx,
            product=item_schema.product,
            brand=item_schema.brand,
            description=item_schema.description,
            quantity=item_schema.quantity,
            unit=item_schema.unit,
            unit_price=item_schema.unit_price,
            discount=item_schema.discount,
            gst_percent=item_schema.gst_percent,
            labour_charge=item_schema.labour_charge,
            line_base=line_result.line_base,
            line_discount_amount=line_result.line_discount_amount,
            line_tax_amount=line_result.line_tax_amount,
            line_total=line_result.line_total,
        )
        q.line_items.append(line)
        
    db.add(q)
    await db.flush()
    
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.QUOTATION_UPDATED, "Quotation", "Update", q.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    
    return await _load_quotation(db, q.id)


async def delete_quotation(db: AsyncSession, quotation_id: str) -> None:
    result = await db.execute(
        select(Quotation).where(
            Quotation.id == quotation_id, Quotation.is_deleted == False
        )
    )
    q = result.scalar_one_or_none()
    if not q:
        raise NotFoundError("Quotation")
    q.is_deleted = True
    db.add(q)
    await db.flush()
    
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.QUOTATION_UPDATED, "Quotation", "Delete", q.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])


