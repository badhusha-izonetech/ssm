"""
Remaining schemas: Notification, LeaveRequest, PerformanceRecord, Approval, ActivityLog, Dashboard.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, computed_field


# ── Notification ──────────────────────────────────────────────────────────────
class NotificationRead(BaseModel):
    id: str
    title: str
    message: str
    department: Optional[str] = None
    recipient_id: Optional[str] = None
    timestamp: datetime
    is_read: bool
    priority: str
    category: str

    @computed_field
    @property
    def read(self) -> bool:
        return self.is_read

    model_config = {"from_attributes": True}


# ── LeaveRequest ──────────────────────────────────────────────────────────────
class LeaveCreate(BaseModel):
    leave_type: str
    from_date: str
    to_date: str
    reason: str


class LeaveDecision(BaseModel):
    remarks: Optional[str] = None  # frontend sends 'remarks', mapped to ceo_remarks
    ceo_remarks: Optional[str] = None

    def get_remarks(self) -> Optional[str]:
        return self.ceo_remarks or self.remarks


class LeaveRead(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    leave_type: str
    from_date: str
    to_date: str
    reason: str
    status: str
    applied_on: str
    ceo_remarks: Optional[str] = None
    approval_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── PerformanceRecord ─────────────────────────────────────────────────────────
class PerformanceCreate(BaseModel):
    employee_id: str
    period: str
    score: Decimal
    completed_work: int
    pending_work: int
    efficiency: Decimal
    remarks: Optional[str] = None


class PerformanceRead(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    department: str
    role: str
    period: str
    score: Decimal
    rank: Optional[int] = None
    completed_work: int
    pending_work: int
    efficiency: Decimal
    remarks: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Approval ──────────────────────────────────────────────────────────────────
class ApprovalCreate(BaseModel):
    approval_type: str
    summary: str
    priority: str = "Medium"
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None


class ApprovalDecision(BaseModel):
    rejection_reason: Optional[str] = None


class ApprovalRead(BaseModel):
    id: str
    approval_type: str
    requested_by: str
    requested_by_id: Optional[str] = None
    department: Optional[str] = None
    summary: str
    raised_on: datetime
    status: str
    priority: str
    approved_by_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── ActivityLog ───────────────────────────────────────────────────────────────
class ActivityLogRead(BaseModel):
    id: str
    timestamp: datetime
    actor: str
    actor_employee_id: Optional[str] = None
    department: Optional[str] = None
    action: str
    entity: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    detail: Optional[str] = None

    model_config = {"from_attributes": True}
