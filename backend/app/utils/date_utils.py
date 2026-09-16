"""
Date utilities.
"""

from __future__ import annotations

from datetime import date, datetime, timezone


def today_str() -> str:
    """Return today's date as ISO string YYYY-MM-DD."""
    return date.today().isoformat()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def parse_date(value: str) -> date:
    return date.fromisoformat(value)
