"""
EmployeeFinancial model.
Stores salary and expenses for an employee.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.employee import Employee

from decimal import Decimal
from sqlalchemy import String, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin


class EmployeeFinancial(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "employee_financials"
    __table_args__ = (
        UniqueConstraint("employee_id", "financial_month", name="uq_emp_financial_month"),
        {"schema": settings.POSTGRES_SCHEMA}
    )

    employee_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    financial_month: Mapped[str] = mapped_column(String(7), nullable=False, index=True)
    salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    employee: Mapped["Employee"] = relationship("Employee")

    def __repr__(self) -> str:
        return f"<EmployeeFinancial emp={self.employee_id} month={self.financial_month} sal={self.salary} exp={self.expenses}>"
