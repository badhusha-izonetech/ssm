"""
FieldMovement + child tables: RoutePoint, Photo, Note.
One FieldMovement per active visit per employee.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.employee import Employee

from datetime import datetime, timezone

from sqlalchemy import String, Text, Float, Enum as SAEnum, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class FieldMovement(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "field_movements"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    employee_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(100), nullable=False)

    status: Mapped[str] = mapped_column(
        SAEnum(
            "Checked In", "On Field", "Returning", "Checked Out",
            name="field_movement_status_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        default="Checked In",
        nullable=False,
    )

    current_location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    destination: Mapped[str | None] = mapped_column(String(500), nullable=True)
    start_time: Mapped[datetime] = mapped_column(
        DateTime(), default=_now, nullable=False
    )
    last_update: Mapped[datetime] = mapped_column(
        DateTime(), default=_now, nullable=False
    )
    end_time: Mapped[datetime | None] = mapped_column(DateTime(), nullable=True)

    lead_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.leads.id", ondelete="SET NULL"),
        nullable=True,
    )
    purpose: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Real GPS tracking (Employee Tracking feature) ───────────────────────────
    # Denormalized "last known position" snapshot, kept in sync from
    # FieldMovementLocation rows on every GPS ping. Lets the CEO live map and
    # list views avoid a join/query against the location history table for the
    # common case of "where is this employee right now".
    last_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_heading: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_location_at: Mapped[datetime | None] = mapped_column(DateTime(), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    employee: Mapped["Employee"] = relationship("Employee", back_populates="field_movements")  # noqa: F821
    route_points: Mapped[list["FieldMovementRoutePoint"]] = relationship(
        "FieldMovementRoutePoint", back_populates="field_movement", cascade="all, delete-orphan"
    )
    locations: Mapped[list["FieldMovementLocation"]] = relationship(
        "FieldMovementLocation", back_populates="field_movement", cascade="all, delete-orphan",
        order_by="FieldMovementLocation.captured_at",
    )
    photos: Mapped[list["FieldMovementPhoto"]] = relationship(
        "FieldMovementPhoto", back_populates="field_movement", cascade="all, delete-orphan"
    )
    notes: Mapped[list["FieldMovementNote"]] = relationship(
        "FieldMovementNote", back_populates="field_movement", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<FieldMovement emp={self.employee_id} status={self.status}>"


class FieldMovementRoutePoint(UUIDMixin, Base):
    __tablename__ = "field_movement_route_points"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    field_movement_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.field_movements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    time: Mapped[datetime] = mapped_column(DateTime(), default=_now, nullable=False)
    location: Mapped[str] = mapped_column(String(500), nullable=False)

    field_movement: Mapped["FieldMovement"] = relationship(
        "FieldMovement", back_populates="route_points"
    )


class FieldMovementLocation(UUIDMixin, TimestampMixin, Base):
    """
    Real GPS ping (lat/lng/accuracy/speed/heading) recorded during an active
    tracking session (FieldMovement). This is the generalized replacement for
    ad-hoc free-text FieldMovementRoutePoint entries — one row per GPS fix,
    following the same shape already proven by SiteVisitLocation.
    """
    __tablename__ = "field_movement_locations"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    field_movement_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.field_movements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy: Mapped[float] = mapped_column(Float, nullable=False)
    speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    heading: Mapped[float | None] = mapped_column(Float, nullable=True)

    captured_at: Mapped[datetime] = mapped_column(DateTime(), nullable=False, index=True)

    field_movement: Mapped["FieldMovement"] = relationship(
        "FieldMovement", back_populates="locations"
    )


class FieldMovementPhoto(UUIDMixin, Base):
    __tablename__ = "field_movement_photos"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    field_movement_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.field_movements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(), default=_now, nullable=False
    )
    uploaded_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )

    field_movement: Mapped["FieldMovement"] = relationship(
        "FieldMovement", back_populates="photos"
    )


class FieldMovementNote(UUIDMixin, Base):
    __tablename__ = "field_movement_notes"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    field_movement_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.field_movements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    note: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(), default=_now, nullable=False
    )
    created_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )

    field_movement: Mapped["FieldMovement"] = relationship(
        "FieldMovement", back_populates="notes"
    )
