"""
Dashboard service — all KPI and chart aggregations done in SQL.
Covers CEO overview, Marketing dashboard (scoped), and Reports.
"""

from __future__ import annotations

from decimal import Decimal
from typing import List

from sqlalchemy import select, func, case, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import is_telecaller_scoped
from app.models.approval import Approval
from app.models.employee import Employee
from app.models.field_movement import FieldMovement
from app.models.lead import Lead
from app.models.payment import Payment
from app.models.project import Project
from app.models.quotation import Quotation
from app.models.stock_item import StockItem
from app.schemas.dashboard import (
    CEODashboard,
    ChartPoint,
    MarketingDashboard,
    ReportSummary,
)


async def get_ceo_dashboard(db: AsyncSession) -> CEODashboard:
    # Pipeline value & outstanding
    proj_agg = await db.execute(
        select(
            func.sum(Project.project_value).label("pipeline"),
            func.sum(Project.balance_amount).label("outstanding"),
            func.count(Project.id).filter(Project.status != "Completed").label("active"),
            func.count(Project.id).filter(Project.status == "Delayed").label("delayed"),
            func.count(Project.id).filter(Project.status == "Issue Raised").label("issue"),
        ).where(Project.is_deleted == False)
    )
    p = proj_agg.one()

    # Lead conversion rate
    lead_agg = await db.execute(
        select(
            func.count(Lead.id).label("total"),
            func.count(Lead.id).filter(Lead.status == "Converted").label("converted"),
        ).where(Lead.is_deleted == False)
    )
    la = lead_agg.one()
    conversion_rate = (
        Decimal(str(la.converted)) / Decimal(str(la.total)) * 100
        if la.total else Decimal("0")
    )

    # Low stock
    stock_res = await db.execute(select(StockItem).where(StockItem.is_active == True))
    stock_items = stock_res.scalars().all()
    low_stock = sum(1 for s in stock_items if s.available_quantity <= s.minimum_level)

    # Pending approvals
    pa = (await db.execute(
        select(func.count(Approval.id)).where(Approval.status == "Pending")
    )).scalar_one()

    # This-month verified payments
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    vp = (await db.execute(
        select(func.sum(Payment.actual_amount)).where(
            Payment.state == "Verified",
            func.extract("month", Payment.verified_at) == now.month,
            func.extract("year", Payment.verified_at) == now.year,
        )
    )).scalar_one() or Decimal("0")

    # Active / on-field employees
    emp_agg = await db.execute(
        select(
            func.count(Employee.id).filter(Employee.employment_status == "Active").label("active"),
        ).where(Employee.is_deleted == False)
    )
    ea = emp_agg.one()

    on_field = (await db.execute(
        select(func.count(FieldMovement.id)).where(
            FieldMovement.status.in_(["Checked In", "On Field"])
        )
    )).scalar_one()

    # Projects by stage
    stage_res = await db.execute(
        select(Project.current_stage, func.count(Project.id).label("cnt"))
        .where(Project.is_deleted == False)
        .group_by(Project.current_stage)
    )
    projects_by_stage = [ChartPoint(label=r.current_stage, value=Decimal(r.cnt)) for r in stage_res]

    # Leads by source
    src_res = await db.execute(
        select(Lead.lead_source, func.count(Lead.id).label("cnt"))
        .where(Lead.is_deleted == False)
        .group_by(Lead.lead_source)
    )
    leads_by_source = [ChartPoint(label=r.lead_source, value=Decimal(r.cnt)) for r in src_res]
    
    # Attention lists
    attention_projects_res = await db.execute(
        select(Project).where(
            Project.is_deleted == False, 
            Project.status.in_(["Delayed", "Issue Raised"])
        ).order_by(Project.due_date).limit(5)
    )
    attention_projects = [
        {
            "id": p.id,
            "project_code": p.project_code,
            "customer_name": p.customer_name,
            "next_action": p.next_action,
            "due_date": p.due_date.isoformat() if p.due_date else None,
            "status": p.status
        } for p in attention_projects_res.scalars().all()
    ]
    
    attention_stock_items = [
        {
            "id": s.id,
            "product_name": s.product_name,
            "available_quantity": float(s.available_quantity),
            "minimum_level": float(s.minimum_level),
            "unit": s.unit
        } for s in stock_items if s.available_quantity <= s.minimum_level
    ]

    return CEODashboard(
        total_pipeline_value=Decimal(str(p.pipeline or 0)),
        outstanding_balance=Decimal(str(p.outstanding or 0)),
        active_project_count=p.active or 0,
        delayed_count=p.delayed or 0,
        issue_raised_count=p.issue or 0,
        lead_conversion_rate=conversion_rate.quantize(Decimal("0.01")),
        low_stock_count=low_stock,
        pending_approvals_count=pa or 0,
        this_month_verified_payments=Decimal(str(vp)),
        active_employee_count=ea.active or 0,
        on_field_count=on_field or 0,
        projects_by_stage=projects_by_stage,
        leads_by_source=leads_by_source,
        attention_projects=attention_projects,
        attention_stock_items=attention_stock_items,
    )


