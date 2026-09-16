"""
Alembic env.py — async-compatible, reads DATABASE_URL from .env,
creates the 'solar' schema, and imports all models for autogenerate.
"""

import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool, text
from sqlalchemy.engine import Connection
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import async_engine_from_config, create_async_engine

# ── Add project root to path ──────────────────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ── Load .env ─────────────────────────────────────────────────────────────────
from dotenv import load_dotenv  # type: ignore
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.core.config import settings
from app.core.database import Base

# Import all models so Alembic sees them
import app.models  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def include_object(object, name, type_, reflected, compare_to):
    """Only manage objects in our schema."""
    if type_ == "table":
        return object.schema == settings.POSTGRES_SCHEMA
    return True


async def ensure_database_exists() -> None:
    """Check if the target PostgreSQL database exists; if not, connect to default 'postgres' DB and create it."""
    db_url = make_url(settings.DATABASE_URL)
    db_name = db_url.database
    if not db_name or "sqlite" in db_url.drivername:
        return

    postgres_url = db_url.set(database="postgres")
    engine = create_async_engine(postgres_url, isolation_level="AUTOCOMMIT", poolclass=pool.NullPool)
    try:
        async with engine.connect() as conn:
            res = await conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :dbname"),
                {"dbname": db_name}
            )
            exists = res.scalar()
            if not exists:
                import re
                if not re.match(r'^[a-zA-Z0-9_]+$', db_name):
                    raise ValueError(f"Invalid database name: {db_name}")
                await conn.execute(text(f'CREATE DATABASE "{db_name}"'))
                print(f"[Alembic] Created database '{db_name}' automatically.")
    except Exception as e:
        # Ignore exception if DB creation is unneeded or user privileges differ
        pass
    finally:
        await engine.dispose()


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
        version_table_schema=settings.POSTGRES_SCHEMA,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_schemas=True,
        version_table_schema=settings.POSTGRES_SCHEMA,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    await ensure_database_exists()

    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        import re
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', settings.POSTGRES_SCHEMA):
            raise ValueError(f"Invalid schema name: {settings.POSTGRES_SCHEMA}")
        # Ensure schema exists
        await connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {settings.POSTGRES_SCHEMA}"))
        await connection.commit()
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
