"""
Project model + ProjectStageHistory.
Stage transitions are gated by payment and stock status.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.quotation import Quotation
    from app.models.payment import Payment
    from app.models.project_assignment import ProjectAssignment
    from app.models.project_upload import ProjectUpload

from decimal import Decimal

from sqlalchemy import String, Text, Numeric, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin, SoftDeleteMixin
from datetime import datetime, timezone


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Project(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "projects"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    project_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)

    customer_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.customers.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
    )
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_mobile: Mapped[str | None] = mapped_column(String(20), nullable=True)
    site: Mapped[str | None] = mapped_column(String(300), nullable=True)
    area: Mapped[str | None] = mapped_column(String(200), nullable=True)

    quotation_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.quotations.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
    )

    project_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    advance_received: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    balance_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    capacity_kw: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)

    # ── Assignment ────────────────────────────────────────────────────────────
    assigned_technician_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    assigned_doc_employee_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Stage & Status ────────────────────────────────────────────────────────
    current_stage: Mapped[str] = mapped_column(
        SAEnum(
            "Site Visit", "Quotation", "Awaiting Advance Payment", "Advance Payment",
            "Project Execution", "Installation", "Final Connection", "Completed",
            name="project_stage_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        default="Site Visit",
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        SAEnum(
            "On Track", "Delayed", "On Hold", "Completed", "Issue Raised",
            name="project_status_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        default="On Track",
        nullable=False,
    )

    warehouse_status: Mapped[str] = mapped_column(
        SAEnum(
            "Not Requested", "Requested", "Reserved", "Issued",
            name="warehouse_status_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        default="Not Requested",
        nullable=False,
    )
    eb_status: Mapped[str] = mapped_column(
        SAEnum(
            "Not Started", "Application Submitted", "Meter Installed", "Connected",
            name="eb_status_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        default="Not Started",
        nullable=False,
    )
    installation_status: Mapped[str] = mapped_column(
        SAEnum(
            "Not Started", "In Progress", "Completed",
            name="installation_status_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        default="Not Started",
        nullable=False,
    )

    next_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    priority: Mapped[str] = mapped_column(
        SAEnum("Low", "Medium", "High", name="project_priority_enum", schema=settings.POSTGRES_SCHEMA),
        default="Medium",
        nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    customer: Mapped["Customer | None"] = relationship("Customer", back_populates="projects")  # noqa: F821
    quotation: Mapped["Quotation | None"] = relationship("Quotation", back_populates="projects")
    stage_history: Mapped[list["ProjectStageHistory"]] = relationship(
        "ProjectStageHistory", back_populates="project", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship("Payment", back_populates="project")  # noqa: F821
    
    assignments: Mapped[list["ProjectAssignment"]] = relationship(
        "ProjectAssignment", back_populates="project", cascade="all, delete-orphan"
    )
    uploads: Mapped[list["ProjectUpload"]] = relationship(
        "ProjectUpload", back_populates="project", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Project {self.project_code} [{self.current_stage}]>"

    @property
    def payment_breakdown(self) -> dict:
        first_50_required = Decimal("0")
        if self.quotation and self.quotation.advance_amount:
            first_50_required = self.quotation.advance_amount
        else:
            first_50_required = self.project_value * Decimal("0.5")

        second_50_required = max(Decimal("0"), self.project_value - first_50_required)

        first_50_paid = Decimal("0")
        second_50_paid = Decimal("0")

        try:
            verified_payments = [p for p in self.payments if p.state == "Verified"]
        except Exception:
            verified_payments = []
            
        for p in verified_payments:
            amt = p.actual_amount or Decimal("0")
            if p.payment_type in ("Advance (50%)", "Advance"):
                first_50_paid += amt
            else:
                second_50_paid += amt

        excess_advance_generated = max(Decimal("0"), first_50_paid - first_50_required)
        first_50_pending = max(Decimal("0"), first_50_required - first_50_paid)
        
        second_50_excess = max(Decimal("0"), second_50_paid - second_50_required)
        second_50_pending = max(Decimal("0"), second_50_required - second_50_paid)
        
        advance_adjusted = min(excess_advance_generated, second_50_pending)

        total_verified_paid = first_50_paid + second_50_paid
        final_outstanding = max(Decimal("0"), self.project_value - total_verified_paid)

        return {
            "total_amount": self.project_value,
            "first_50_required": first_50_required,
            "first_50_paid": first_50_paid,
            "first_50_pending": first_50_pending,
            "excess_advance_generated": excess_advance_generated,
            "verified_additional_advance": Decimal("0"),
            "advance_adjusted": advance_adjusted,
            "second_50_required": second_50_required,
            "second_50_paid": second_50_paid,
            "second_50_pending": second_50_pending,
            "second_50_excess": second_50_excess,
            "total_verified_paid": total_verified_paid,
            "final_outstanding": final_outstanding
        }


class ProjectStageHistory(UUIDMixin, Base):
    __tablename__ = "project_stage_histories"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    from sqlalchemy import DateTime
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stage: Mapped[str] = mapped_column(String(100), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(), default=_now, nullable=False
    )
    changed_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="stage_history")
