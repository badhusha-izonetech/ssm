"""
Payment schemas.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, field_validator


class PaymentCreate(BaseModel):
    project_id: Optional[str] = None
    customer_name: str
    quotation_id: Optional[str] = None
    expected_amount: Decimal
    actual_amount: Optional[Decimal] = None
    payment_type: str
    payment_date: Optional[str] = None
    payment_mode: Optional[str] = None
    transaction_reference: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator("project_id", "quotation_id", "transaction_reference", "remarks", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class PaymentUpdate(BaseModel):
    project_id: Optional[str] = None
    customer_name: Optional[str] = None
    quotation_id: Optional[str] = None
    expected_amount: Optional[Decimal] = None
    actual_amount: Optional[Decimal] = None
    payment_type: Optional[str] = None
    payment_date: Optional[str] = None
    payment_mode: Optional[str] = None
    transaction_reference: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator("project_id", "quotation_id", "transaction_reference", "remarks", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class PaymentVerify(BaseModel):
    actual_amount: Decimal
    payment_mode: str
    transaction_reference: Optional[str] = None
    remarks: Optional[str] = None
    customer_name: Optional[str] = None
    project_id: Optional[str] = None
    quotation_id: Optional[str] = None
    payment_type: Optional[str] = None

    @field_validator("project_id", "quotation_id", "transaction_reference", "remarks", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class PaymentReject(BaseModel):
    remarks: str  # required on rejection


class ProofRead(BaseModel):
    id: str
    file_url: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class PaymentRead(BaseModel):
    id: str
    project_id: Optional[str] = None
    customer_name: str
    quotation_id: Optional[str] = None
    expected_amount: Decimal
    actual_amount: Optional[Decimal] = None
    payment_type: str
    payment_date: Optional[str] = None
    payment_mode: Optional[str] = None
    transaction_reference: Optional[str] = None
    state: str
    submitted_by: Optional[str] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    remarks: Optional[str] = None
    proofs: List[ProofRead] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
