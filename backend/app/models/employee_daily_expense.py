"""
EmployeeDailyExpense model.
Stores individual daily expenses for employees.
"""

from __future__ import annotations
from typing import TYPE_CHECKING
from datetime import date

if TYPE_CHECKING:
    from app.models.employee import Employee

from decimal import Decimal
from sqlalchemy import String, Numeric, ForeignKey, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin


class EmployeeDailyExpense(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "employee_daily_expenses"
    __table_args__ = (
        {"schema": settings.POSTGRES_SCHEMA}
    )

    employee_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    expense_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    proof_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    employee: Mapped["Employee"] = relationship("Employee")

    def __repr__(self) -> str:
        return f"<EmployeeDailyExpense emp={self.employee_id} date={self.expense_date} amt={self.amount}>"
