"""
Department model — lookup/config table for the 7 departments.
The 'teams' list is stored as a comma-separated string for simplicity
(no need for a separate join table for this static data).
"""

from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin


class Department(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "departments"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    # teams stored as JSON string list, e.g. '["Inbound","Outbound"]'
    teams_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)

    def __repr__(self) -> str:
        return f"<Department {self.name}>"
