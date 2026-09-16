"""
Stock service — stock-in, reserve, issue, return.
availableQuantity invariant enforced on every mutating operation.
"""

from __future__ import annotations

from decimal import Decimal
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models.employee import Employee
from app.models.stock_item import StockItem, StockReservation, StockTransaction
from app.models.notification import Notification
from app.schemas.stock_item import (
    StockInRequest,
    StockIssueRequest,
    StockItemCreate,
    StockReserveRequest,
    StockReturnRequest,
)
from app.services.activity_log_service import log_activity


async def _get_item(db: AsyncSession, item_id: str) -> StockItem:
    result = await db.execute(select(StockItem).where(StockItem.id == item_id, StockItem.is_active == True))
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundError("StockItem")
    return item


async def create_stock_item(db: AsyncSession, payload: StockItemCreate) -> StockItem:
    item = StockItem(**payload.model_dump())
    db.add(item)
    await db.flush()
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.STOCK_CREATED, "Stock", "Create", item.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    return item


async def stock_in(
    db: AsyncSession, item_id: str, payload: StockInRequest, current_user: Employee
) -> StockItem:
    item = await _get_item(db, item_id)
    item.current_quantity += Decimal(str(payload.quantity))
    db.add(item)

    txn = StockTransaction(
        stock_item_id=item.id,
        transaction_type="Stock In",
        quantity=payload.quantity,
        reference=payload.reference,
        notes=payload.notes,
        performed_by_id=current_user.id,
    )
    db.add(txn)
    await db.flush()
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.STOCK_UPDATED, "Stock", "StockIn", item.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    
    await log_activity(
        db,
        actor=current_user.name,
        actor_id=current_user.id,
        department=current_user.department,
        action="Stock in",
        entity=item.product_name,
        entity_type="Stock",
        entity_id=item.id,
        detail=f"Added {payload.quantity} units"
    )
    
    return item

async def request_stock(
    db: AsyncSession, item_id: str, payload: StockReserveRequest, current_user: Employee
) -> StockReservation:
    item = await _get_item(db, item_id)
    qty = Decimal(str(payload.quantity))

    reservation = StockReservation(
        stock_item_id=item.id,
        project_id=payload.project_id,
        quantity=qty,
        status="Requested",
        reserved_by_id=current_user.id,
        notes=payload.notes,
    )
    db.add(reservation)
    
    # Notify Warehouse
    project_str = f" for project {payload.project_id}."
    
    recent_limit = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=15)
    stmt = select(Notification).where(
        Notification.department == "Warehouse",
        Notification.title == "New Stock Request",
        Notification.category == "Stock",
        Notification.timestamp >= recent_limit
    ).order_by(Notification.timestamp.desc())
    
    existing_notifs = (await db.execute(stmt)).scalars().all()
    target_notif = next((n for n in existing_notifs if n.message.endswith(project_str)), None)

    if target_notif:
        target_notif.message = target_notif.message.replace(project_str, f", {qty} of {item.product_name}{project_str}")
        target_notif.is_read = False
        db.add(target_notif)
    else:
        notif = Notification(
            title="New Stock Request",
            message=f"{current_user.name} requested {qty} of {item.product_name}{project_str}",
            department="Warehouse",
            priority="Medium",
            category="Stock"
        )
        db.add(notif)
    
    from app.models.project import Project
    project_res = await db.execute(select(Project).where(Project.id == payload.project_id))
    project = project_res.scalar_one_or_none()
    
    if project:
        if project.warehouse_status == "Not Requested":
            project.warehouse_status = "Requested"
            db.add(project)
    
    # Notify Project Head
    if current_user.designation != "Project Head":
        if project:
            notif_ph = Notification(
                title="Stock Requested by Team",
                message=f"{current_user.name} requested {qty} of {item.product_name} for project '{project.customer_name}'.",
                department="Project",
                priority="Medium",
                category="Stock"
            )
            db.add(notif_ph)

    # We don't deduct reserved_quantity from stock item yet, it's just requested.
    await db.flush()
    
    from app.websocket.events import WebSocketEvent, Events
    ws_actions = [
        ("broadcast", WebSocketEvent.create(Events.STOCK_REQUEST_CREATED, "StockRequest", "Create", reservation.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ]
    if project:
        ws_actions.append(("broadcast", WebSocketEvent.create(Events.PROJECT_UPDATED, "Project", "Update", project.id)))
    if target_notif:
        ws_actions.append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", target_notif.id), {target_notif.recipient_id} if target_notif.recipient_id else set(), {target_notif.department} if target_notif.department else set(), set()))
    elif 'notif' in locals():
        ws_actions.append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id} if notif.recipient_id else set(), {notif.department} if notif.department else set(), set()))
    if 'notif_ph' in locals():
        ws_actions.append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif_ph.id), {notif_ph.recipient_id} if notif_ph.recipient_id else set(), {notif_ph.department} if notif_ph.department else set(), set()))
    db.info.setdefault("ws_actions", []).extend(ws_actions)

    return reservation
