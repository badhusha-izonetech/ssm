"""
EB Application model for Document Follow-up tracking.
"""

from __future__ import annotations
from typing import TYPE_CHECKING
from datetime import datetime, timezone

from sqlalchemy import String, Text, Enum as SAEnum, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.employee import Employee


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class EbApplication(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "eb_applications"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    project_id: Mapped[str] = mapped_column(
        String(36), 
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.projects.id", ondelete="CASCADE"), 
        nullable=False, 
        unique=True
    )
    assigned_team: Mapped[str] = mapped_column(String(100), default="Data Follow-up", nullable=False)
    
    assigned_by_id: Mapped[str | None] = mapped_column(
        String(36), 
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"), 
        nullable=True
    )
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    
    assigned_employee_id: Mapped[str | None] = mapped_column(
        String(36), 
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"), 
        nullable=True
    )

    current_stage: Mapped[str] = mapped_column(
        SAEnum(
            "Application Received",
            "Document Collection", 
            "Document Verification", 
            "EB/TANGEDCO Portal Submission",
            "EB Process / Awaiting Further Action",
            "Handover Application with EB Meter Supply",
            name="eb_app_stage_enum_v2", schema=settings.POSTGRES_SCHEMA
        ),
        default="Application Received",
        nullable=False
    )

    verification_status: Mapped[str] = mapped_column(
        SAEnum("Pending", "VERIFIED", "NOT_VERIFIED", name="eb_verification_status_enum", schema=settings.POSTGRES_SCHEMA),
        default="Pending", nullable=False
    )
    verification_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified_by_id: Mapped[str | None] = mapped_column(
        String(36), 
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"), 
        nullable=True
    )
    verification_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    portal_submission_status: Mapped[str] = mapped_column(
        SAEnum("Pending", "COMPLETED", name="eb_portal_status_enum", schema=settings.POSTGRES_SCHEMA),
        default="Pending", nullable=False
    )
    submitted_by_id: Mapped[str | None] = mapped_column(
        String(36), 
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"), 
        nullable=True
    )
    submission_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    portal_reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    portal_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    handover_status: Mapped[str] = mapped_column(
        SAEnum("Pending", "COMPLETED", name="eb_handover_status_enum", schema=settings.POSTGRES_SCHEMA),
        default="Pending", nullable=False
    )
    handed_over_by_id: Mapped[str | None] = mapped_column(
        String(36), 
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"), 
        nullable=True
    )
    handover_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    meter_supply_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    handover_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship("Project")
    documents: Mapped[list["EbDocument"]] = relationship("EbDocument", back_populates="eb_application", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<EbApplication {self.id} for Project {self.project_id}>"


class EbStageHistory(UUIDMixin, Base):
    __tablename__ = "eb_stage_histories"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    eb_application_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.eb_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_stage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    to_stage: Mapped[str] = mapped_column(String(100), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=_now, nullable=False)
    changed_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    eb_application: Mapped["EbApplication"] = relationship("EbApplication")


class EbDocument(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "eb_documents"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    eb_application_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.eb_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    document_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_url: Mapped[str] = mapped_column(Text, nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True
    )

    eb_application: Mapped["EbApplication"] = relationship("EbApplication", back_populates="documents")
