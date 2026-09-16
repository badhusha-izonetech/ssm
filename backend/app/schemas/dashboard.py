"""
Dashboard schemas — CEO overview, Marketing dashboard, Reports.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class KPICard(BaseModel):
    label: str
    value: Any
    unit: Optional[str] = None


class ChartPoint(BaseModel):
    label: str
    value: Decimal


class CEODashboard(BaseModel):
    # KPIs
    total_pipeline_value: Decimal
    outstanding_balance: Decimal
    active_project_count: int
    delayed_count: int
    issue_raised_count: int
    lead_conversion_rate: Decimal
    low_stock_count: int
    pending_approvals_count: int
    this_month_verified_payments: Decimal
    active_employee_count: int
    on_field_count: int

    # Charts
    projects_by_stage: List[ChartPoint]
    leads_by_source: List[ChartPoint]

    # Attention Lists
    attention_projects: List[Dict[str, Any]] = []
    attention_stock_items: List[Dict[str, Any]] = []


class MarketingDashboard(BaseModel):
    new_leads: int
    follow_up_leads: int
    converted_leads: int
    conversion_rate: Decimal
    own_quotation_count: int
    recent_leads: List[Dict[str, Any]] = []


class ReportSummary(BaseModel):
    project_value_by_area: List[ChartPoint]
    payment_total_by_state: List[ChartPoint]
    monthly_verified_collections: List[ChartPoint]
    won_lead_count: int
