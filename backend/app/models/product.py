"""
Product model — catalog for quotation system products / packages.
Stores pre-defined products with rich technical descriptions, default pricing, and GST.
"""

from __future__ import annotations

from decimal import Decimal
from sqlalchemy import String, Text, Numeric, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin


class Product(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    name: Mapped[str] = mapped_column(String(300), unique=True, nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), default="General", nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit: Mapped[str] = mapped_column(String(50), default="Kilowatt", nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    gst_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=18, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<Product {self.name} price={self.unit_price}>"
