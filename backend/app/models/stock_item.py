"""
StockItem, StockTransaction, StockReservation.
availableQuantity is always derived (currentQuantity - reservedQuantity), never stored.
"""

from __future__ import annotations

from decimal import Decimal
from datetime import datetime, timezone

from sqlalchemy import String, Text, Numeric, Enum as SAEnum, ForeignKey, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship, column_property
from sqlalchemy import select, func

from app.core.database import Base
from app.core.config import settings
from app.models._mixins import UUIDMixin, TimestampMixin


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class StockItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "stock_items"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    product_name: Mapped[str] = mapped_column(String(300), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    brand: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit: Mapped[str] = mapped_column(String(50), default="pcs", nullable=False)

    current_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, nullable=False)
    reserved_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, nullable=False)
    minimum_level: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, nullable=False)
    cost_per_unit: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    transactions: Mapped[list["StockTransaction"]] = relationship(
        "StockTransaction", back_populates="stock_item", cascade="all, delete-orphan"
    )
    reservations: Mapped[list["StockReservation"]] = relationship(
        "StockReservation", back_populates="stock_item", cascade="all, delete-orphan"
    )

    @property
    def available_quantity(self) -> Decimal:
        """Derived — never stored."""
        return self.current_quantity - self.reserved_quantity

    def __repr__(self) -> str:
        return f"<StockItem {self.product_name} qty={self.current_quantity}>"


class StockTransaction(UUIDMixin, Base):
    __tablename__ = "stock_transactions"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    stock_item_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.stock_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    transaction_type: Mapped[str] = mapped_column(
        SAEnum(
            "Stock In", "Stock Out", "Issue", "Return", "Adjustment",
            name="stock_transaction_type_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        nullable=False,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    project_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.projects.id", ondelete="SET NULL"),
        nullable=True,
    )
    reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    document_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    performed_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(), default=_now, nullable=False
    )

    stock_item: Mapped["StockItem"] = relationship("StockItem", back_populates="transactions")


class StockReservation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "stock_reservations"
    __table_args__ = {"schema": settings.POSTGRES_SCHEMA}

    stock_item_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.stock_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    status: Mapped[str] = mapped_column(
        SAEnum(
            "Requested", "Reserved", "Issued", "Returned", "Cancelled", "Shortage Flagged",
            name="stock_reservation_status_enum", schema=settings.POSTGRES_SCHEMA,
        ),
        default="Requested",
        nullable=False,
    )
    reserved_by_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(f"{settings.POSTGRES_SCHEMA}.employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    stock_item: Mapped["StockItem"] = relationship("StockItem", back_populates="reservations")
