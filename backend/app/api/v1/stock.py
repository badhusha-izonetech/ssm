"""
Stock router — list, stock-in, reserve, issue, return.
"""

from typing import Optional, List
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.permissions import Permission, require_permissions
from app.core.security import get_current_user
from app.models.stock_item import StockItem
from app.schemas.stock_item import (
    StockInRequest,
    StockIssueRequest,
    StockItemCreate,
    StockItemRead,
    StockItemUpdate,
    StockReserveRequest,
    StockReturnRequest,
    StockRequestRequest,
    GroupedStockRequest,
    GroupedStockRequestItem,
)
from pydantic import BaseModel
from datetime import datetime
from app.services import stock_service
from app.utils.pagination import PagedResponse, PaginationParams

class StockReservationRead(BaseModel):
    id: str
    stock_item_id: str
    project_id: str
    quantity: Decimal
    status: str
    reserved_by_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    item_name: Optional[str] = None
    unit: Optional[str] = None
    
    model_config = {"from_attributes": True}

class StockTransactionRead(BaseModel):
    id: str
    stock_item_id: str
    transaction_type: str
    quantity: Decimal
    project_id: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    document_url: Optional[str] = None
    performed_by_id: Optional[str] = None
    timestamp: datetime
    
    model_config = {"from_attributes": True}

router = APIRouter(prefix="/stock", tags=["Stock"])

@router.get("/requests/grouped", response_model=List[GroupedStockRequest])
async def list_grouped_stock_requests(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.STOCK_READ)),
):
    from app.models.stock_item import StockReservation
    from app.models.project import Project
    from sqlalchemy.orm import selectinload
    from collections import defaultdict
    
    q = select(StockReservation).options(selectinload(StockReservation.stock_item))
    result = await db.execute(q.order_by(StockReservation.created_at.desc()))
    reservations = result.scalars().all()
    
    grouped = defaultdict(list)
    for r in reservations:
        if not r.project_id:
            continue
        req_qty = r.quantity
        res_qty = r.quantity if r.status in ["Reserved", "Issued"] else Decimal("0")
        
        item_dict = {
            "reservation_id": r.id,
            "stock_item_id": r.stock_item_id,
            "product_name": r.stock_item.product_name if r.stock_item else "Unknown",
            "requested_quantity": req_qty,
            "unit": r.stock_item.unit if r.stock_item else "pcs",
            "reserved_quantity": res_qty,
            "available_quantity": r.stock_item.available_quantity if r.stock_item else Decimal("0"),
            "status": r.status,
            "created_at": r.created_at,
            "notes": r.notes
        }
        grouped[r.project_id].append(item_dict)
        
    project_ids = list(grouped.keys())
    project_map = {}
    if project_ids:
        projects_result = await db.execute(select(Project).where(Project.id.in_(project_ids)))
        for p in projects_result.scalars().all():
            project_map[p.id] = p
            
    out = []
    for pid, items in grouped.items():
        proj = project_map.get(pid)
        
        active_items = [i for i in items if i["status"] not in ["Cancelled", "Returned"]]
        if not active_items:
            continue
            
        all_reserved_or_issued = True
        
        for i in active_items:
            if i["status"] not in ["Reserved", "Issued"]:
                all_reserved_or_issued = False
                
        if all_reserved_or_issued:
            overall = "Reserved"
        else:
            overall = "Requested"
            
        out.append({
            "project_id": pid,
            "project_code": proj.project_code if proj else "Unknown",
            "customer_name": proj.customer_name if proj else "Unknown",
            "items": items,
            "overall_status": overall
        })
        
    return out


@router.post("/requests/grouped/{project_id}/reserve")
async def reserve_project_stock_route(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.STOCK_MANAGE)),
):
    try:
        await stock_service.reserve_project_stock(db, project_id, current_user)
        return {"status": "success"}
    except Exception as e:
        import traceback
        with open("error_log.txt", "w") as f:
            f.write(traceback.format_exc())
        raise

@router.get("/transactions", response_model=List[StockTransactionRead])
async def list_stock_transactions(
    item_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.STOCK_READ)),
):
    from app.models.stock_item import StockTransaction
    q = select(StockTransaction)
    if item_id:
        q = q.where(StockTransaction.stock_item_id == item_id)
    if project_id:
        q = q.where(StockTransaction.project_id == project_id)
    result = await db.execute(q.order_by(StockTransaction.timestamp.desc()))
    return result.scalars().all()


