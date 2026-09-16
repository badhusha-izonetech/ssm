"""
Lead model — central sales pipeline entity.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.call_log import CallLogEntry
    from app.models.quotation import Quotation
    from app.models.project import Project

from sqlalchemy import String, Text, Boolean, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin, SoftDeleteMixin


class Lead(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "leads"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    # ── Contact info ──────────────────────────────────────────────────────────
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    mobile: Mapped[str] = mapped_column(String(20), nullable=False)
    alternate_mobile: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)

    customer_type: Mapped[str] = mapped_column(
        SAEnum(
            "Residential", "Commercial", "Industrial",
            name="lead_customer_type_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        nullable=False,
    )

    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    area: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ── Lead metadata ─────────────────────────────────────────────────────────
    lead_source: Mapped[str] = mapped_column(
        SAEnum(
            "Previous Customer", "Tele Calling", "Inquiry Call", "Walk-in",
            "Justdial", "IndiaMART", "Google Search", "BNI",
            "Direct Field Visit", "Other", "Referral", "New Construction", "Commercial Building",
            name="lead_source_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        nullable=False,
    )
    source_reference: Mapped[str | None] = mapped_column(String(300), nullable=True)
    product_interested: Mapped[str | None] = mapped_column(String(200), nullable=True)
    requirement_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    approximate_requirement: Mapped[str | None] = mapped_column(String(100), nullable=True)

    priority: Mapped[str] = mapped_column(
        SAEnum("Low", "Medium", "High", name="lead_priority_enum", schema=settings.POSTGRES_SCHEMA),
        default="Medium",
        nullable=False,
    )

    payment_type: Mapped[str] = mapped_column(
        SAEnum("Loan", "Own Payment", name="lead_payment_type_enum", schema=settings.POSTGRES_SCHEMA),
        nullable=True,
    )

    # ── Assignment ────────────────────────────────────────────────────────────
    assigned_employee_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )

    first_contact_date: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # ── Status ────────────────────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        SAEnum(
            "New", "Pending CEO Assignment", "Contacted", "Interested", "Follow-up",
            "Site Visit Required", "Site Visit Scheduled",
            "Quotation Stage", "Lost", "Converted", "Not Interested",
            name="lead_status_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        default="New",
        nullable=False,
    )

    lost_reason: Mapped[str | None] = mapped_column(
        SAEnum(
            "Price", "Product Unavailable", "Company Cannot Provide Requirement",
            "Customer Postponed", "Competitor", "Not Interested",
            "Technical Infeasibility", "Other",
            name="lead_lost_reason_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        nullable=True,
    )
    lost_reason_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Existing customer flow ────────────────────────────────────────────────
    customer_origin: Mapped[str | None] = mapped_column(
        SAEnum(
            "New Lead", "Existing Customer",
            name="customer_origin_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        default="New Lead",
        nullable=True,
    )
    prior_project_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.projects.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
    )

    # FK to Customer once converted
    customer_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.customers.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    assigned_employee: Mapped["Employee | None"] = relationship(  # noqa: F821
        "Employee", foreign_keys=[assigned_employee_id], back_populates="leads_assigned"
    )
    created_by: Mapped["Employee | None"] = relationship(  # noqa: F821
        "Employee", foreign_keys=[created_by_id], back_populates="leads_created"
    )
    call_logs: Mapped[list["CallLogEntry"]] = relationship(  # noqa: F821
        "CallLogEntry", back_populates="lead", cascade="all, delete-orphan"
    )
    quotations: Mapped[list["Quotation"]] = relationship(  # noqa: F821
        "Quotation", back_populates="lead"
    )
    prior_project: Mapped["Project | None"] = relationship(  # noqa: F821
        "Project", foreign_keys=[prior_project_id]
    )

    def __repr__(self) -> str:
        return f"<Lead {self.customer_name} [{self.status}]>"
