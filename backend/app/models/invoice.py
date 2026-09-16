from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.quotation import Quotation
    from app.models.customer import Customer
    from app.models.project import Project

from decimal import Decimal

from sqlalchemy import String, Text, Numeric, Enum as SAEnum, ForeignKey, DateTime, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin, SoftDeleteMixin

class Invoice(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "invoices"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    quotation_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.quotations.id", ondelete="SET NULL"),
        nullable=True,
    )
    
    invoice_number: Mapped[str] = mapped_column(String(30), nullable=False, unique=True, index=True)
    quotation_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    site: Mapped[str | None] = mapped_column(String(200), nullable=True)
    project_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    issue_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    due_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    
    billing_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    installation_terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    terms_and_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Financials (copied/computed from quotation or updated manually)
    taxable_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    gst_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    gst_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    advance_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    balance_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    
    status: Mapped[str] = mapped_column(
        SAEnum(
            "Draft", "Generated", "Cancelled",
            name="invoice_status_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        default="Generated",
        nullable=False,
    )
    
    # Optional relationships if needed to fetch related customer/project quickly
    quotation: Mapped["Quotation | None"] = relationship("Quotation")

    def __repr__(self) -> str:
        return f"<Invoice {self.invoice_number}>"