@router.get("/requests", response_model=List[StockReservationRead])
async def list_stock_requests(
    project_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.STOCK_READ)),
):
    from app.models.stock_item import StockReservation
    from sqlalchemy.orm import selectinload
    q = select(StockReservation).options(selectinload(StockReservation.stock_item))
    if project_id:
        q = q.where(StockReservation.project_id == project_id)
    if status:
        q = q.where(StockReservation.status == status)
    result = await db.execute(q.order_by(StockReservation.created_at.desc()))
    reservations = result.scalars().all()
    
    out = []
    for r in reservations:
        data = StockReservationRead.model_validate(r).model_dump()
        data["item_name"] = r.stock_item.product_name if r.stock_item else "Unknown"
        data["unit"] = r.stock_item.unit if r.stock_item else "pcs"
        out.append(data)
    return out


@router.get("", response_model=PagedResponse[StockItemRead])
async def list_stock(
    category: Optional[str] = Query(None),
    low_stock: bool = Query(False),
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.STOCK_READ)),
):
    items, total = await stock_service.list_stock(db, category, low_stock, params.offset, params.limit)
    return PagedResponse.create(
        [StockItemRead.from_orm_with_derived(i) for i in items], total, params
    )


@router.post("", response_model=StockItemRead, status_code=201)
async def create_item(
    payload: StockItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.STOCK_WRITE)),
):
    item = await stock_service.create_stock_item(db, payload)
    return StockItemRead.from_orm_with_derived(item)


@router.patch("/{item_id}", response_model=StockItemRead)
async def update_item(
    item_id: str,
    payload: StockItemUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.STOCK_WRITE)),
):
    result = await db.execute(select(StockItem).where(StockItem.id == item_id, StockItem.is_active == True))
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundError("StockItem")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    db.add(item)
    await db.flush()
    return StockItemRead.from_orm_with_derived(item)


@router.post("/{item_id}/stock-in", response_model=StockItemRead)
async def stock_in(
    item_id: str,
    payload: StockInRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.STOCK_WRITE)),
):
    item = await stock_service.stock_in(db, item_id, payload, current_user)
    return StockItemRead.from_orm_with_derived(item)


@router.post("/{item_id}/request")
async def request_stock(
    item_id: str,
    payload: StockRequestRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.PROJECTS_WRITE)),
):
    try:
        reservation = await stock_service.request_stock(db, item_id, payload, current_user)
        return {"id": reservation.id, "status": reservation.status, "quantity": str(reservation.quantity)}
    except Exception as e:
        import traceback
        with open("error_log.txt", "w") as f:
            f.write(traceback.format_exc())
        raise


@router.delete("/requests/{reservation_id}")
async def cancel_stock_request(
    reservation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.PROJECTS_WRITE)),
):
    from app.models.stock_item import StockReservation
    result = await db.execute(select(StockReservation).where(StockReservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise NotFoundError("StockReservation")
    
    if reservation.status not in ["Requested", "Shortage Flagged"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Only pending requests can be cancelled")
        
    await db.delete(reservation)
    await db.flush()
    return {"status": "success"}


@router.post("/{item_id}/reserve")
async def reserve(
    item_id: str,
    payload: StockReserveRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.STOCK_MANAGE)),
):
    reservation = await stock_service.reserve_stock(db, item_id, payload, current_user)
    return {"id": reservation.id, "status": reservation.status, "quantity": str(reservation.quantity)}


@router.post("/{item_id}/issue", response_model=StockItemRead)
async def issue(
    item_id: str,
    payload: StockIssueRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.STOCK_MANAGE)),
):
    item = await stock_service.issue_stock(db, item_id, payload, current_user)
    return StockItemRead.from_orm_with_derived(item)


@router.post("/{item_id}/return", response_model=StockItemRead)
async def return_stock(
    item_id: str,
    payload: StockReturnRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.STOCK_MANAGE)),
):
    item = await stock_service.return_stock(db, item_id, payload, current_user)
    return StockItemRead.from_orm_with_derived(item)

@router.post("/transactions/{transaction_id}/document", response_model=StockTransactionRead)
async def upload_transaction_document(
    transaction_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.STOCK_WRITE)),
):
    from app.models.stock_item import StockTransaction
    from app.utils.file_upload import save_stock_document
    
    result = await db.execute(select(StockTransaction).where(StockTransaction.id == transaction_id))
    txn = result.scalar_one_or_none()
    if not txn:
        raise NotFoundError("StockTransaction")
        
    url = await save_stock_document(file)
    txn.document_url = url
    db.add(txn)
    await db.flush()
    return txn
