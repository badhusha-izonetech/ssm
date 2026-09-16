"""
Employee Financials API.
Accountant can read and write. CEO can only read.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Form, File, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user_query
from app.core.permissions import Permission, require_permissions
from app.models.employee_financial import EmployeeFinancial
from app.models.employee_daily_expense import EmployeeDailyExpense
from app.models.employee import Employee
from app.schemas.employee_financial import (
    EmployeeFinancialCreate,
    EmployeeFinancialUpdate,
    EmployeeFinancialResponse,
    EmployeeFinancialListResponse,
)
from app.schemas.employee_daily_expense import (
    EmployeeDailyExpenseCreate,
    EmployeeDailyExpenseUpdate,
    EmployeeDailyExpenseResponse,
)
from app.services import storage_service
from datetime import date
from decimal import Decimal

router = APIRouter(prefix="/employee-financials", tags=["Employee Financials"])

_read = require_permissions(Permission.EMPLOYEE_FINANCIAL_READ)
_write = require_permissions(Permission.EMPLOYEE_FINANCIAL_WRITE)


@router.get("", response_model=list[EmployeeFinancialListResponse])
async def list_financials(
    month: str = Query(..., description="Financial month in YYYY-MM format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(_read),
):
    stmt = select(EmployeeFinancial).where(EmployeeFinancial.financial_month == month).options(selectinload(EmployeeFinancial.employee))
    result = await db.execute(stmt)
    financials = result.scalars().all()
    
    exp_stmt = select(
        EmployeeDailyExpense.employee_id,
        func.sum(EmployeeDailyExpense.amount).label("total")
    ).where(
        func.to_char(EmployeeDailyExpense.expense_date, 'YYYY-MM') == month
    ).group_by(EmployeeDailyExpense.employee_id)
    
    exp_result = await db.execute(exp_stmt)
    exp_map = {row.employee_id: row.total for row in exp_result}
    
    for f in financials:
        f.expenses = exp_map.get(f.employee_id, 0)
        
    return financials


@router.get("/{employee_id}", response_model=EmployeeFinancialResponse | None)
async def get_financial(
    employee_id: str,
    month: str = Query(..., description="Financial month in YYYY-MM format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(_read),
):
    stmt = select(EmployeeFinancial).where(
        EmployeeFinancial.employee_id == employee_id,
        EmployeeFinancial.financial_month == month
    )
    result = await db.execute(stmt)
    financial = result.scalar_one_or_none()
    
    if financial:
        exp_stmt = select(func.sum(EmployeeDailyExpense.amount)).where(
            EmployeeDailyExpense.employee_id == employee_id,
            func.to_char(EmployeeDailyExpense.expense_date, 'YYYY-MM') == month
        )
        exp_result = await db.execute(exp_stmt)
        financial.expenses = exp_result.scalar_one_or_none() or 0
        
    return financial


@router.post("", response_model=EmployeeFinancialResponse, status_code=status.HTTP_201_CREATED)
async def create_financial(
    payload: EmployeeFinancialCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(_write),
):
    emp_stmt = select(Employee).where(Employee.id == payload.employee_id)
    emp_result = await db.execute(emp_stmt)
    if not emp_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Employee not found")

    stmt = select(EmployeeFinancial).where(
        EmployeeFinancial.employee_id == payload.employee_id,
        EmployeeFinancial.financial_month == payload.financial_month
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Financial record already exists for this employee and month. Use PUT to update.",
        )
        
    financial = EmployeeFinancial(
        employee_id=payload.employee_id,
        financial_month=payload.financial_month,
        salary=payload.salary,
    )
    db.add(financial)
    await db.commit()
    await db.refresh(financial)
    financial.expenses = 0
    return financial


@router.put("/{employee_id}", response_model=EmployeeFinancialResponse)
async def update_financial(
    employee_id: str,
    payload: EmployeeFinancialUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(_write),
):
    stmt = select(EmployeeFinancial).where(
        EmployeeFinancial.employee_id == employee_id,
        EmployeeFinancial.financial_month == payload.financial_month
    )
    result = await db.execute(stmt)
    financial = result.scalar_one_or_none()
    
    if not financial:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee financial record not found for the given month",
        )
        
    financial.salary = payload.salary
    await db.commit()
    await db.refresh(financial)
    
    exp_stmt = select(func.sum(EmployeeDailyExpense.amount)).where(
        EmployeeDailyExpense.employee_id == employee_id,
        func.to_char(EmployeeDailyExpense.expense_date, 'YYYY-MM') == payload.financial_month
    )
    exp_result = await db.execute(exp_stmt)
    financial.expenses = exp_result.scalar_one_or_none() or 0
    
    return financial


@router.get("/{employee_id}/expenses", response_model=list[EmployeeDailyExpenseResponse])
async def list_daily_expenses(
    employee_id: str,
    month: str = Query(..., description="Financial month in YYYY-MM format"),
    db: AsyncSession = Depends(get_db),
    _=Depends(_read),
):
    stmt = select(EmployeeDailyExpense).where(
        EmployeeDailyExpense.employee_id == employee_id,
        func.to_char(EmployeeDailyExpense.expense_date, 'YYYY-MM') == month
    ).order_by(EmployeeDailyExpense.expense_date)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/expenses", response_model=EmployeeDailyExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_daily_expense(
    employee_id: str = Form(...),
    expense_date: date = Form(...),
    amount: Decimal = Form(...),
    description: str = Form(...),
    proof: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(_write),
):
    proof_url = None
    if proof:
        proof_url = await storage_service.upload_file(proof, folder="expenses")

    expense = EmployeeDailyExpense(
        employee_id=employee_id,
        expense_date=expense_date,
        amount=amount,
        description=description,
        proof_url=proof_url,
    )
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return expense

@router.get("/expenses/{expense_id}/proof")
async def get_expense_proof(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user_query),
):
    from app.core.permissions import get_permissions
    if Permission.EMPLOYEE_FINANCIAL_READ not in get_permissions(current_user.designation):
        raise HTTPException(status_code=403, detail="Not authorized to view expense proofs")

    stmt = select(EmployeeDailyExpense).where(EmployeeDailyExpense.id == expense_id)
    result = await db.execute(stmt)
    expense = result.scalar_one_or_none()
    
    if not expense or not expense.proof_url:
        raise HTTPException(status_code=404, detail="Proof not found")
        
    url = await storage_service.get_presigned_url(expense.proof_url)
    if not url:
        raise HTTPException(status_code=500, detail="Could not generate proof URL")
        
    return RedirectResponse(url)


@router.put("/expenses/{expense_id}", response_model=EmployeeDailyExpenseResponse)
async def update_daily_expense(
    expense_id: str,
    payload: EmployeeDailyExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(_write),
):
    stmt = select(EmployeeDailyExpense).where(EmployeeDailyExpense.id == expense_id)
    result = await db.execute(stmt)
    expense = result.scalar_one_or_none()
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
        
    expense.expense_date = payload.expense_date
    expense.amount = payload.amount
    expense.description = payload.description
    
    await db.commit()
    await db.refresh(expense)
    return expense


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_daily_expense(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(_write),
):
    stmt = select(EmployeeDailyExpense).where(EmployeeDailyExpense.id == expense_id)
    result = await db.execute(stmt)
    expense = result.scalar_one_or_none()
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
        
    await db.delete(expense)
    await db.commit()

