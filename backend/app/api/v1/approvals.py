"""
Remaining routers: approvals, leave, performance, notifications, activity, dashboard, reports,
follow_ups (stub — served via leads router).
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import Permission, require_permissions
from app.core.security import get_current_user

# ── Approvals ─────────────────────────────────────────────────────────────────
router_approvals = APIRouter(prefix="/approvals", tags=["Approvals"])

from app.schemas.notification import ApprovalCreate, ApprovalDecision, ApprovalRead
from app.services import approval_service
from app.utils.pagination import PagedResponse, PaginationParams


@router_approvals.get("", response_model=PagedResponse[ApprovalRead])
async def list_approvals(
    status: Optional[str] = Query(None),
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.APPROVALS_READ)),
):
    items, total = await approval_service.list_approvals(db, status, params.offset, params.limit)
    return PagedResponse.create([ApprovalRead.model_validate(a) for a in items], total, params)


@router_approvals.post("", response_model=ApprovalRead, status_code=201)
async def create_approval(
    payload: ApprovalCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.APPROVALS_WRITE)),
):
    a = await approval_service.create_approval(db, payload, current_user)
    return ApprovalRead.model_validate(a)


@router_approvals.patch("/{approval_id}/approve", response_model=ApprovalRead)
async def approve(
    approval_id: str,
    payload: ApprovalDecision,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.APPROVALS_WRITE)),
):
    a = await approval_service.approve(db, approval_id, payload, current_user)
    return ApprovalRead.model_validate(a)


@router_approvals.patch("/{approval_id}/reject", response_model=ApprovalRead)
async def reject(
    approval_id: str,
    payload: ApprovalDecision,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.APPROVALS_WRITE)),
):
    a = await approval_service.reject(db, approval_id, payload, current_user)
    return ApprovalRead.model_validate(a)


# ── Leave ─────────────────────────────────────────────────────────────────────
router_leave = APIRouter(prefix="/leave", tags=["Leave"])

from app.schemas.notification import LeaveCreate, LeaveDecision, LeaveRead
from app.services import leave_service


@router_leave.get("", response_model=PagedResponse[LeaveRead])
async def list_leave(
    status: Optional[str] = Query(None),
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.LEAVE_READ)),
):
    items, total = await leave_service.list_leaves(db, current_user, status, params.offset, params.limit)
    return PagedResponse.create([LeaveRead.model_validate(l) for l in items], total, params)


@router_leave.post("", response_model=LeaveRead, status_code=201)
async def submit_leave(
    payload: LeaveCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.LEAVE_WRITE)),
):
    l = await leave_service.submit_leave(db, payload, current_user)
    return LeaveRead.model_validate(l)


@router_leave.patch("/{leave_id}/approve", response_model=LeaveRead)
async def approve_leave(
    leave_id: str,
    payload: LeaveDecision,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.LEAVE_APPROVE)),
):
    l = await leave_service.approve_leave(db, leave_id, payload, current_user)
    return LeaveRead.model_validate(l)


@router_leave.patch("/{leave_id}/reject", response_model=LeaveRead)
async def reject_leave(
    leave_id: str,
    payload: LeaveDecision,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.LEAVE_APPROVE)),
):
    l = await leave_service.reject_leave(db, leave_id, payload, current_user)
    return LeaveRead.model_validate(l)


# ── Performance ───────────────────────────────────────────────────────────────
router_performance = APIRouter(prefix="/performance", tags=["Performance"])

from app.schemas.notification import PerformanceCreate, PerformanceRead
from app.services.call_log_service import create_performance, list_performance


@router_performance.get("", response_model=PagedResponse[PerformanceRead])
async def list_perf(
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.PERFORMANCE_READ)),
):
    items, total = await list_performance(db, params.offset, params.limit)
    return PagedResponse.create([PerformanceRead.model_validate(p) for p in items], total, params)


@router_performance.post("", response_model=PerformanceRead, status_code=201)
async def create_perf(
    payload: PerformanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.PERFORMANCE_READ)),
):
    p = await create_performance(db, payload, current_user)
    return PerformanceRead.model_validate(p)


# ── Notifications ─────────────────────────────────────────────────────────────
router_notifications = APIRouter(prefix="/notifications", tags=["Notifications"])

from app.schemas.notification import NotificationRead
from app.services.call_log_service import list_notifications, mark_read, mark_all_read


@router_notifications.get("", response_model=PagedResponse[NotificationRead])
async def list_notifs(
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.NOTIFICATIONS_READ)),
):
    items, total = await list_notifications(db, current_user, params.offset, params.limit)
    return PagedResponse.create([NotificationRead.model_validate(n) for n in items], total, params)


@router_notifications.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.NOTIFICATIONS_READ)),
):
    await mark_read(db, notification_id)
    return {"success": True}


@router_notifications.patch("/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.NOTIFICATIONS_READ)),
):
    await mark_all_read(db, current_user)
    return {"success": True}


@router_notifications.delete("/clear-all")
async def clear_all_notifications_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.NOTIFICATIONS_READ)),
):
    from app.services.call_log_service import clear_all_notifications
    await clear_all_notifications(db, current_user)
    return {"success": True}


# ── Activity ──────────────────────────────────────────────────────────────────
router_activity = APIRouter(prefix="/activity", tags=["Activity"])

from app.schemas.notification import ActivityLogRead
from app.services.call_log_service import list_activity


@router_activity.get("", response_model=PagedResponse[ActivityLogRead])
async def list_activity_logs(
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.ACTIVITY_READ)),
):
    items, total = await list_activity(db, params.offset, params.limit)
    return PagedResponse.create([ActivityLogRead.model_validate(a) for a in items], total, params)


# ── Dashboard ─────────────────────────────────────────────────────────────────
router_dashboard = APIRouter(prefix="/dashboard", tags=["Dashboard"])

from app.schemas.dashboard import CEODashboard, MarketingDashboard
from app.services import dashboard_service


@router_dashboard.get("/overview", response_model=CEODashboard)
async def ceo_dashboard(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.DASHBOARD_CEO)),
):
    return await dashboard_service.get_ceo_dashboard(db)


@router_dashboard.get("/marketing", response_model=MarketingDashboard)
async def marketing_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permissions(Permission.DASHBOARD_MARKETING)),
):
    return await dashboard_service.get_marketing_dashboard(db, current_user)


# ── Reports ───────────────────────────────────────────────────────────────────
router_reports = APIRouter(prefix="/reports", tags=["Reports"])

from app.schemas.dashboard import ReportSummary


@router_reports.get("", response_model=ReportSummary)
async def reports(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permissions(Permission.REPORTS_READ)),
):
    return await dashboard_service.get_reports(db)


# ── Follow-ups stub ───────────────────────────────────────────────────────────
router_follow_ups = APIRouter(prefix="/follow-ups", tags=["Follow Ups"])


@router_follow_ups.get("", include_in_schema=False)
async def follow_up_redirect():
    """Follow-ups are served via GET /leads/follow-ups. This stub exists for discoverability."""
    return {"message": "Use GET /api/v1/leads/follow-ups"}
