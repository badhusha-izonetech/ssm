"""
Customer service — derived existing-customer view.
"""

from __future__ import annotations

from typing import List

from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.customer import Customer
from app.models.project import Project
from app.models.lead import Lead
from app.models.employee import Employee
from app.schemas.customer import CustomerCreate, CustomerUpdate, ExistingCustomerView, GlobalCustomerView


async def list_global_customers(db: AsyncSession, current_user, offset: int = 0, limit: int = 100):
    from sqlalchemy import or_, outerjoin
    from app.core.permissions import Designation, is_telecaller_scoped
    # We want ALL leads that are in workflow
    q = select(Lead, Employee.name, Project.project_code, Project.current_stage).select_from(
        Lead
    ).outerjoin(
        Employee, Employee.id == Lead.assigned_employee_id
    ).outerjoin(
        Project, Project.customer_id == Lead.customer_id
    ).where(
        Lead.is_deleted == False,
        or_(
            Lead.assigned_employee_id != None,
            Lead.status != 'New',
            Lead.status != 'Pending CEO Assignment'
        )
    )
    
    # Role-based visibility scoping
    user_id = current_user.id
    desig = current_user.designation

    if desig == Designation.CEO:
        pass # CEO sees all
    elif desig == Designation.DOC_FOLLOWUP:
        # Doc follow up sees leads they created or projects assigned to them
        q = q.where(or_(Lead.created_by_id == user_id, Project.assigned_doc_employee_id == user_id))
    elif desig == Designation.FIELD_TECHNICIAN:
        # Technicians see only projects assigned to them
        q = q.where(Project.assigned_technician_id == user_id)
    elif desig in [Designation.PROJECT_HEAD, Designation.ACCOUNTANT, Designation.WAREHOUSE, Designation.DRIVER, Designation.PARTNER]:
        # These roles see all customers who have reached the Project workflow (Converted)
        q = q.where(Project.id != None)
    else:
        # Marketing, Telecaller, Site Visitor, etc. see leads assigned to them or created by them
        q = q.where(or_(Lead.assigned_employee_id == user_id, Lead.created_by_id == user_id))
    
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.order_by(Lead.created_at.desc()).offset(offset).limit(limit))
    rows = result.all()
    
    items = []
    for lead, emp_name, proj_code, proj_stage in rows:
        items.append({
            "id": lead.id,
            "customer_name": lead.customer_name,
            "mobile": lead.mobile,
            "address": lead.address,
            "area": lead.area,
            "city": lead.city,
            "customer_type": lead.customer_type,
            "lead_source": lead.lead_source,
            "product_interested": lead.product_interested,
            "payment_type": lead.payment_type,
            "lead_status": lead.status,
            "assigned_employee_name": emp_name,
            "project_code": proj_code,
            "project_stage": proj_stage,
            "created_at": lead.created_at
        })
    return items, total


async def get_existing_customers(db: AsyncSession) -> List[ExistingCustomerView]:
    """
    Returns customers who have at least one Project at currentStage='Completed'.
    Shape matches ExistingCustomer interface in frontend (marketing screen).
    """
    result = await db.execute(
        select(Customer, Project).join(
            Project, Project.customer_id == Customer.id
        ).where(
            Customer.is_deleted == False,
            Project.current_stage == "Completed",
            Project.is_deleted == False,
        ).order_by(Project.updated_at.desc())
    )
    rows = result.all()

    seen = set()
    items = []
    for customer, project in rows:
        if customer.id in seen:
            continue
        seen.add(customer.id)
        items.append(ExistingCustomerView(
            customer_id=customer.id,
            customer_name=customer.name,
            mobile=customer.mobile,
            area=customer.area,
            site=project.site,
            completed_project_id=project.id,
            completed_project_code=project.project_code,
            completed_on=str(project.updated_at.date()) if project.updated_at else None,
            total_value=project.project_value,
            capacity_kw=project.capacity_kw,
        ))
    return items


async def update_customer(db: AsyncSession, customer_id: str, payload: CustomerUpdate) -> Customer:
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.is_deleted == False)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise NotFoundError("Customer")
    for key, val in payload.model_dump(exclude_none=True).items():
        setattr(customer, key, val)
    db.add(customer)
    return customer
