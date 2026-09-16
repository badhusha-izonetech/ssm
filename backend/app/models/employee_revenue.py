"""
EmployeeRevenue model.
Attributes revenue to project employees when an invoice is generated.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.project import Project
    from app.models.invoice import Invoice
    from app.models.quotation import Quotation

from decimal import Decimal
from sqlalchemy import String, Numeric, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin


class EmployeeRevenue(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "employee_revenues"
    __table_args__ = (
        UniqueConstraint("quotation_id", "employee_id", name="uq_quotation_employee"),
        {"schema": settings.POSTGRES_SCHEMA}
    )

    employee_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    invoice_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.invoices.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    quotation_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.quotations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    
    revenue: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    invoice_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    revenue_date: Mapped[str] = mapped_column(String(20), nullable=False)

    employee: Mapped["Employee"] = relationship("Employee")
    project: Mapped["Project"] = relationship("Project")
    invoice: Mapped["Invoice"] = relationship("Invoice")
    quotation: Mapped["Quotation"] = relationship("Quotation")

    def __repr__(self) -> str:
        return f"<EmployeeRevenue emp={self.employee_id} quot={self.quotation_id} rev={self.revenue}>"
