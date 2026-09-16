"""
Project upload model for centralized field technician photo and video uploads.
"""

from __future__ import annotations
from typing import TYPE_CHECKING
from datetime import datetime, timezone

from sqlalchemy import String, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.employee import Employee


class ProjectUpload(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "project_uploads"
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
    
    file_type: Mapped[str] = mapped_column(String(50), nullable=False) # 'Photo' or 'Video'
    file_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    stage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    # Location metadata
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="uploads")
    employee: Mapped["Employee"] = relationship("Employee", foreign_keys=[employee_id])

    def __repr__(self) -> str:
        return f"<ProjectUpload {self.file_type}>"
