"""
Approval model — covers 5 approval types including Leave Request.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import String, Text, Enum as SAEnum, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Approval(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "approvals"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    approval_type: Mapped[str] = mapped_column(
        SAEnum(
            "Quotation Revision", "Stock Purchase Flag",
            "Leave Request", "Project Hold", "Discount Exception",
            name="approval_type_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        nullable=False,
    )

    requested_by: Mapped[str] = mapped_column(String(200), nullable=False)
    requested_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)

    raised_on: Mapped[datetime] = mapped_column(
        DateTime(), default=_now, nullable=False
    )

    status: Mapped[str] = mapped_column(
        SAEnum(
            "Pending", "Approved", "Rejected",
            name="approval_status_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        default="Pending",
        nullable=False,
    )

    priority: Mapped[str] = mapped_column(
        SAEnum("Low", "Medium", "High", name="approval_priority_enum", schema=settings.POSTGRES_SCHEMA),
        default="Medium",
        nullable=False,
    )

    approved_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Optional entity link (e.g. quotation_id, project_id) stored as plain strings
    entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    def __repr__(self) -> str:
        return f"<Approval [{self.approval_type}] {self.status}>"
