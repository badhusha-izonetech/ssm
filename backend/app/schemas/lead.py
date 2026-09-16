"""
Lead schemas.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class LeadBase(BaseModel):
    customer_name: str
    mobile: str
    alternate_mobile: Optional[str] = None
    email: Optional[str] = None
    customer_type: str
    address: Optional[str] = None
    area: Optional[str] = None
    city: Optional[str] = None
    lead_source: str
    source_reference: Optional[str] = None
    product_interested: Optional[str] = None
    requirement_description: Optional[str] = None
    approximate_requirement: Optional[str] = None
    priority: str = "Medium"
    assigned_employee_id: Optional[str] = None
    first_contact_date: Optional[str] = None
    payment_type: Optional[str] = None

    @field_validator("assigned_employee_id", "source_reference", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class LeadCreate(LeadBase):
    customer_origin: Optional[str] = "New Lead"
    prior_project_id: Optional[str] = None

    @field_validator("prior_project_id", mode="before")
    @classmethod
    def empty_prior_proj_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class ExistingCustomerLeadCreate(BaseModel):
    """For POST /leads/existing-customer — ExistingCustomerLeadModal.tsx flow."""
    customer_id: str
    prior_project_id: Optional[str] = None
    product_interested: Optional[str] = None
    requirement_description: Optional[str] = None
    approximate_requirement: Optional[str] = None
    priority: str = "Medium"
    assigned_employee_id: Optional[str] = None
    lead_source: str = "Previous Customer"

    @field_validator("prior_project_id", mode="before")
    @classmethod
    def empty_prior_proj_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("assigned_employee_id", mode="before")
    @classmethod
    def empty_assigned_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class LeadUpdate(BaseModel):
    customer_name: Optional[str] = None
    mobile: Optional[str] = None
    alternate_mobile: Optional[str] = None
    email: Optional[str] = None
    area: Optional[str] = None
    city: Optional[str] = None
    priority: Optional[str] = None
    assigned_employee_id: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator("assigned_employee_id", mode="before")
    @classmethod
    def empty_assigned_emp_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class LeadStatusUpdate(BaseModel):
    """For PATCH /leads/{id}/status"""
    status: str
    lost_reason: Optional[str] = None
    lost_reason_detail: Optional[str] = None
    remarks: Optional[str] = None


class LeadReassign(BaseModel):
    """For PATCH /leads/{id}/reassign"""
    assigned_employee_id: str


class LeadRead(LeadBase):
    id: str
    status: str
    lost_reason: Optional[str] = None
    lost_reason_detail: Optional[str] = None
    remarks: Optional[str] = None
    customer_origin: Optional[str] = None
    prior_project_id: Optional[str] = None
    customer_id: Optional[str] = None
    created_by_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
