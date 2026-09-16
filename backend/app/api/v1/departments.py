"""
Departments router.
"""

import json
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import Permission, require_permissions
from app.core.security import get_current_user
from app.models.department import Department
from app.models.employee import Employee
from app.schemas.department import DepartmentRead, DepartmentWithStaff
from app.schemas.employee import EmployeeListItem

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.get("", response_model=List[DepartmentWithStaff])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.DEPARTMENTS_READ)),
):
    dept_result = await db.execute(select(Department))
    depts = dept_result.scalars().all()

    emp_result = await db.execute(
        select(Employee).where(Employee.is_deleted == False, Employee.employment_status == "Active")
    )
    employees = emp_result.scalars().all()
    emp_by_dept: dict[str, list] = {}
    for e in employees:
        emp_by_dept.setdefault(e.department, []).append(e)

    output = []
    for d in depts:
        teams = json.loads(d.teams_json) if d.teams_json else []
        staff = emp_by_dept.get(d.name, [])
        output.append(DepartmentWithStaff(
            id=d.id,
            name=d.name,
            teams=teams,
            staff_count=len(staff),
            staff=[EmployeeListItem.model_validate(e) for e in staff],
        ))
    return output
