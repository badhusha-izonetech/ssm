"""
Stock schemas.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, computed_field

class GroupedStockRequestItem(BaseModel):
    reservation_id: str
    stock_item_id: str
    product_name: str
    requested_quantity: Decimal
    unit: str
    reserved_quantity: Decimal
    available_quantity: Decimal
    status: str
    created_at: datetime
    notes: Optional[str] = None

class GroupedStockRequest(BaseModel):
    project_id: str
    project_code: str
    customer_name: str
    items: List[GroupedStockRequestItem]
    overall_status: str



class StockItemCreate(BaseModel):
    product_name: str
    category: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    unit: str = "pcs"
    current_quantity: Decimal = Decimal("0")
    minimum_level: Decimal = Decimal("0")
    cost_per_unit: Decimal = Decimal("0")


class StockItemUpdate(BaseModel):
    product_name: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    unit: Optional[str] = None
    minimum_level: Optional[Decimal] = None
    cost_per_unit: Optional[Decimal] = None
    is_active: Optional[bool] = None


class StockInRequest(BaseModel):
    quantity: Decimal
    reference: Optional[str] = None
    notes: Optional[str] = None


class StockRequestRequest(BaseModel):
    project_id: str
    quantity: Decimal
    notes: Optional[str] = None


class StockReserveRequest(BaseModel):
    reservation_id: str
    notes: Optional[str] = None


class StockIssueRequest(BaseModel):
    reservation_id: str
    quantity: Decimal
    notes: Optional[str] = None


class StockReturnRequest(BaseModel):
    project_id: str
    quantity: Decimal
    notes: Optional[str] = None


class StockItemRead(BaseModel):
    id: str
    product_name: str
    category: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    unit: str
    current_quantity: Decimal
    reserved_quantity: Decimal
    available_quantity: Decimal
    minimum_level: Decimal
    cost_per_unit: Decimal
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_derived(cls, obj) -> "StockItemRead":
        data = {
            "id": obj.id,
            "product_name": obj.product_name,
            "category": obj.category,
            "brand": obj.brand,
            "model": obj.model,
            "unit": obj.unit,
            "current_quantity": obj.current_quantity,
            "reserved_quantity": obj.reserved_quantity,
            "available_quantity": obj.available_quantity,
            "minimum_level": obj.minimum_level,
            "cost_per_unit": obj.cost_per_unit,
            "is_active": obj.is_active,
            "created_at": obj.created_at,
        }
        return cls(**data)
