"""
Revenue service — calculates realized revenue from accountant-verified payments.

Business rule:
  A project is "Fully Paid" only when the sum of all Verified payments
  reaches 100% of the project_value.  Revenue is counted exactly ONCE,
  on the date the final payment pushed the running total to 100%.
"""

from __future__ import annotations

from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Payment
from app.models.project import Project


def _date_key(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return dt.strftime("%Y-%m-%d")


async def get_revenue_data(
    db: AsyncSession,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> dict:
    """
    Return full revenue summary + per-project breakdown.

    date_from / date_to (YYYY-MM-DD) filter by the project's "fully_paid_date"
    — the date the LAST payment that completed 100% coverage was verified.
    """

    # ── Load all projects and their verified payments in one query set ──────────
    proj_res = await db.execute(select(Project).where(Project.is_deleted == False))
    projects = proj_res.scalars().all()

    pay_res = await db.execute(
        select(Payment)
        .where(Payment.state == "Verified")
        .order_by(Payment.verified_at.asc())
    )
    verified_payments: list[Payment] = list(pay_res.scalars().all())

    # Group verified payments by project
    by_project: dict[str, list[Payment]] = {}
    for p in verified_payments:
        by_project.setdefault(p.project_id, []).append(p)

    # ── Per-project revenue calculation ─────────────────────────────────────────
    rows: list[dict] = []

    for project in projects:
        project_value = float(project.project_value or 0)

        proj_payments = by_project.get(project.id, [])

        # Total of ALL non-rejected payments (amount received)
        all_pay_res = await db.execute(
            select(Payment).where(
                Payment.project_id == project.id,
                Payment.state.not_in(["Rejected"]),
            )
        )
        all_payments = all_pay_res.scalars().all()
        amount_received = sum(float(p.actual_amount or 0) for p in all_payments)

        # If project_value was never set (quotation had ₹0 grand_total),
        # fall back to the total of all verified payments so revenue is still counted.
        if project_value <= 0:
            fallback = sum(float(p.actual_amount or 0) for p in proj_payments)
            if fallback <= 0:
                continue  # truly no data, skip
            project_value = fallback

        # Accountant-verified amount
        verified_amount = sum(float(p.actual_amount or 0) for p in proj_payments)
        verified_pct = min(100.0, (verified_amount / project_value * 100)) if project_value else 0.0

        # Find "fully_paid_date" — the verified_at of the payment that first
        # pushed the running total to >= 100%
        running = 0.0
        fully_paid_date: Optional[str] = None
        final_verifier: Optional[str] = None
        for pmt in sorted(proj_payments, key=lambda x: (x.verified_at or datetime.min)):
            running += float(pmt.actual_amount or 0)
            if running >= project_value:
                fully_paid_date = _date_key(pmt.verified_at)
                final_verifier = pmt.verified_by
                break

        is_fully_paid = verified_pct >= 100.0
        pending_amount = max(0.0, project_value - verified_amount)
        revenue = project_value if is_fully_paid else 0.0

        rows.append(
            {
                "project_id": project.id,
                "project_code": project.project_code,
                "customer_name": project.customer_name,
                "project_value": project_value,
                "amount_received": amount_received,
                "verified_amount": verified_amount,
                "pending_amount": pending_amount,
                "verified_pct": round(verified_pct, 2),
                "is_fully_paid": is_fully_paid,
                "fully_paid_date": fully_paid_date,
                "final_verifier": final_verifier,
                "revenue": revenue,
                "payment_status": "Fully Paid" if is_fully_paid else (
                    "Partially Paid" if verified_amount > 0 else "Pending"
                ),
            }
        )

    # ── Apply date filter on fully_paid_date ────────────────────────────────────
    def _in_range(row: dict) -> bool:
        fp = row["fully_paid_date"]
        if not row["is_fully_paid"] or fp is None:
            return False
        if date_from and fp < date_from:
            return False
        if date_to and fp > date_to:
            return False
        return True

    filtered_rows = [r for r in rows if _in_range(r)]

    # ── Summary cards ────────────────────────────────────────────────────────────
    total_revenue = sum(r["revenue"] for r in filtered_rows)
    total_collections = sum(r["amount_received"] for r in rows)  # all time
    pending_receivables = sum(r["pending_amount"] for r in rows if not r["is_fully_paid"])
    fully_paid_count = len(filtered_rows)
    partially_paid_count = sum(1 for r in rows if not r["is_fully_paid"] and r["verified_amount"] > 0)

    # ── Date-wise revenue (for chart) ────────────────────────────────────────────
    daily: dict[str, float] = {}
    for r in filtered_rows:
        key = r["fully_paid_date"]
        if key:
            daily[key] = daily.get(key, 0.0) + r["revenue"]
    daily_data = [{"date": k, "revenue": v} for k, v in sorted(daily.items())]

    return {
        "summary": {
            "total_revenue": total_revenue,
            "total_collections": total_collections,
            "pending_receivables": pending_receivables,
            "fully_paid_projects": fully_paid_count,
            "partially_paid_projects": partially_paid_count,
        },
        "projects": filtered_rows,
        "daily": daily_data,
        "all_projects": rows,  # includes partial/pending for UI monitoring
    }
