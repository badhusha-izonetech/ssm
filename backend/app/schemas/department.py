"""
Department schemas.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, List

from pydantic import BaseModel

if TYPE_CHECKING:
    from app.schemas.employee import EmployeeListItem


class DepartmentBase(BaseModel):
    name: str
    teams: List[str] = []


class DepartmentRead(DepartmentBase):
    id: str
    staff_count: int = 0

    model_config = {"from_attributes": True}


class DepartmentWithStaff(DepartmentRead):
    staff: List["EmployeeListItem"] = []

    model_config = {"from_attributes": True}


# Resolve forward refs
from app.schemas.employee import EmployeeListItem  # noqa: E402
DepartmentWithStaff.model_rebuild()

