from pydantic import BaseModel, Field
from datetime import date, datetime
from decimal import Decimal


class EmployeeDailyExpenseBase(BaseModel):
    expense_date: date = Field(..., description="Date of the expense")
    amount: Decimal = Field(ge=0, description="Expense amount")
    description: str = Field(..., description="Description or category of the expense")
    proof_url: str | None = Field(None, description="URL of the proof document")


class EmployeeDailyExpenseCreate(EmployeeDailyExpenseBase):
    employee_id: str = Field(..., description="Employee ID")


class EmployeeDailyExpenseUpdate(EmployeeDailyExpenseBase):
    pass


class EmployeeDailyExpenseResponse(EmployeeDailyExpenseBase):
    id: str
    employee_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
