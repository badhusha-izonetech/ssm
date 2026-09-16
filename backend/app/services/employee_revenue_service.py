from typing import List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_

from app.models.employee_revenue import EmployeeRevenue
from app.models.invoice import Invoice
from app.models.project import Project
from app.models.project_assignment import ProjectAssignment
from app.models.quotation import Quotation
from app.models.lead import Lead
from app.models.employee import Employee
from app.schemas.employee_revenue import EmployeeRevenueSummaryItem, EmployeeRevenueDetail, EmployeeRevenueProjectDetail

async def generate_revenue_for_invoice(db: AsyncSession, invoice_id: str):
    pass

async def get_employee_revenue_summary(
    db: AsyncSession,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
) -> List[EmployeeRevenueSummaryItem]:
    
    employees = await db.scalars(select(Employee).where(Employee.employment_status == "Active"))
    employees = list(employees)
    
    summary = []
    
    for emp in employees:
        total_rev = 0.0
        
        # 1. Base Revenue from EmployeeRevenue table (Marketing, Site Visit, Quotation prep)
        rev_query = select(func.sum(EmployeeRevenue.revenue)).join(Quotation).where(
            EmployeeRevenue.employee_id == emp.id,
            Quotation.status != "Expired"
        )
        if date_from: rev_query = rev_query.where(EmployeeRevenue.revenue_date >= date_from)
        if date_to: rev_query = rev_query.where(EmployeeRevenue.revenue_date <= date_to)
        base_rev = await db.scalar(rev_query)
        total_rev += float(base_rev or 0)
        
        # 2. Project Revenue for Project Head, Field Tech, Doc Follow-up
        if emp.designation in ["Project Head", "Field Technician", "Document Follow-up Executive"]:
            proj_query = select(func.sum(Project.project_value)).where(Project.is_deleted == False)
            
            if date_from:
                d_from = datetime.strptime(date_from, "%Y-%m-%d").date()
                proj_query = proj_query.where(func.date(Project.created_at) >= d_from)
            if date_to:
                d_to = datetime.strptime(date_to, "%Y-%m-%d").date()
                proj_query = proj_query.where(func.date(Project.created_at) <= d_to)
            
            if emp.designation == "Project Head":
                pass # Project Head gets all active project revenue
            elif emp.designation == "Field Technician":
                # Find projects where they are assigned directly or via assignments table
                assigned_proj_ids = await db.scalars(
                    select(ProjectAssignment.project_id).where(ProjectAssignment.employee_id == emp.id)
                )
                proj_query = proj_query.where(or_(
                    Project.assigned_technician_id == emp.id,
                    Project.id.in_(list(assigned_proj_ids))
                ))
            elif emp.designation == "Document Follow-up Executive":
                assigned_proj_ids = await db.scalars(
                    select(ProjectAssignment.project_id).where(ProjectAssignment.employee_id == emp.id)
                )
                proj_query = proj_query.where(or_(
                    Project.assigned_doc_employee_id == emp.id,
                    Project.id.in_(list(assigned_proj_ids))
                ))
                
            proj_rev = await db.scalar(proj_query)
            total_rev += float(proj_rev or 0)
            
        summary.append(EmployeeRevenueSummaryItem(
            employee_id=emp.id,
            employee_name=emp.name,
            department=emp.department,
            designation=emp.designation,
            total_revenue=total_rev
        ))
        
    # Filter out 0 revenue to match previous behavior, or just return all
    return summary

async def get_employee_revenue_details(
    db: AsyncSession,
    employee_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
) -> Optional[EmployeeRevenueDetail]:
    
    emp = await db.get(Employee, employee_id)
    if not emp: return None
        
    project_details = []
    
    # 1. Base Revenue
    query = select(EmployeeRevenue).join(Quotation).where(
        EmployeeRevenue.employee_id == employee_id,
        Quotation.status != "Expired"
    )
    if date_from: query = query.where(EmployeeRevenue.revenue_date >= date_from)
    if date_to: query = query.where(EmployeeRevenue.revenue_date <= date_to)
        
    records = await db.scalars(query)
    for r in records:
        quot = await db.get(Quotation, r.quotation_id)
        proj = await db.scalar(select(Project).where(Project.quotation_id == r.quotation_id))
        if quot:
            project_details.append(EmployeeRevenueProjectDetail(
                project_id=proj.id if proj else "",
                project_name=proj.customer_name if proj else quot.customer_name,
                invoice_id=r.quotation_id,
                invoice_number=quot.quotation_number,
                invoice_date=r.revenue_date,
                revenue=float(r.revenue)
            ))
            
    # 2. Project Revenue
    if emp.designation in ["Project Head", "Field Technician", "Document Follow-up Executive"]:
        proj_query = select(Project).where(Project.is_deleted == False)
        if date_from:
            d_from = datetime.strptime(date_from, "%Y-%m-%d").date()
            proj_query = proj_query.where(func.date(Project.created_at) >= d_from)
        if date_to:
            d_to = datetime.strptime(date_to, "%Y-%m-%d").date()
            proj_query = proj_query.where(func.date(Project.created_at) <= d_to)
        
        if emp.designation == "Project Head":
            pass
        elif emp.designation == "Field Technician":
            assigned_proj_ids = await db.scalars(select(ProjectAssignment.project_id).where(ProjectAssignment.employee_id == emp.id))
            proj_query = proj_query.where(or_(Project.assigned_technician_id == emp.id, Project.id.in_(list(assigned_proj_ids))))
        elif emp.designation == "Document Follow-up Executive":
            assigned_proj_ids = await db.scalars(select(ProjectAssignment.project_id).where(ProjectAssignment.employee_id == emp.id))
            proj_query = proj_query.where(or_(Project.assigned_doc_employee_id == emp.id, Project.id.in_(list(assigned_proj_ids))))
            
        projs = await db.scalars(proj_query)
        for p in projs:
            # Avoid duplicate if it was already added via EmployeeRevenue (rare, but possible)
            if not any(pd.project_id == p.id for pd in project_details):
                project_details.append(EmployeeRevenueProjectDetail(
                    project_id=p.id,
                    project_name=p.customer_name,
                    invoice_id=p.id,
                    invoice_number=p.project_code,
                    invoice_date=p.created_at.strftime("%Y-%m-%d"),
                    revenue=float(p.project_value)
                ))
                
    total_rev = sum(pd.revenue for pd in project_details)
    
    return EmployeeRevenueDetail(
        employee_id=emp.id,
        employee_name=emp.name,
        department=emp.department,
        designation=emp.designation,
        total_revenue=total_rev,
        projects=project_details
    )
