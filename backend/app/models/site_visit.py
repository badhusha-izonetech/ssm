"""
Site Visit models — tracking, locations, photos.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.employee import Employee
    from app.models.lead import Lead

from sqlalchemy import String, Text, Boolean, Float, ForeignKey, DateTime, Enum as SAEnum, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin, SoftDeleteMixin


class SiteVisit(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "site_visits"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    lead_id: Mapped[str | None] = mapped_column(String(36), ForeignKey(f"{settings.POSTGRES_SCHEMA}.leads.id", ondelete="CASCADE"), nullable=True)
    project_id: Mapped[str | None] = mapped_column(String(36), ForeignKey(f"{settings.POSTGRES_SCHEMA}.projects.id", ondelete="CASCADE"), nullable=True)
    
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_mobile: Mapped[str] = mapped_column(String(20), nullable=False)
    site_address: Mapped[str] = mapped_column(String(500), nullable=False)
    area: Mapped[str] = mapped_column(String(200), nullable=False)
    
    # Required for Geofencing
    customer_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    customer_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    
    visit_date: Mapped[str] = mapped_column(String(20), nullable=False)
    visit_time: Mapped[str] = mapped_column(String(20), nullable=False)
    
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="CASCADE"), nullable=False)
    employee_name: Mapped[str] = mapped_column(String(200), nullable=False)
    
    site_type: Mapped[str] = mapped_column(String(100), nullable=False)
    
    status: Mapped[str] = mapped_column(
        SAEnum(
            "Upcoming", "In Progress", "Completed", "Revisit Required", "Rejected",
            name="site_visit_status_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        default="Upcoming",
        nullable=False,
    )
    
    feasibility_result: Mapped[str | None] = mapped_column(String(200), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    rejection_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Site Details Captured
    installation_area: Mapped[str | None] = mapped_column(String(500), nullable=True)
    measurements: Mapped[str | None] = mapped_column(String(500), nullable=True)
    roof_ground_details: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_materials: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_material_details: Mapped[list[dict]] = mapped_column(JSONB, server_default='[]', nullable=False)
    cable_accessories: Mapped[str | None] = mapped_column(String(500), nullable=True)
    stock_availability_status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    system_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    completed_stages: Mapped[list[str]] = mapped_column(JSONB, server_default='[]', nullable=False)

    # Site visit evidence
    videos: Mapped[list[str]] = mapped_column(
    JSONB,
    server_default='[]',
    nullable=False,
)

    measurement_images: Mapped[list[str]] = mapped_column(
    JSONB,
    server_default='[]',
    nullable=False,
)

    documents: Mapped[list[str]] = mapped_column(
    JSONB,
    server_default='[]',
    nullable=False,
)

    # Tool / Equipment tracking photos
    tool_photo_before: Mapped[str | None] = mapped_column(Text, nullable=True)
    tool_photo_after: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Submission tracking
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", foreign_keys=[employee_id])
    lead: Mapped["Lead"] = relationship("Lead", foreign_keys=[lead_id])
    project: Mapped["Project"] = relationship("Project", foreign_keys=[project_id])
    
    tracking_locations: Mapped[list["SiteVisitLocation"]] = relationship(
        "SiteVisitLocation", back_populates="site_visit", cascade="all, delete-orphan", order_by="SiteVisitLocation.captured_at"
    )
    photos: Mapped[list["SiteVisitPhoto"]] = relationship(
        "SiteVisitPhoto", back_populates="site_visit", cascade="all, delete-orphan", order_by="SiteVisitPhoto.captured_at"
    )


class SiteVisitLocation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "site_visit_locations"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    site_visit_id: Mapped[str] = mapped_column(String(36), ForeignKey(f"{settings.POSTGRES_SCHEMA}.site_visits.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="CASCADE"), nullable=False)
    
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy: Mapped[float] = mapped_column(Float, nullable=False)
    distance_from_customer: Mapped[float | None] = mapped_column(Float, nullable=True)
    
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    site_visit: Mapped["SiteVisit"] = relationship("SiteVisit", back_populates="tracking_locations")


class SiteVisitPhoto(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "site_visit_photos"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    site_visit_id: Mapped[str] = mapped_column(String(36), ForeignKey(f"{settings.POSTGRES_SCHEMA}.site_visits.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="CASCADE"), nullable=False)
    
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    stage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy: Mapped[float] = mapped_column(Float, nullable=False)
    distance_from_customer: Mapped[float] = mapped_column(Float, nullable=False)
    
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    site_visit: Mapped["SiteVisit"] = relationship("SiteVisit", back_populates="photos")
