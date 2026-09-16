"""
Project code generation — SSC-PRJ-NNNN format.
"""

from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession


async def generate_project_code(db: AsyncSession) -> str:
    """Generate the next project code: SSC-PRJ-0001"""
    from app.models.project import Project

    result = await db.execute(
        select(func.count()).select_from(Project).where(
            Project.project_code.like("SSC-PRJ-%")
        )
    )
    count = result.scalar_one() or 0
    return f"SSC-PRJ-{count + 1:04d}"
