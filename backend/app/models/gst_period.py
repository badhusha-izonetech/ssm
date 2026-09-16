from __future__ import annotations
from typing import TYPE_CHECKING

from sqlalchemy import String, Boolean, Numeric, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin
from datetime import datetime

class GSTPeriod(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "gst_periods"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    period_month: Mapped[str] = mapped_column(String(7), nullable=False, unique=True, index=True) # e.g. '2026-09'
    
    total_invoices: Mapped[int] = mapped_column(default=0, nullable=False)
    taxable_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    gst_payable: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    invoice_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)

    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    paid_date: Mapped[datetime | None] = mapped_column(DateTime(), nullable=True)
    
    initial_reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    weekend_reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    def __repr__(self) -> str:
        return f"<GSTPeriod {self.period_month} Paid={self.is_paid}>"
