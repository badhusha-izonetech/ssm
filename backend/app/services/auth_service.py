"""
Auth service — login, refresh, logout, me, change-password.
All business rules here; routes are thin.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import portal_for
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.employee import Employee
from app.schemas.auth import ChangePasswordRequest, LoginRequest, LoginResponse, RefreshRequest


async def login(db: AsyncSession, payload: LoginRequest) -> LoginResponse:
    result = await db.execute(
        select(Employee).where(Employee.username == payload.username, Employee.is_deleted == False)
    )
    employee = result.scalar_one_or_none()

    if not employee or not verify_password(payload.password, employee.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    if employee.employment_status != "Active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {employee.employment_status}. Please contact the administrator.",
        )

    access_token = create_access_token(employee.id)
    refresh_token = create_refresh_token(employee.id)

    from app.schemas.auth import EmployeeAuthProfile
    profile = EmployeeAuthProfile.model_validate(employee)

    return LoginResponse(
        employee=profile,
        portal=portal_for(employee.designation),
        access_token=access_token,
        refresh_token=refresh_token,
    )


async def refresh_tokens(db: AsyncSession, payload: RefreshRequest) -> dict:
    token_data = decode_token(payload.refresh_token)
    if token_data.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required",
        )
    employee_id = token_data.get("sub")
    result = await db.execute(
        select(Employee).where(Employee.id == employee_id, Employee.is_deleted == False)
    )
    employee = result.scalar_one_or_none()
    if not employee or employee.employment_status != "Active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    return {
        "access_token": create_access_token(employee.id),
        "refresh_token": create_refresh_token(employee.id),
        "token_type": "bearer",
    }


async def change_password(
    db: AsyncSession, employee: Employee, payload: ChangePasswordRequest
) -> None:
    if not verify_password(payload.current_password, employee.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    employee.hashed_password = hash_password(payload.new_password)
    db.add(employee)