async def reserve_project_stock(db: AsyncSession, project_id: str, current_user: Employee) -> None:
    res_result = await db.execute(
        select(StockReservation).options(selectinload(StockReservation.stock_item)).where(
            StockReservation.project_id == project_id,
            StockReservation.status == "Requested"
        )
    )
    reservations = res_result.scalars().all()
    
    if not reservations:
        raise BusinessRuleError("No pending requested products found for this project.")

    for res in reservations:
        item = res.stock_item
        if item.available_quantity < res.quantity:
            raise BusinessRuleError("All requested products must have sufficient stock before the project can be reserved.")

    from app.models.project import Project
    project_res = await db.execute(select(Project).where(Project.id == project_id))
    project = project_res.scalar_one_or_none()
    
    original_requestors = set()
    
    for res in reservations:
        item = res.stock_item
        item.reserved_quantity += res.quantity
        db.add(item)
        
        if res.reserved_by_id:
            original_requestors.add(res.reserved_by_id)
            
        res.status = "Reserved"
        res.reserved_by_id = current_user.id
        db.add(res)
        
        txn = StockTransaction(
            stock_item_id=item.id,
            transaction_type="Stock Out",
            quantity=res.quantity,
            project_id=project_id,
            notes=f"Reserved for project {project_id}",
            performed_by_id=current_user.id,
        )
        db.add(txn)
        
    if project:
        project.warehouse_status = "Reserved"
        db.add(project)

    notifs = []
    for req_id in original_requestors:
        notif = Notification(
            title="Project Stock Reserved",
            message=f"Warehouse reserved all requested products for project '{project.customer_name if project else project_id}'. You can now assign the technicians.",
            recipient_id=req_id,
            priority="High",
            category="Stock"
        )
        db.add(notif)
        notifs.append(notif)
        
    await db.flush()
    
    from app.websocket.events import WebSocketEvent, Events
    ws_actions = [
        ("broadcast", WebSocketEvent.create(Events.STOCK_UPDATED, "Stock", "ReserveProject", project_id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ]
    if project:
        ws_actions.append(("broadcast", WebSocketEvent.create(Events.PROJECT_UPDATED, "Project", "Update", project.id)))
    
    for notif in notifs:
        ws_actions.append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id}, set(), set()))
        
    db.info.setdefault("ws_actions", []).extend(ws_actions)


