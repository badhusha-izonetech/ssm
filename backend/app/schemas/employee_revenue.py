from typing import List
from pydantic import BaseModel

class EmployeeRevenueProjectDetail(BaseModel):
    project_id: str
    project_name: str
    invoice_id: str
    invoice_number: str
    invoice_date: str
    revenue: float

class EmployeeRevenueDetail(BaseModel):
    employee_id: str
    employee_name: str
    department: str
    designation: str
    total_revenue: float
    projects: List[EmployeeRevenueProjectDetail]

class EmployeeRevenueSummaryItem(BaseModel):
    employee_id: str
    employee_name: str
    department: str
    designation: str
    total_revenue: float
