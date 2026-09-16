"""
Employee model — maps to the Employee interface in src/types/models.ts.
Includes hashed_password and auth metadata not exposed to the frontend.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.lead import Lead
    from app.models.field_movement import FieldMovement
    from app.models.leave_request import LeaveRequest
    from app.models.performance_record import PerformanceRecord
    from app.models.notification import Notification

from sqlalchemy import String, Boolean, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin, SoftDeleteMixin


class Employee(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "employees"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    employee_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    mobile: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    joining_date: Mapped[str] = mapped_column(String(20), nullable=False)

    department: Mapped[str] = mapped_column(
        SAEnum(
            "CEO", "Marketing", "Site Visit", "Accounts",
            "Project", "Warehouse", "Transport", "Quotation",
            name="department_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        nullable=False,
    )
    designation: Mapped[str] = mapped_column(
        SAEnum(
            "CEO", "Telecaller", "Direct Marketing Executive",
            "Site Visitor", "Accountant", "Project Head",
            "Field Technician", "Document Follow-up Executive",
            "Stock Maintenance", "Driver", "Partner / Payment Receiver",
            "Quotation Manager",
            name="designation_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        nullable=False,
    )

    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(200), nullable=False)

    employment_status: Mapped[str] = mapped_column(
        SAEnum(
            "Active", "On Leave", "Suspended", "Relieved",
            name="employment_status_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        default="Active",
        nullable=False,
    )

    avatar_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)

    family_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    office_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    document_1: Mapped[str | None] = mapped_column(String(200), nullable=True)
    document_2: Mapped[str | None] = mapped_column(String(200), nullable=True)
    document_3: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    leads_assigned: Mapped[list["Lead"]] = relationship(  # noqa: F821
        "Lead", foreign_keys="Lead.assigned_employee_id", back_populates="assigned_employee"
    )
    leads_created: Mapped[list["Lead"]] = relationship(  # noqa: F821
        "Lead", foreign_keys="Lead.created_by_id", back_populates="created_by"
    )
    field_movements: Mapped[list["FieldMovement"]] = relationship(  # noqa: F821
        "FieldMovement", back_populates="employee"
    )
    leave_requests: Mapped[list["LeaveRequest"]] = relationship(  # noqa: F821
        "LeaveRequest", back_populates="employee"
    )
    performance_records: Mapped[list["PerformanceRecord"]] = relationship(  # noqa: F821
        "PerformanceRecord", back_populates="employee"
    )
    notifications: Mapped[list["Notification"]] = relationship(  # noqa: F821
        "Notification", back_populates="recipient"
    )

    def __repr__(self) -> str:
        return f"<Employee {self.employee_code} {self.name}>"
