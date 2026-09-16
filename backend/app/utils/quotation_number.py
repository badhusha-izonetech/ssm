"""
Quotation number generation — SSC-QT-YYYY-NNNN format.
Number is stable across revisions (same quotationNumber, incremented revisionNumber).
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings


async def generate_quotation_number(db: AsyncSession) -> str:
    """
    Generate the next quotation number for the current year.
    Pattern: SSC-QT-YYYY-NNNN
    """
    from app.models.quotation import Quotation

    year = datetime.now(timezone.utc).year
    prefix = f"SSC-QT-{year}-"

    # Find the maximum sequence number existing for this year (including soft-deleted)
    result = await db.execute(
        select(Quotation.quotation_number).where(
            Quotation.quotation_number.like(f"{prefix}%")
        )
    )
    all_numbers = result.scalars().all()
    max_num = 0
    for num_str in all_numbers:
        if not num_str:
            continue
        try:
            parts = num_str.split("-")
            seq = int(parts[-1])
            if seq > max_num:
                max_num = seq
        except (ValueError, IndexError):
            pass

    next_num = max_num + 1
    return f"{prefix}{next_num:04d}"

