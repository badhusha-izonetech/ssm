"""
Common shared schemas.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

import uuid

class UUIDSchema(BaseModel):
    id: uuid.UUID | str

class SuccessResponse(BaseModel):
    success: bool = True
    message: str = "OK"
    data: Optional[Any] = None


class ErrorResponse(BaseModel):
    detail: str
    code: str = "ERROR"
    field: Optional[str] = None


class TimestampSchema(BaseModel):
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
