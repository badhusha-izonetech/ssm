from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class GSTPeriodBase(BaseModel):
    period_month: str
    total_invoices: int
    taxable_amount: float
    gst_payable: float
    invoice_total: float
    is_paid: bool
    paid_date: datetime | None = None

class GSTPeriodResponse(GSTPeriodBase):
    id: str
    class Config:
        from_attributes = True

class GSTSummary(BaseModel):
    label: str
    period_start: str
    period_end: str
    total_invoices: int
    taxable_amount: float
    gst_payable: float
    invoice_total: float

class InvoiceGSTEntry(BaseModel):
    id: str
    invoice_number: str
    customer_name: str
    issue_date: str
    taxable_amount: float
    gst_percent: float
    gst_amount: float
    grand_total: float
