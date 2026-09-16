"""
Quotation model + QuotationLineItem.
Totals are always server-computed; revision chain is append-only.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.lead import Lead
    from app.models.project import Project

from decimal import Decimal

from sqlalchemy import String, Text, Boolean, Numeric, Integer, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin, SoftDeleteMixin


class Quotation(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "quotations"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    quotation_number: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    revision_number: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    previous_quotation_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.quotations.id", ondelete="SET NULL"),
        nullable=True,
    )
    revision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Header info ───────────────────────────────────────────────────────────
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    site: Mapped[str | None] = mapped_column(String(300), nullable=True)
    date: Mapped[str] = mapped_column(String(20), nullable=False)
    valid_until: Mapped[str | None] = mapped_column(String(20), nullable=True)
    prepared_by: Mapped[str] = mapped_column(String(200), nullable=False)
    prepared_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    customer_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    project_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    eb_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    solar_panel: Mapped[str | None] = mapped_column(String(300), nullable=True)
    solar_inverter: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # ── Status ────────────────────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        SAEnum(
            "Quotation Created", "Submitted", "Sent", "Customer Review",
            "Revision Required", "Customer Approved", "Customer Rejected",
            "Awaiting Advance", "Verified", "Expired",
            name="quotation_status_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        default="Quotation Created",
        nullable=False,
    )

    # ── Totals (server-computed) ───────────────────────────────────────────────
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    discount_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    tax_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    labour_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    other_charges: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    advance_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=50, nullable=False)
    advance_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    balance_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    # ── Terms ─────────────────────────────────────────────────────────────────
    payment_terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    installation_terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    warranty_terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Links ─────────────────────────────────────────────────────────────────
    lead_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.leads.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
    )
    created_by_ceo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    line_items: Mapped[list["QuotationLineItem"]] = relationship(
        "QuotationLineItem", back_populates="quotation", cascade="all, delete-orphan"
    )
    lead: Mapped["Lead | None"] = relationship("Lead", back_populates="quotations")  # noqa: F821
    previous_quotation: Mapped["Quotation | None"] = relationship(
        "Quotation", remote_side="Quotation.id", foreign_keys=[previous_quotation_id]
    )
    projects: Mapped[list["Project"]] = relationship("Project", back_populates="quotation")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Quotation {self.quotation_number} rev={self.revision_number}>"


class QuotationLineItem(UUIDMixin, Base):
    __tablename__ = "quotation_line_items"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    quotation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.quotations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    product: Mapped[str] = mapped_column(String(300), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    gst_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    labour_charge: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    # ── Computed per-line totals (stored for auditability) ────────────────────
    line_base: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    line_discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    line_tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    quotation: Mapped["Quotation"] = relationship("Quotation", back_populates="line_items")

    def __repr__(self) -> str:
        return f"<LineItem {self.product} qty={self.quantity}>"
