"""
Auth schemas — login request/response compatible with AuthContext.tsx hydration.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class EmployeeAuthProfile(BaseModel):
    id: str
    employee_code: str
    name: str
    username: str
    department: str
    designation: str
    employment_status: str
    avatar_color: Optional[str] = None
    location: Optional[str] = None
    mobile: str
    email: Optional[str] = None

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    """Shape that AuthContext.tsx uses to hydrate the app."""
    employee: EmployeeAuthProfile
    portal: Optional[str] = None      # "CEO" | "Telecalling" | "Direct Marketing" | None
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
