"""
Payment model + PaymentProof.
Verify/reject workflow gated to Accountant role.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.project import Project

from decimal import Decimal
from datetime import datetime, timezone

from sqlalchemy import String, Text, Numeric, Enum as SAEnum, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Payment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "payments"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    project_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    quotation_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.quotations.id", ondelete="SET NULL"),
        nullable=True,
    )

    expected_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    actual_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)

    payment_type: Mapped[str] = mapped_column(
        SAEnum(
            "Advance", "Advance (50%)", "Balance Payment", "Partial Payment", "Full Payment",
            name="payment_type_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        nullable=False,
    )
    payment_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    payment_mode: Mapped[str | None] = mapped_column(
        SAEnum(
            "UPI", "Bank Transfer", "Cheque", "Cash", "Card",
            name="payment_mode_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        nullable=True,
    )
    transaction_reference: Mapped[str | None] = mapped_column(String(200), nullable=True)

    state: Mapped[str] = mapped_column(
        SAEnum(
            "Pending", "Partial", "Proof Uploaded", "Under Verification",
            "Verified", "Rejected",
            name="payment_state_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        default="Pending",
        nullable=False,
    )

    submitted_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    submitted_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    verified_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    verified_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    project: Mapped["Project | None"] = relationship("Project", back_populates="payments")  # noqa: F821
    proofs: Mapped[list["PaymentProof"]] = relationship(
        "PaymentProof", back_populates="payment", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Payment project={self.project_id} state={self.state}>"


class PaymentProof(UUIDMixin, Base):
    __tablename__ = "payment_proofs"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    payment_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.payments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(), default=_now, nullable=False
    )
    uploaded_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )

    payment: Mapped["Payment"] = relationship("Payment", back_populates="proofs")
