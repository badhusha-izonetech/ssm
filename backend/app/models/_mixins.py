"""
Shared model mixin: id (UUID), created_at, updated_at, soft-delete.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class TimestampMixin:
    # Use DateTime without timezone=True to avoid Alembic renderer issue on Windows.
    # server_default=now() ensures PostgreSQL stores UTC timestamps.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(),
        default=_now,
        server_default=text("now()"),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(),
        default=_now,
        server_default=text("now()"),
        onupdate=_now,
        nullable=False,
    )


class UUIDMixin:
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )


class SoftDeleteMixin:
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
