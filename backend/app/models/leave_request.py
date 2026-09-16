"""
LeaveRequest model — also raises a linked Approval row (handled in service layer).
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.employee import Employee

from sqlalchemy import String, Text, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin


class LeaveRequest(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "leave_requests"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    employee_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_name: Mapped[str] = mapped_column(String(200), nullable=False)

    leave_type: Mapped[str] = mapped_column(
        SAEnum(
            "Casual", "Sick", "Emergency", "Unpaid",
            name="leave_type_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        nullable=False,
    )

    from_date: Mapped[str] = mapped_column(String(20), nullable=False)
    to_date: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)

    status: Mapped[str] = mapped_column(
        SAEnum(
            "Pending", "Approved", "Rejected",
            name="leave_status_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        default="Pending",
        nullable=False,
    )

    applied_on: Mapped[str] = mapped_column(String(20), nullable=False)
    ceo_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    # FK to the linked Approval row
    approval_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.approvals.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    employee: Mapped["Employee"] = relationship("Employee", back_populates="leave_requests")  # noqa: F821

    def __repr__(self) -> str:
        return f"<LeaveRequest emp={self.employee_id} [{self.status}]>"
