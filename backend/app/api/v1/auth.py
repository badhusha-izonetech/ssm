"""
Auth router.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.auth import ChangePasswordRequest, LoginRequest, RefreshRequest
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", summary="Login with username + password")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.login(db, payload)


@router.post("/refresh", summary="Refresh access token")
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.refresh_tokens(db, payload)


@router.post("/logout", summary="Logout (client-side token discard)")
async def logout():
    return {"success": True, "message": "Logged out. Please discard your tokens."}


@router.get("/me", summary="Get current user profile")
async def me(current_user=Depends(get_current_user)):
    from app.core.permissions import portal_for
    from app.schemas.auth import EmployeeAuthProfile, LoginResponse
    profile = EmployeeAuthProfile.model_validate(current_user)
    return {"employee": profile, "portal": portal_for(current_user.designation)}


@router.post("/change-password", summary="Change own password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await auth_service.change_password(db, current_user, payload)
    return {"success": True, "message": "Password changed"}
