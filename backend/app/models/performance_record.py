"""
PerformanceRecord model.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.employee import Employee

from decimal import Decimal

from sqlalchemy import String, Text, Numeric, Enum as SAEnum, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin


class PerformanceRecord(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "performance_records"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    employee_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_name: Mapped[str] = mapped_column(String(200), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(100), nullable=False)

    period: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g. "Q1 2025"
    score: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed_work: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pending_work: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    efficiency: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    employee: Mapped["Employee"] = relationship("Employee", back_populates="performance_records")  # noqa: F821

    def __repr__(self) -> str:
        return f"<PerformanceRecord emp={self.employee_id} period={self.period}>"
