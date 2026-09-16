"""
Notification model — targeted per-recipient with real FK.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.employee import Employee

from datetime import datetime, timezone

from sqlalchemy import String, Text, Boolean, Enum as SAEnum, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Notification(UUIDMixin, Base):
    __tablename__ = "notifications"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    department: Mapped[str | None] = mapped_column(
        SAEnum(
            "CEO", "Marketing", "Site Visit", "Accounts",
            "Project", "Warehouse", "Transport", "Quotation",
            name="notification_dept_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        nullable=True,
    )
    recipient_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(), default=_now, nullable=False
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    priority: Mapped[str] = mapped_column(
        SAEnum("Low", "Medium", "High", name="notification_priority_enum", schema=settings.POSTGRES_SCHEMA),
        default="Medium",
        nullable=False,
    )
    category: Mapped[str] = mapped_column(
        SAEnum(
            "Approval", "Payment", "Stock", "Project", "Leave", "System",
            name="notification_category_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    recipient: Mapped["Employee | None"] = relationship(  # noqa: F821
        "Employee", back_populates="notifications"
    )

    def __repr__(self) -> str:
        return f"<Notification [{self.category}] {self.title}>"
