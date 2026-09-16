"""
Async SQLAlchemy engine & session factory.
All tables live in the 'solar' PostgreSQL schema.
"""

from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, declared_attr

from app.core.config import settings


# ── Engine ─────────────────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)


# ── Session factory ────────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ── Base declarative ──────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """All models inherit from this base so they share the 'solar' schema."""

    @declared_attr.directive
    def __tablename__(cls) -> str:  # noqa: N805
        # Snake-case the class name by default; models may override.
        import re
        name = re.sub(r"(?<!^)(?=[A-Z])", "_", cls.__name__).lower()
        return name

    # Default table args: every table lives in the configured schema
    @declared_attr.directive
    def __table_args__(cls):  # noqa: N805
        return {"schema": settings.POSTGRES_SCHEMA}


# ── Dependency ────────────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields an async DB session per request."""
    async with AsyncSessionLocal() as session:
        session.info["ws_actions"] = []
        try:
            yield session
            await session.commit()

            # Flush WebSocket events ONLY after a successful commit
            from app.websocket.manager import manager as ws_manager
            for action_tuple in session.info.get("ws_actions", []):
                method = action_tuple[0]
                args = action_tuple[1:]
                if method == "broadcast":
                    await ws_manager.broadcast(*args)
                elif method == "send_to_department":
                    await ws_manager.send_to_department(*args)
                elif method == "send_to_role":
                    await ws_manager.send_to_role(*args)
                elif method == "send_to_authorized_users":
                    await ws_manager.send_to_authorized_users(*args)
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── Schema bootstrap ──────────────────────────────────────────────────────────
async def create_schema_if_not_exists() -> None:
    """Ensure the target schema exists before Alembic/app boot."""
    import re
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', settings.POSTGRES_SCHEMA):
        raise ValueError(f"Invalid schema name: {settings.POSTGRES_SCHEMA}")
    async with engine.begin() as conn:
        await conn.execute(
            text(f"CREATE SCHEMA IF NOT EXISTS {settings.POSTGRES_SCHEMA}")
        )
