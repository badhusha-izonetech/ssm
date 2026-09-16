"""
Project schemas.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, field_validator


class ProjectCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str
    customer_mobile: Optional[str] = None
    site: Optional[str] = None
    area: Optional[str] = None
    quotation_id: Optional[str] = None
    project_value: Decimal
    advance_received: Decimal = Decimal("0")
    capacity_kw: Optional[Decimal] = None
    assigned_technician_id: Optional[str] = None
    assigned_doc_employee_id: Optional[str] = None
    next_action: Optional[str] = None
    due_date: Optional[str] = None
    priority: str = "Medium"

    @field_validator("customer_id", "quotation_id", "assigned_technician_id", "assigned_doc_employee_id", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class ProjectUpdate(BaseModel):
    customer_name: Optional[str] = None
    site: Optional[str] = None
    area: Optional[str] = None
    next_action: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    eb_status: Optional[str] = None
    installation_status: Optional[str] = None


class ProjectStageUpdate(BaseModel):
    stage: str
    note: Optional[str] = None


class ProjectAssign(BaseModel):
    assigned_technician_id: Optional[str] = None
    additional_technician_ids: List[str] = []
    assigned_doc_employee_id: Optional[str] = None
    additional_doc_employee_ids: List[str] = []

    @field_validator("assigned_technician_id", "assigned_doc_employee_id", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class StageHistoryRead(BaseModel):
    id: str
    stage: str
    changed_at: datetime
    changed_by_id: Optional[str] = None
    note: Optional[str] = None

    model_config = {"from_attributes": True}


class ProjectAssignmentRead(BaseModel):
    id: str
    employee_id: str
    role: str
    assignment_type: str
    status: str
    assigned_by_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectUploadRead(BaseModel):
    id: str
    employee_id: str
    file_type: str
    file_url: str
    stage: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectPaymentBreakdown(BaseModel):
    total_amount: Decimal
    first_50_required: Decimal
    first_50_paid: Decimal
    first_50_pending: Decimal
    excess_advance_generated: Decimal
    verified_additional_advance: Decimal
    advance_adjusted: Decimal
    second_50_required: Decimal
    second_50_paid: Decimal
    second_50_pending: Decimal
    second_50_excess: Decimal
    total_verified_paid: Decimal
    final_outstanding: Decimal

    model_config = {"from_attributes": True}


class ProjectRead(BaseModel):
    id: str
    project_code: str
    customer_id: Optional[str] = None
    customer_name: str
    customer_mobile: Optional[str] = None
    site: Optional[str] = None
    area: Optional[str] = None
    quotation_id: Optional[str] = None
    project_value: Decimal
    advance_received: Decimal
    balance_amount: Decimal
    payment_breakdown: Optional[ProjectPaymentBreakdown] = None
    capacity_kw: Optional[Decimal] = None
    assigned_technician_id: Optional[str] = None
    assigned_doc_employee_id: Optional[str] = None
    current_stage: str
    status: str
    warehouse_status: str
    eb_status: str
    installation_status: str
    next_action: Optional[str] = None
    due_date: Optional[str] = None
    priority: str
    stage_history: List[StageHistoryRead] = []
    assignments: List[ProjectAssignmentRead] = []
    uploads: List[ProjectUploadRead] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
