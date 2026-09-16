"""
Main v1 router — aggregates all resource routers under /api/v1.
"""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.employees import router as employees_router
from app.api.v1.departments import router as departments_router
from app.api.v1.customers import router as customers_router
from app.api.v1.leads import router as leads_router
from app.api.v1.call_logs import router as call_logs_router
from app.api.v1.field_movements import router as field_movements_router
from app.api.v1.site_visits import router as site_visits_router
from app.api.v1.quotations import router as quotations_router
from app.api.v1.projects import router as projects_router
from app.api.v1.payments import router as payments_router
from app.api.v1.stock import router as stock_router
from app.api.v1.approvals import (
    router_approvals,
    router_leave,
    router_performance,
    router_notifications,
    router_activity,
    router_dashboard,
    router_reports,
    router_follow_ups,
)
from app.api.v1.attendance import router as attendance_router
from app.api.v1.revenue import router as revenue_router
from app.api.v1.invoices import router as invoices_router
from app.api.v1.gst import router as gst_router
from app.api.v1.eb_applications import router as eb_applications_router
from app.api.v1.products import router as products_router
from app.api.v1.employee_financials import router as employee_financials_router
from app.api.v1.report_exports import router as report_exports_router
from app.api.v1.websocket import router as websocket_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(websocket_router)
api_router.include_router(employees_router)
api_router.include_router(departments_router)
api_router.include_router(customers_router)
api_router.include_router(leads_router)
api_router.include_router(call_logs_router)
api_router.include_router(field_movements_router)
api_router.include_router(site_visits_router)
api_router.include_router(quotations_router)
api_router.include_router(projects_router)
api_router.include_router(payments_router)
api_router.include_router(stock_router)
api_router.include_router(products_router)
api_router.include_router(router_approvals)
api_router.include_router(router_leave)
api_router.include_router(router_performance)
api_router.include_router(router_notifications)
api_router.include_router(router_activity)
api_router.include_router(router_dashboard)
api_router.include_router(router_reports)
api_router.include_router(router_follow_ups)
api_router.include_router(attendance_router)
api_router.include_router(revenue_router)
api_router.include_router(invoices_router)
api_router.include_router(gst_router)
api_router.include_router(eb_applications_router)
api_router.include_router(employee_financials_router)
api_router.include_router(report_exports_router)

