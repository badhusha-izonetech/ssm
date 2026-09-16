"""
Quotation schemas — server-computed totals, revision chain.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, field_validator


class LineItemCreate(BaseModel):
    product: str
    brand: Optional[str] = None
    description: Optional[str] = None
    quantity: float
    unit: str
    unit_price: float
    discount: float = 0.0
    gst_percent: float = 0.0
    labour_charge: float = 0.0
    sort_order: int = 0
    item_id: Optional[str] = None
    itemName: Optional[str] = None
    item_name: Optional[str] = None
    product_name: Optional[str] = None
    product_id: Optional[str] = None

    @field_validator("unit", "product", "brand", "description", mode="before")
    @classmethod
    def cast_to_str(cls, v):
        if v is not None and not isinstance(v, str):
            return str(v)
        return v


class LineItemRead(LineItemCreate):
    id: str
    line_base: Decimal
    line_discount_amount: Decimal
    line_tax_amount: Decimal
    line_total: Decimal

    model_config = {"from_attributes": True}


class QuotationCreate(BaseModel):
    customer_name: str
    site: Optional[str] = None
    date: str
    valid_until: Optional[str] = None
    project_type: Optional[str] = None
    eb_number: Optional[str] = None
    solar_panel: Optional[str] = None
    solar_inverter: Optional[str] = None
    advance_percentage: Decimal = Decimal("50")
    other_charges: Decimal = Decimal("0")
    payment_terms: Optional[str] = None
    installation_terms: Optional[str] = None
    warranty_terms: Optional[str] = None
    notes: Optional[str] = None
    lead_id: Optional[str] = None
    customer_phone: Optional[str] = None
    line_items: List[LineItemCreate]

    @field_validator("customer_phone", "eb_number", "customer_name", "site", "solar_panel", "solar_inverter", mode="before")
    @classmethod
    def cast_fields_to_str(cls, v):
        if v is not None and not isinstance(v, str):
            return str(v)
        return v

    @field_validator("lead_id", mode="before")
    @classmethod
    def empty_lead_id_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class QuotationRevise(BaseModel):
    revision_reason: str
    line_items: List[LineItemCreate]
    advance_percentage: Optional[Decimal] = None
    other_charges: Optional[Decimal] = None
    notes: Optional[str] = None


class QuotationStatusUpdate(BaseModel):
    status: str


class QuotationRead(BaseModel):
    id: str
    quotation_number: str
    revision_number: int
    previous_quotation_id: Optional[str] = None
    revision_reason: Optional[str] = None
    customer_name: str
    site: Optional[str] = None
    date: str
    valid_until: Optional[str] = None
    prepared_by: str
    prepared_by_id: Optional[str] = None
    project_type: Optional[str] = None
    eb_number: Optional[str] = None
    solar_panel: Optional[str] = None
    solar_inverter: Optional[str] = None
    status: str
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    labour_total: Decimal
    other_charges: Decimal
    grand_total: Decimal
    advance_percentage: Decimal
    advance_amount: Decimal
    balance_amount: Decimal
    payment_terms: Optional[str] = None
    installation_terms: Optional[str] = None
    warranty_terms: Optional[str] = None
    notes: Optional[str] = None
    lead_id: Optional[str] = None
    customer_phone: Optional[str] = None
    created_by_ceo: bool = False
    line_items: List[LineItemRead] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
