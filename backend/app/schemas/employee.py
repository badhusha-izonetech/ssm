"""
Employee schemas.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


class EmployeeBase(BaseModel):
    employee_code: str
    name: str
    mobile: str
    email: Optional[str] = None
    joining_date: str
    department: str
    designation: str
    username: str
    employment_status: str = "Active"
    avatar_color: Optional[str] = None
    location: Optional[str] = None
    family_number: Optional[str] = None
    office_number: Optional[str] = None
    document_1: Optional[str] = None
    document_2: Optional[str] = None
    document_3: Optional[str] = None

    @field_validator("mobile", "family_number", "office_number", mode="after")
    @classmethod
    def validate_phone_numbers(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        if not v.isdigit():
            raise ValueError("Phone numbers must contain only digits")
        if len(v) > 10:
            raise ValueError("Phone numbers must not exceed 10 digits")
        return v


class EmployeeCreate(EmployeeBase):
    password: str


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    username: Optional[str] = None
    employment_status: Optional[str] = None
    avatar_color: Optional[str] = None
    location: Optional[str] = None
    family_number: Optional[str] = None
    office_number: Optional[str] = None
    document_1: Optional[str] = None
    document_2: Optional[str] = None
    document_3: Optional[str] = None
    password: Optional[str] = None


class EmployeeRead(EmployeeBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EmployeeListItem(BaseModel):
    id: str
    employee_code: str
    name: str
    department: str
    designation: str
    employment_status: str
    mobile: str
    email: Optional[str] = None
    avatar_color: Optional[str] = None
    location: Optional[str] = None
    family_number: Optional[str] = None
    office_number: Optional[str] = None
    document_1: Optional[str] = None
    document_2: Optional[str] = None
    document_3: Optional[str] = None

    model_config = {"from_attributes": True}
