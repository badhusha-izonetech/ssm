"""
Pydantic schemas for Product catalog.
"""

from __future__ import annotations

from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=300, description="Product Name")
    category: str = Field("General", max_length=100, description="Product Category")
    description: str | None = Field(None, description="Detailed technical specifications / bullet points")
    unit: str = Field("Kilowatt", max_length=50, description="Unit e.g. Kilowatt, Unit, Set")
    unit_price: Decimal = Field(Decimal("0"), ge=0, description="Default unit price")
    gst_percent: Decimal = Field(Decimal("18"), ge=0, le=100, description="GST Percentage (e.g., 18, 12)")
    sort_order: int = Field(0, description="Display order")
    is_active: bool = Field(True, description="Whether product is active")


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=300)
    category: str | None = Field(None, max_length=100)
    description: str | None = None
    unit: str | None = Field(None, max_length=50)
    unit_price: Decimal | None = Field(None, ge=0)
    gst_percent: Decimal | None = Field(None, ge=0, le=100)
    sort_order: int | None = None
    is_active: bool | None = None


class ProductResponse(ProductBase):
    id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    total: int
