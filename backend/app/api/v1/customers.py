"""
Customers router.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import Permission, require_permissions
from app.core.security import get_current_user
from app.schemas.customer import CustomerRead, CustomerUpdate, ExistingCustomerView, GlobalCustomerView
from app.services import customer_service
from app.utils.pagination import PagedResponse, PaginationParams
from typing import List

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=PagedResponse[GlobalCustomerView])
async def list_customers(
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    _=Depends(require_permissions(Permission.CUSTOMERS_READ)),
):
    items, total = await customer_service.list_global_customers(db, current_user, params.offset, params.limit)
    return PagedResponse.create([GlobalCustomerView.model_validate(c) for c in items], total, params)


@router.get("/existing", response_model=List[ExistingCustomerView])
async def existing_customers(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.CUSTOMERS_READ)),
):
    return await customer_service.get_existing_customers(db)


@router.get("/{customer_id}", response_model=CustomerRead)
async def get_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.CUSTOMERS_READ)),
):
    from sqlalchemy import select
    from app.models.customer import Customer
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    return CustomerRead.model_validate(result.scalar_one())


@router.patch("/{customer_id}", response_model=CustomerRead)
async def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.CUSTOMERS_WRITE)),
):
    c = await customer_service.update_customer(db, customer_id, payload)
    return CustomerRead.model_validate(c)
