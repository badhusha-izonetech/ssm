"""
Invoice number generation — SSC-INV-YYYY-NNNN format.
Ensures continuous, sequential, and non-repeating invoice numbering.
"""

from __future__ import annotations

from datetime import datetime, timezone
import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def generate_invoice_number(db: AsyncSession, year: int | None = None) -> str:
    """
    Generate the next sequential invoice number for the given or current year.
    Pattern: SSC-INV-YYYY-NNNN
    """
    from app.models.invoice import Invoice

    if year is None:
        year = datetime.now(timezone.utc).year

    prefix = f"SSC-INV-{year}-"

    # Query all existing invoice numbers matching the prefix for this year (including soft-deleted)
    result = await db.execute(
        select(Invoice.invoice_number).where(
            Invoice.invoice_number.like(f"{prefix}%")
        )
    )
    all_numbers = result.scalars().all()
    max_num = 0
    for num_str in all_numbers:
        if not num_str:
            continue
        try:
            # Extract trailing digits or split by "-"
            match = re.search(r"(\d+)$", num_str)
            if match:
                seq = int(match.group(1))
                if seq > max_num:
                    max_num = seq
        except (ValueError, IndexError):
            pass

    next_num = max_num + 1
    return f"{prefix}{next_num:04d}"
