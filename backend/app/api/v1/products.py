"""
Products catalog endpoints for Quotations.
Provides full CRUD (Create, Read, Update, Delete) operations.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.product import Product
from app.models.employee import Employee
from app.core.security import get_current_user
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
)

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=ProductListResponse)
async def list_products(
    include_inactive: bool = Query(False, description="Include deactivated products"),
    category: str | None = Query(None, description="Filter by category"),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """List all products in catalog."""
    query = select(Product)
    if not include_inactive:
        query = query.where(Product.is_active == True)  # noqa: E712
    if category:
        query = query.where(Product.category == category)
    query = query.order_by(Product.sort_order.asc(), Product.name.asc())

    result = await db.execute(query)
    items = result.scalars().all()

    total_query = select(func.count(Product.id))
    if not include_inactive:
        total_query = total_query.where(Product.is_active == True)  # noqa: E712
    if category:
        total_query = total_query.where(Product.category == category)
    total = (await db.execute(total_query)).scalar_one()

    return ProductListResponse(
        items=[ProductResponse.model_validate(p) for p in items],
        total=total,
    )


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Create a new catalog product."""
    existing = (
        await db.execute(select(Product).where(Product.name == payload.name))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with name '{payload.name}' already exists.",
        )

    product = Product(
        name=payload.name,
        category=payload.category,
        description=payload.description,
        unit=payload.unit,
        unit_price=payload.unit_price,
        gst_percent=payload.gst_percent,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.PRODUCT_CREATED, "Product", "Create", product.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    
    return ProductResponse.model_validate(product)


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Get single product details."""
    product = (
        await db.execute(select(Product).where(Product.id == product_id))
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product '{product_id}' not found.",
        )
    return ProductResponse.model_validate(product)


@router.put("/{product_id}", response_model=ProductResponse)
@router.patch("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Update an existing product."""
    product = (
        await db.execute(select(Product).where(Product.id == product_id))
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product '{product_id}' not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != product.name:
        existing_dup = (
            await db.execute(
                select(Product).where(
                    Product.name == update_data["name"],
                    Product.id != product_id,
                )
            )
        ).scalar_one_or_none()
        if existing_dup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Another product with name '{update_data['name']}' already exists.",
            )

    for field, val in update_data.items():
        setattr(product, field, val)

    db.add(product)
    await db.commit()
    await db.refresh(product)
    
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.PRODUCT_UPDATED, "Product", "Update", product.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    
    return ProductResponse.model_validate(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Delete a product from catalog."""
    product = (
        await db.execute(select(Product).where(Product.id == product_id))
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product '{product_id}' not found.",
        )

    await db.delete(product)
    await db.commit()
    
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.PRODUCT_UPDATED, "Product", "Delete", product_id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    
    return None
