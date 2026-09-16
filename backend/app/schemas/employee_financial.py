from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.employee import EmployeeRead

class EmployeeFinancialBase(BaseModel):
    financial_month: str = Field(..., description="Financial month in YYYY-MM format")
    salary: Decimal = Field(ge=0, default=0, description="Employee salary")

class EmployeeFinancialCreate(EmployeeFinancialBase):
    employee_id: str = Field(..., description="Employee ID")

class EmployeeFinancialUpdate(EmployeeFinancialBase):
    pass

class EmployeeFinancialResponse(EmployeeFinancialBase):
    id: str
    employee_id: str
    expenses: Decimal = Field(ge=0, default=0, description="Calculated total expenses")
    
    model_config = ConfigDict(from_attributes=True)

class EmployeeFinancialListResponse(EmployeeFinancialResponse):
    employee: EmployeeRead
    
    model_config = ConfigDict(from_attributes=True)
