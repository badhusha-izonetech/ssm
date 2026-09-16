from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, field_validator

from app.schemas.common import UUIDSchema, TimestampSchema

class InvoiceBase(BaseModel):
    quotation_id: str | None = None
    quotation_number: str | None = None
    customer_name: str | None = None
    site: str | None = None
    project_type: str | None = None
    invoice_number: str | None = None
    issue_date: str | None = None
    due_date: str | None = None
    billing_address: str | None = None
    notes: str | None = None
    payment_terms: str | None = None
    installation_terms: str | None = None
    terms_and_conditions: str | None = None
    taxable_amount: Decimal = Field(default=0, max_digits=12, decimal_places=2)
    gst_percent: Decimal = Field(default=0, max_digits=5, decimal_places=2)
    gst_amount: Decimal = Field(default=0, max_digits=12, decimal_places=2)
    advance_amount: Decimal = Field(default=0, max_digits=12, decimal_places=2)
    balance_amount: Decimal = Field(default=0, max_digits=12, decimal_places=2)
    grand_total: Decimal = Field(default=0, max_digits=12, decimal_places=2)
    status: str = "Generated"

    @field_validator("quotation_id", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

class InvoiceCreate(InvoiceBase):
    pass

class InvoiceUpdate(BaseModel):
    issue_date: str | None = None
    due_date: str | None = None
    billing_address: str | None = None
    notes: str | None = None
    payment_terms: str | None = None
    installation_terms: str | None = None
    terms_and_conditions: str | None = None
    gst_percent: Decimal | None = None
    gst_amount: Decimal | None = None

class InvoiceResponse(InvoiceBase, UUIDSchema, TimestampSchema):
    class Config:
        from_attributes = True

class InvoiceSyncRequest(BaseModel):
    invoices: list[InvoiceCreate]
