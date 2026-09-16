"""
Employee service — CEO-only CRUD with employment-status transitions.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import hash_password
from app.models.employee import Employee
from app.schemas.employee import EmployeeCreate, EmployeeUpdate
from fastapi import UploadFile
from app.utils.file_upload import save_employee_document


async def create_employee(db: AsyncSession, payload: EmployeeCreate) -> Employee:
    from sqlalchemy.exc import IntegrityError
    
    # Check unique constraints (including soft-deleted records since DB constraint applies to all)
    existing = await db.execute(
        select(Employee).where(
            (Employee.username == payload.username) | (Employee.employee_code == payload.employee_code)
        )
    )
    if existing.scalars().first():
        raise ConflictError("Username or employee code already exists", field="username")

    employee = Employee(
        **payload.model_dump(exclude={"password"}),
        hashed_password=hash_password(payload.password),
    )
    db.add(employee)
    
    try:
        await db.flush()
    except IntegrityError:
        raise ConflictError("Username or employee code already exists", field="username")
        
    return employee


async def get_employee(db: AsyncSession, employee_id: str) -> Employee:
    result = await db.execute(
        select(Employee).where(Employee.id == employee_id, Employee.is_deleted == False)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise NotFoundError("Employee")
    return emp


async def list_employees(
    db: AsyncSession,
    department: Optional[str] = None,
    offset: int = 0,
    limit: int = 100,
) -> tuple[List[Employee], int]:
    q = select(Employee).where(Employee.is_deleted == False)
    if department:
        q = q.where(Employee.department == department)

    total_res = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_res.scalar_one()

    result = await db.execute(q.offset(offset).limit(limit))
    return result.scalars().all(), total


async def update_employee(
    db: AsyncSession, employee_id: str, payload: EmployeeUpdate
) -> Employee:
    emp = await get_employee(db, employee_id)
    update_data = payload.model_dump(exclude_none=True)
    if "password" in update_data:
        emp.hashed_password = hash_password(update_data.pop("password"))
    for key, val in update_data.items():
        setattr(emp, key, val)
    db.add(emp)
    return emp


async def upload_employee_document(db: AsyncSession, employee_id: str, document_type: str, file: UploadFile) -> Employee:
    emp = await get_employee(db, employee_id)
    file_url = await save_employee_document(file)
    if document_type == "document_1":
        emp.document_1 = file_url
    elif document_type == "document_2":
        emp.document_2 = file_url
    elif document_type == "document_3":
        emp.document_3 = file_url
    else:
        from app.core.exceptions import BusinessRuleError
        raise BusinessRuleError(f"Invalid document type: {document_type}")
    db.add(emp)
    await db.flush()
    return emp


async def delete_employee(db: AsyncSession, employee_id: str) -> None:
    import uuid
    emp = await get_employee(db, employee_id)
    
    # Soft delete the employee to preserve foreign key relationships (audit trail)
    emp.is_deleted = True
    emp.employment_status = "Relieved"
    
    # Append a unique suffix so the original username/code can be reused immediately
    suffix = f"_del_{uuid.uuid4().hex[:8]}"
    emp.username = (emp.username[:85] + suffix)
    if emp.employee_code:
        emp.employee_code = (emp.employee_code[:35] + suffix)
        
    db.add(emp)
