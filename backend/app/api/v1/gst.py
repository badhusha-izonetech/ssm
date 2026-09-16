from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.invoice import Invoice
from app.models.gst_period import GSTPeriod
from app.models.customer import Customer
from app.models.quotation import Quotation
from app.schemas.gst import GSTPeriodResponse, GSTSummary, InvoiceGSTEntry

from datetime import datetime, date, timedelta
from typing import Literal
import calendar

router = APIRouter(prefix="/gst", tags=["GST"])

def _get_date_range(period_type: str) -> tuple[str, str, str]:
    today = date.today()
    if period_type == "weekly":
        # Current week (Monday to Sunday)
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
        label = f"Week of {start.strftime('%d %b %Y')}"
    elif period_type == "monthly":
        start = today.replace(day=1)
        _, last_day = calendar.monthrange(today.year, today.month)
        end = today.replace(day=last_day)
        label = start.strftime("%B %Y")
    else: # yearly
        # Assuming financial year April to March or calendar year? Let's use calendar year for now.
        start = today.replace(month=1, day=1)
        end = today.replace(month=12, day=31)
        label = str(today.year)
        
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"), label

@router.get("/summary")
async def get_gst_summary(db: AsyncSession = Depends(get_db)):
    # Returns weekly, monthly, yearly
    summaries = []
    for p_type in ["weekly", "monthly", "yearly"]:
        start, end, label = _get_date_range(p_type)
        
        # Valid invoices generated in this period
        result = await db.scalars(
            select(Invoice)
            .where(Invoice.status == "Generated")
            .where(Invoice.issue_date >= start)
            .where(Invoice.issue_date <= end)
        )
        invoices = result.all()
        
        taxable_amount = sum(float(i.taxable_amount or 0) for i in invoices)
        gst_payable = sum(float(i.gst_amount or 0) for i in invoices)
        invoice_total = sum(float(i.grand_total or 0) for i in invoices)
        
        summaries.append(GSTSummary(
            label=label,
            period_start=start,
            period_end=end,
            total_invoices=len(invoices),
            taxable_amount=taxable_amount,
            gst_payable=gst_payable,
            invoice_total=invoice_total
        ))
        
    return summaries

@router.get("/reports/{period_type}/invoices", response_model=list[InvoiceGSTEntry])
async def get_gst_register(
    period_type: str, 
    from_date: str = None, 
    to_date: str = None, 
    db: AsyncSession = Depends(get_db)
):
    if period_type == "custom" and from_date and to_date:
        start = from_date
        end = to_date
    else:
        start, end, _ = _get_date_range(period_type)
    
    result = await db.scalars(
        select(Invoice)
        .where(Invoice.status == "Generated")
        .where(Invoice.issue_date >= start)
        .where(Invoice.issue_date <= end)
    )
    invoices = result.all()
    
    entries = []
    for inv in invoices:
        customer_name = "Unknown"
        if inv.quotation_id:
            quotation = await db.get(Quotation, inv.quotation_id)
            if quotation:
                customer_name = quotation.customer_name
                
        entries.append(InvoiceGSTEntry(
            id=inv.id,
            invoice_number=inv.invoice_number,
            customer_name=customer_name,
            issue_date=inv.issue_date or "",
            taxable_amount=float(inv.taxable_amount),
            gst_percent=float(inv.gst_percent),
            gst_amount=float(inv.gst_amount),
            grand_total=float(inv.grand_total)
        ))
    return entries

@router.get("/periods", response_model=list[GSTPeriodResponse])
async def get_gst_periods(db: AsyncSession = Depends(get_db)):
    result = await db.scalars(select(GSTPeriod).order_by(GSTPeriod.period_month.desc()))
    return result.all()

@router.post("/periods/{period_month}/mark-paid")
async def mark_gst_paid(period_month: str, db: AsyncSession = Depends(get_db)):
    period = await db.scalar(select(GSTPeriod).where(GSTPeriod.period_month == period_month))
    if not period:
        # Create it if it doesn't exist
        # Calculate totals from invoices
        start = f"{period_month}-01"
        try:
            year, month = map(int, period_month.split("-"))
            _, last_day = calendar.monthrange(year, month)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid period_month format. Must be YYYY-MM")
        end = f"{period_month}-{last_day:02d}"
        
        result = await db.scalars(
            select(Invoice)
            .where(Invoice.status == "Generated")
            .where(Invoice.issue_date >= start)
            .where(Invoice.issue_date <= end)
        )
        invoices = result.all()
        
        period = GSTPeriod(
            period_month=period_month,
            total_invoices=len(invoices),
            taxable_amount=sum(float(i.taxable_amount or 0) for i in invoices),
            gst_payable=sum(float(i.gst_amount or 0) for i in invoices),
            invoice_total=sum(float(i.grand_total or 0) for i in invoices),
            is_paid=True,
            paid_date=datetime.utcnow()
        )
        db.add(period)
    else:
        period.is_paid = True
        period.paid_date = datetime.utcnow()
        
    # Mark existing GST payment reminders as read
    from app.models.notification import Notification
    from sqlalchemy import update
    await db.execute(
        update(Notification)
        .where(Notification.title == "GST PAYMENT REMINDER")
        .where(Notification.message.like(f"%{period_month}%"))
        .values(is_read=True)
    )
        
    await db.commit()
    return {"status": "success", "period": period.period_month, "is_paid": period.is_paid}
