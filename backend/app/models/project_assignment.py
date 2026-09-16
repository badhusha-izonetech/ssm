"""
Project assignment model for multiple technicians and follow-up employees.
"""

from __future__ import annotations
from typing import TYPE_CHECKING
from datetime import datetime, timezone

from sqlalchemy import String, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.employee import Employee


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ProjectAssignment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "project_assignments"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    employee_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        SAEnum("Technician", "Follow-Up", name="project_assignment_role_enum", schema=settings.POSTGRES_SCHEMA),
        nullable=False,
    )
    assignment_type: Mapped[str] = mapped_column(
        SAEnum("Primary", "Additional", name="project_assignment_type_enum", schema=settings.POSTGRES_SCHEMA),
        nullable=False,
    )
    assigned_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(50), default="Active"
    )

    project: Mapped["Project"] = relationship("Project", back_populates="assignments")
    employee: Mapped["Employee"] = relationship("Employee", foreign_keys=[employee_id])
    assigned_by: Mapped["Employee | None"] = relationship("Employee", foreign_keys=[assigned_by_id])

    def __repr__(self) -> str:
        return f"<ProjectAssignment {self.role} {self.assignment_type}>"
