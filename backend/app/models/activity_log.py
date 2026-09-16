"""
ActivityLog model — immutable audit trail for every significant action.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import String, Text, Enum as SAEnum, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ActivityLog(UUIDMixin, Base):
    __tablename__ = "activity_logs"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(), default=_now, nullable=False, index=True
    )
    actor: Mapped[str] = mapped_column(String(200), nullable=False)
    actor_employee_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    action: Mapped[str] = mapped_column(String(300), nullable=False)
    entity: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<ActivityLog {self.actor}: {self.action}>"
