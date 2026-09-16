"""
CallLog schemas.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CallLogCreate(BaseModel):
    date: str
    time: Optional[str] = None
    outcome: str
    notes: Optional[str] = None
    next_follow_up_date: Optional[str] = None


class CallLogRead(CallLogCreate):
    id: str
    lead_id: str
    called_by: str
    called_by_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