async def get_marketing_dashboard(
    db: AsyncSession, current_user: Employee
) -> MarketingDashboard:
    q = select(Lead).where(Lead.is_deleted == False)
    if is_telecaller_scoped(current_user.designation):
        q = q.where(Lead.assigned_employee_id == current_user.id)

    result = await db.execute(q)
    leads = result.scalars().all()

    new_count = sum(1 for l in leads if l.status == "New")
    follow_up = sum(1 for l in leads if l.status in (
        "Follow-up", "Site Visit Required", "Site Visit Scheduled", "Interested", "Contacted"
    ))
    converted = sum(1 for l in leads if l.status == "Converted")
    total = len(leads)
    rate = Decimal(str(converted)) / Decimal(str(total)) * 100 if total else Decimal("0")

    qt = (await db.execute(
        select(func.count(Quotation.id)).where(
            Quotation.prepared_by_id == current_user.id,
            Quotation.is_deleted == False,
        )
    )).scalar_one()

    recent = leads[-6:] if len(leads) >= 6 else leads
    recent_data = [
        {"id": l.id, "customer_name": l.customer_name, "status": l.status, "mobile": l.mobile}
        for l in reversed(recent)
    ]

    return MarketingDashboard(
        new_leads=new_count,
        follow_up_leads=follow_up,
        converted_leads=converted,
        conversion_rate=rate.quantize(Decimal("0.01")),
        own_quotation_count=qt or 0,
        recent_leads=recent_data,
    )


async def get_reports(db: AsyncSession) -> ReportSummary:
    # Project value by area
    area_res = await db.execute(
        select(Project.area, func.sum(Project.project_value).label("val"))
        .where(Project.is_deleted == False, Project.area != None)
        .group_by(Project.area)
    )
    by_area = [ChartPoint(label=r.area, value=Decimal(str(r.val or 0))) for r in area_res]

    # Payment total by state
    state_res = await db.execute(
        select(Payment.state, func.sum(Payment.actual_amount).label("val"))
        .group_by(Payment.state)
    )
    by_state = [ChartPoint(label=r.state, value=Decimal(str(r.val or 0))) for r in state_res]

    # Monthly verified collections
    monthly_res = await db.execute(
        select(
            func.to_char(Payment.verified_at, text("'YYYY-MM'")).label("month"),
            func.sum(Payment.actual_amount).label("val"),
        ).where(Payment.state == "Verified", Payment.verified_at != None)
        .group_by(text("month"))
        .order_by(text("month"))
    )
    monthly = [ChartPoint(label=r.month, value=Decimal(str(r.val or 0))) for r in monthly_res]

    won = (await db.execute(
        select(func.count(Lead.id)).where(Lead.status == "Converted", Lead.is_deleted == False)
    )).scalar_one()

    return ReportSummary(
        project_value_by_area=by_area,
        payment_total_by_state=by_state,
        monthly_verified_collections=monthly,
        won_lead_count=won or 0,
    )
