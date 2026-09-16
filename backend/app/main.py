"""
FastAPI application entry point.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import RequestIdMiddleware, configure_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    # Ensure MinIO bucket exists
    try:
        import asyncio
        from app.services.storage_service import init_bucket
        await asyncio.wait_for(init_bucket(), timeout=3.0)
    except asyncio.TimeoutError:
        import logging
        logging.warning("MinIO bucket initialization timed out. Is MinIO running?")
    except Exception as e:
        import logging
        logging.warning(f"Failed to initialize MinIO bucket: {e}")
        
    # Ensure DB Enums and Columns have all required values
    try:
        from app.core.database import engine
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text(f"ALTER TYPE {settings.POSTGRES_SCHEMA}.quotation_status_enum ADD VALUE IF NOT EXISTS 'Verified';"))
            await conn.execute(text(f"ALTER TYPE {settings.POSTGRES_SCHEMA}.notification_dept_enum ADD VALUE IF NOT EXISTS 'Quotation';"))
            await conn.execute(text(f"""
                ALTER TABLE {settings.POSTGRES_SCHEMA}.invoices 
                ADD COLUMN IF NOT EXISTS payment_terms TEXT,
                ADD COLUMN IF NOT EXISTS installation_terms TEXT,
                ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
            """))
    except Exception as e:
        import logging
        logging.warning(f"Failed to verify DB enum / table columns: {e}")

    try:
        from app.services.scheduler import start_scheduler
        start_scheduler()
    except Exception as e:
        import logging
        logging.warning(f"Failed to start scheduler: {e}")
        
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API for Success Solar Care ERP — serves the Vite + React frontend.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(RequestIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Exception handlers ────────────────────────────────────────────────────────
register_exception_handlers(app)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(api_router)

# ── Static file serving for uploads ──────────────────────────────────────────
import os
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "version": settings.APP_VERSION, "env": settings.ENVIRONMENT}
