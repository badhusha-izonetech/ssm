from datetime import date
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import Permission, require_permissions
from app.services import pdf_report_service

router = APIRouter(prefix="/reports", tags=["Reports Exports"])

_read = require_permissions(Permission.REPORTS_READ)

@router.get("/ctc/export")
async def export_ctc_report(
    from_date: date,
    to_date: date,
    db: AsyncSession = Depends(get_db),
    _=Depends(_read),
):
    buffer = await pdf_report_service.generate_ctc_report(db, from_date, to_date)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=CEO_CTC_Report_{from_date}_to_{to_date}.pdf"}
    )

@router.get("/gst/export")
async def export_gst_report(
    from_date: date,
    to_date: date,
    db: AsyncSession = Depends(get_db),
    _=Depends(_read),
):
    buffer = await pdf_report_service.generate_gst_report(db, from_date, to_date)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=CEO_GST_Report_{from_date}_to_{to_date}.pdf"}
    )

@router.get("/revenue/export")
async def export_revenue_report(
    from_date: date,
    to_date: date,
    db: AsyncSession = Depends(get_db),
    _=Depends(_read),
):
    buffer = await pdf_report_service.generate_revenue_report(db, from_date, to_date)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=CEO_Revenue_Report_{from_date}_to_{to_date}.pdf"}
    )

@router.get("/employee-revenue/export")
async def export_employee_revenue_report(
    from_date: date,
    to_date: date,
    db: AsyncSession = Depends(get_db),
    _=Depends(_read),
):
    buffer = await pdf_report_service.generate_employee_revenue_report(db, from_date, to_date)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=CEO_Employee_Revenue_Report_{from_date}_to_{to_date}.pdf"}
    )

@router.get("/stock/export")
async def export_stock_report(
    from_date: date,
    to_date: date,
    db: AsyncSession = Depends(get_db),
    _=Depends(_read),
):
    buffer = await pdf_report_service.generate_stock_report(db, from_date, to_date)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=CEO_Stock_Report_{from_date}_to_{to_date}.pdf"}
    )

@router.get("/existing-customers/export")
async def export_existing_customers_report(
    from_date: date,
    to_date: date,
    db: AsyncSession = Depends(get_db),
    _=Depends(_read),
):
    buffer = await pdf_report_service.generate_existing_customers_report(db, from_date, to_date)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=CEO_Existing_Customers_Report_{from_date}_to_{to_date}.pdf"}
    )
