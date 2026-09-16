"""
Employees router — CEO only.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, File, UploadFile, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import Permission, require_permissions
from app.core.security import get_current_user_query
from app.schemas.employee import EmployeeCreate, EmployeeRead, EmployeeUpdate
from app.services import employee_service
from app.utils.pagination import PagedResponse, PaginationParams
from fastapi.responses import RedirectResponse, FileResponse
from app.core.config import settings

router = APIRouter(prefix="/employees", tags=["Employees"])

_auth = require_permissions(Permission.EMPLOYEES_READ)
_write = require_permissions(Permission.EMPLOYEES_WRITE)


@router.get("", response_model=PagedResponse[EmployeeRead])
async def list_employees(
    department: Optional[str] = Query(None),
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(_auth),
):
    items, total = await employee_service.list_employees(db, department, params.offset, params.limit)
    return PagedResponse.create([EmployeeRead.model_validate(e) for e in items], total, params)


@router.post("", response_model=EmployeeRead, status_code=201)
async def create_employee(
    payload: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(_write),
):
    try:
        emp = await employee_service.create_employee(db, payload)
        return EmployeeRead.model_validate(emp)
    except Exception as e:
        import traceback
        with open("error_log.txt", "w") as f:
            f.write(traceback.format_exc())
        raise


@router.get("/{employee_id}", response_model=EmployeeRead)
async def get_employee(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(_auth),
):
    emp = await employee_service.get_employee(db, employee_id)
    return EmployeeRead.model_validate(emp)


@router.post("/{employee_id}/documents", response_model=EmployeeRead, status_code=201)
async def upload_document(
    employee_id: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _=Depends(_write),
):
    emp = await employee_service.upload_employee_document(db, employee_id, document_type, file)
    return EmployeeRead.model_validate(emp)


@router.get("/{employee_id}/documents/{document_type}")
async def view_document(
    employee_id: str,
    document_type: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user_query),
):
    # Verify current user has employees read permission
    from app.core.permissions import get_permissions
    if Permission.EMPLOYEES_READ not in get_permissions(current_user.designation):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not authorized to view employee documents")

    if document_type not in ("document_1", "document_2", "document_3"):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid document type")

    emp = await employee_service.get_employee(db, employee_id)
    doc_url = getattr(emp, document_type)
    if not doc_url:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Document not found")

    if doc_url.startswith("http://") or doc_url.startswith("https://"):
        return RedirectResponse(url=doc_url)
    elif doc_url.startswith("/uploads/"):
        import os
        from pathlib import Path
        file_path = Path(settings.UPLOAD_DIR) / doc_url.replace("/uploads/", "", 1)
        if not file_path.exists():
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Document file missing on disk")
        return FileResponse(file_path)
    
    from fastapi import HTTPException
    raise HTTPException(status_code=500, detail="Invalid document URL format")



@router.patch("/{employee_id}", response_model=EmployeeRead)
async def update_employee(
    employee_id: str,
    payload: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(_write),
):
    emp = await employee_service.update_employee(db, employee_id, payload)
    return EmployeeRead.model_validate(emp)


@router.delete("/{employee_id}", status_code=204)
async def delete_employee(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(_write),
):
    await employee_service.delete_employee(db, employee_id)