async def reserve_stock(
    db: AsyncSession, item_id: str, payload: StockReserveRequest, current_user: Employee
) -> StockReservation:
    item = await _get_item(db, item_id)
    
    res_result = await db.execute(
        select(StockReservation).where(
            StockReservation.id == payload.reservation_id,
            StockReservation.stock_item_id == item_id,
            StockReservation.status == "Requested",
        )
    )
    reservation = res_result.scalar_one_or_none()
    if not reservation:
        raise NotFoundError("Requested StockReservation")

    qty = reservation.quantity

    if item.available_quantity < qty:
        raise BusinessRuleError(
            f"Insufficient stock. Available: {item.available_quantity}, Requested: {qty}"
        )

    item.reserved_quantity += qty
    db.add(item)

    original_requestor_id = reservation.reserved_by_id

    reservation.status = "Reserved"
    reservation.reserved_by_id = current_user.id
    if payload.notes:
        reservation.notes = payload.notes
    db.add(reservation)

    txn = StockTransaction(
        stock_item_id=item.id,
        transaction_type="Stock Out",
        quantity=qty,
        project_id=reservation.project_id,
        notes=f"Reserved for project {reservation.project_id}",
        performed_by_id=current_user.id,
    )
    db.add(txn)
    
    from app.models.project import Project
    project_res = await db.execute(select(Project).where(Project.id == reservation.project_id))
    project = project_res.scalar_one_or_none()
    
    if project:
        project.warehouse_status = "Reserved"
        db.add(project)

    # Notify Project Head or whoever requested
    project_name = project.customer_name if project else reservation.project_id
    project_str = f" for project '{project_name}'. You can now assign the technicians."
    
    recent_limit = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=15)
    stmt = select(Notification).where(
        Notification.recipient_id == original_requestor_id,
        Notification.title == "Stock Reserved",
        Notification.category == "Stock",
        Notification.timestamp >= recent_limit
    ).order_by(Notification.timestamp.desc())
    
    existing_notifs = (await db.execute(stmt)).scalars().all()
    target_notif = next((n for n in existing_notifs if n.message.endswith(project_str)), None)

    if target_notif:
        target_notif.message = target_notif.message.replace(project_str, f", {qty} of {item.product_name}{project_str}")
        target_notif.is_read = False
        db.add(target_notif)
    else:
        notif = Notification(
            title="Stock Reserved",
            message=f"Warehouse reserved {qty} of {item.product_name}{project_str}",
            recipient_id=original_requestor_id,
            priority="High",
            category="Stock"
        )
        db.add(notif)
    
    await db.flush()
    await db.flush()
    
    from app.websocket.events import WebSocketEvent, Events
    ws_actions = [
        ("broadcast", WebSocketEvent.create(Events.STOCK_UPDATED, "Stock", "Reserve", item.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ]
    if project:
        ws_actions.append(("broadcast", WebSocketEvent.create(Events.PROJECT_UPDATED, "Project", "Update", project.id)))
    if target_notif:
        ws_actions.append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", target_notif.id), {target_notif.recipient_id} if target_notif.recipient_id else set(), {target_notif.department} if target_notif.department else set(), set()))
    elif 'notif' in locals():
        ws_actions.append(("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id} if notif.recipient_id else set(), {notif.department} if notif.department else set(), set()))
    db.info.setdefault("ws_actions", []).extend(ws_actions)
    
    return reservation


async def issue_stock(
    db: AsyncSession, item_id: str, payload: StockIssueRequest, current_user: Employee
) -> StockItem:
    item = await _get_item(db, item_id)

    res_result = await db.execute(
        select(StockReservation).where(
            StockReservation.id == payload.reservation_id,
            StockReservation.stock_item_id == item_id,
            StockReservation.status == "Reserved",
        )
    )
    reservation = res_result.scalar_one_or_none()
    if not reservation:
        raise NotFoundError("Reservation")

    qty = Decimal(str(payload.quantity))
    if qty > reservation.quantity:
        raise BusinessRuleError(f"Cannot issue more than reserved quantity ({reservation.quantity})")

    reservation.status = "Issued"
    item.current_quantity -= qty
    item.reserved_quantity -= reservation.quantity
    db.add(reservation)
    db.add(item)

    txn = StockTransaction(
        stock_item_id=item.id,
        transaction_type="Issue",
        quantity=qty,
        project_id=reservation.project_id,
        notes=payload.notes,
        performed_by_id=current_user.id,
    )
    db.add(txn)

    from app.models.project import Project
    project_res = await db.execute(select(Project).where(Project.id == reservation.project_id))
    project = project_res.scalar_one_or_none()
    
    if project:
        project.warehouse_status = "Issued"
        db.add(project)

    # Notify requestor
    notif = Notification(
        title="Stock Issued",
        message=f"Warehouse issued {qty} of {item.product_name} for project {reservation.project_id}.",
        recipient_id=reservation.reserved_by_id,
        priority="Medium",
        category="Stock"
    )
    db.add(notif)
    
    await db.flush()
    await db.flush()
    
    from app.websocket.events import WebSocketEvent, Events
    ws_actions = [
        ("broadcast", WebSocketEvent.create(Events.STOCK_UPDATED, "Stock", "Issue", item.id)),
        ("send_to_authorized_users", WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id} if notif.recipient_id else set(), {notif.department} if notif.department else set(), set()),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ]
    if project:
        ws_actions.append(("broadcast", WebSocketEvent.create(Events.PROJECT_UPDATED, "Project", "Update", project.id)))
    db.info.setdefault("ws_actions", []).extend(ws_actions)
    
    await log_activity(
        db,
        actor=current_user.name,
        actor_id=current_user.id,
        department=current_user.department,
        action="Issued stock",
        entity=item.product_name,
        entity_type="Stock",
        entity_id=item.id,
        detail=f"Issued {qty} units for project {reservation.project_id}"
    )
    
    return item


async def return_stock(
    db: AsyncSession, item_id: str, payload: StockReturnRequest, current_user: Employee
) -> StockItem:
    item = await _get_item(db, item_id)
    qty = Decimal(str(payload.quantity))

    item.current_quantity += qty
    db.add(item)

    txn = StockTransaction(
        stock_item_id=item.id,
        transaction_type="Return",
        quantity=qty,
        project_id=payload.project_id,
        notes=payload.notes,
        performed_by_id=current_user.id,
    )
    db.add(txn)
    await db.flush()
    await db.flush()
    
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.STOCK_UPDATED, "Stock", "Return", item.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    
    return item


async def list_stock(
    db: AsyncSession,
    category: Optional[str] = None,
    low_stock_only: bool = False,
    offset: int = 0,
    limit: int = 100,
) -> tuple[List[StockItem], int]:
    q = select(StockItem).where(StockItem.is_active == True)
    if category:
        q = q.where(StockItem.category == category)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.offset(offset).limit(limit))
    items = result.scalars().all()

    if low_stock_only:
        items = [i for i in items if i.available_quantity <= i.minimum_level]

    return items, total
