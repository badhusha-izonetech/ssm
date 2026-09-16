from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.employee import Employee

from sqlalchemy import String, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin


class AttendanceRecord(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "attendance_records"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    employee_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_name: Mapped[str] = mapped_column(String(200), nullable=False)

    date: Mapped[str] = mapped_column(String(20), nullable=False)
    check_in_time: Mapped[str | None] = mapped_column(String(20), nullable=True)
    check_out_time: Mapped[str | None] = mapped_column(String(20), nullable=True)
    
    status: Mapped[str] = mapped_column(
        SAEnum(
            "Present", "Absent", "On Leave",
            name="attendance_status_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        nullable=False,
        default="Present"
    )

    type: Mapped[str] = mapped_column(
        SAEnum(
            "Office", "Field",
            name="attendance_type_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        nullable=False,
    )

    employee: Mapped["Employee"] = relationship("Employee")
