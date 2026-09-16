"""
Customer model — normalized table; converted from a Lead.
A Customer may have multiple Projects.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.lead import Lead

from sqlalchemy import String, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin, SoftDeleteMixin


class Customer(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "customers"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    mobile: Mapped[str] = mapped_column(String(20), nullable=False)
    alternate_mobile: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)

    customer_type: Mapped[str] = mapped_column(
        SAEnum(
            "Residential", "Commercial", "Industrial",
            name="customer_type_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        nullable=False,
    )

    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    area: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # The Lead that converted into this Customer
    source_lead_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.leads.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    projects: Mapped[list["Project"]] = relationship(  # noqa: F821
        "Project", back_populates="customer"
    )
    source_lead: Mapped["Lead | None"] = relationship(  # noqa: F821
        "Lead", foreign_keys=[source_lead_id]
    )

    def __repr__(self) -> str:
        return f"<Customer {self.name}>"
