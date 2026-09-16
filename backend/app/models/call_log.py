"""
CallLogEntry model — child of Lead, one entry per phone call.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.lead import Lead

from sqlalchemy import String, Text, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin


class CallLogEntry(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "call_log_entries"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    lead_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.leads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    date: Mapped[str] = mapped_column(String(20), nullable=False)
    time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    called_by: Mapped[str] = mapped_column(String(200), nullable=False)
    called_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )

    outcome: Mapped[str] = mapped_column(
        SAEnum(
            "Answered", "Not Reachable", "Call Back Requested",
            "Switched Off", "Wrong Number",
            name="call_outcome_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_follow_up_date: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    lead: Mapped["Lead"] = relationship("Lead", back_populates="call_logs")  # noqa: F821

    def __repr__(self) -> str:
        return f"<CallLogEntry lead={self.lead_id} outcome={self.outcome}>"
