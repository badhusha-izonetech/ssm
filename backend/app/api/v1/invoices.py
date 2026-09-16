from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.invoice import Invoice
from app.schemas.invoice import InvoiceCreate, InvoiceResponse, InvoiceUpdate, InvoiceSyncRequest
from app.utils.invoice_number import generate_invoice_number

router = APIRouter(prefix="/invoices", tags=["Invoices"])

@router.get("/next-number")
async def get_next_invoice_number(db: AsyncSession = Depends(get_db)):
    """Returns the next sequential invoice number for the current year."""
    next_num = await generate_invoice_number(db)
    return {"next_invoice_number": next_num}

@router.post("/resequence")
async def resequence_invoices(db: AsyncSession = Depends(get_db)):
    """
    Re-sequences all existing invoices chronologically (created_at) per year
    to ensure continuous non-repeating sequence (e.g. SSC-INV-2026-0001, SSC-INV-2026-0002...).
    """
    result = await db.scalars(select(Invoice).order_by(Invoice.created_at.asc()))
    invoices = result.all()
    
    # Group by year
    from datetime import datetime, timezone
    year_counters: dict[int, int] = {}
    
    for inv in invoices:
        year = inv.created_at.year if inv.created_at else datetime.now(timezone.utc).year
        counter = year_counters.get(year, 0) + 1
        year_counters[year] = counter
        new_inv_num = f"SSC-INV-{year}-{counter:04d}"
        inv.invoice_number = new_inv_num
        
    await db.commit()
    
    result_updated = await db.scalars(select(Invoice).order_by(Invoice.created_at.desc()))
    return result_updated.all()

@router.get("/", response_model=list[InvoiceResponse])
async def get_invoices(db: AsyncSession = Depends(get_db)):
    result = await db.scalars(select(Invoice).order_by(Invoice.created_at.desc()))
    return result.all()

@router.post("/", response_model=InvoiceResponse)
async def create_invoice(invoice: InvoiceCreate, db: AsyncSession = Depends(get_db)):
    inv_dict = invoice.model_dump()
    
    # If invoice_number is empty or already exists, generate next continuous number
    if not inv_dict.get("invoice_number"):
        inv_dict["invoice_number"] = await generate_invoice_number(db)
    else:
        existing = await db.scalar(select(Invoice).where(Invoice.invoice_number == inv_dict["invoice_number"]))
        if existing:
            # Generate next non-colliding continuous number
            inv_dict["invoice_number"] = await generate_invoice_number(db)
    
    db_invoice = Invoice(**inv_dict)
    db.add(db_invoice)
    await db.commit()
    await db.refresh(db_invoice)
    
    # Trigger employee revenue attribution
    from app.services.employee_revenue_service import generate_revenue_for_invoice
    await generate_revenue_for_invoice(db, db_invoice.id)
    
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.INVOICE_CREATED, "Invoice", "Create", db_invoice.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    
    return db_invoice

@router.put("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(invoice_id: str, updates: InvoiceUpdate, db: AsyncSession = Depends(get_db)):
    db_invoice = await db.get(Invoice, invoice_id)
    if not db_invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_invoice, key, value)
        
    await db.commit()
    await db.refresh(db_invoice)
    
    from app.websocket.events import WebSocketEvent, Events
    db.info.setdefault("ws_actions", []).extend([
        ("broadcast", WebSocketEvent.create(Events.INVOICE_UPDATED, "Invoice", "Update", db_invoice.id)),
        ("broadcast", WebSocketEvent.create(Events.DASHBOARD_UPDATED, "Dashboard", "Update"))
    ])
    
    return db_invoice

@router.post("/bulk-sync", response_model=list[InvoiceResponse])
async def bulk_sync_invoices(request: InvoiceSyncRequest, db: AsyncSession = Depends(get_db)):
    """Syncs localStorage invoices to the database if they don't already exist."""
    synced = []
    for inv_data in request.invoices:
        existing = await db.scalar(select(Invoice).where(Invoice.invoice_number == inv_data.invoice_number))
        if not existing:
            db_invoice = Invoice(**inv_data.model_dump())
            db.add(db_invoice)
            synced.append(db_invoice)
    await db.commit()
    
    from app.services.employee_revenue_service import generate_revenue_for_invoice
    for inv in synced:
        await db.refresh(inv)
        await generate_revenue_for_invoice(db, inv.id)
        
    result = await db.scalars(select(Invoice).order_by(Invoice.created_at.desc()))
    return result.all()

