"""
Custom exception classes and global FastAPI exception handlers.
All API errors return a consistent envelope:
  { "detail": "...", "code": "...", "field": "..." (optional) }
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError


# ── Custom exception classes ──────────────────────────────────────────────────

class AppException(HTTPException):
    """Base application exception."""
    def __init__(
        self,
        status_code: int,
        detail: str,
        code: str = "ERROR",
        field: Optional[str] = None,
        headers: Optional[dict] = None,
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.code = code
        self.field = field


class NotFoundError(AppException):
    def __init__(self, resource: str = "Resource", detail: str | None = None):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail or f"{resource} not found",
            code="NOT_FOUND",
        )


class ConflictError(AppException):
    def __init__(self, detail: str, field: str | None = None):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
            code="CONFLICT",
            field=field,
        )


class ForbiddenError(AppException):
    def __init__(self, detail: str = "Permission denied"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            code="FORBIDDEN",
        )


class UnauthorizedError(AppException):
    def __init__(self, detail: str = "Authentication required"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            code="UNAUTHORIZED",
            headers={"WWW-Authenticate": "Bearer"},
        )


class ValidationAppError(AppException):
    def __init__(self, detail: str, field: str | None = None):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
            code="VALIDATION_ERROR",
            field=field,
        )


class BusinessRuleError(AppException):
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
            code="BUSINESS_RULE_VIOLATION",
        )


# ── Global handlers ────────────────────────────────────────────────────────────

def _error_envelope(
    detail: Any,
    code: str = "ERROR",
    field: str | None = None,
) -> dict:
    payload: dict[str, Any] = {"detail": detail, "code": code}
    if field:
        payload["field"] = field
    return payload


def register_exception_handlers(app: FastAPI) -> None:

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_envelope(exc.detail, exc.code, getattr(exc, "field", None)),
            headers=exc.headers or {},
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_envelope(exc.detail),
            headers=getattr(exc, "headers", None) or {},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ):
        import logging
        errors = exc.errors()
        first = errors[0] if errors else {}
        field = ".".join(str(loc) for loc in first.get("loc", [])[1:]) or None
        logging.getLogger("ssc").warning(
            "422 Validation Error on %s %s — %s",
            request.method,
            request.url.path,
            errors,
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_envelope(
                detail=[
                    {"field": ".".join(str(l) for l in e["loc"][1:]), "msg": f"{'.'.join(str(l) for l in e['loc'][1:])}: {e['msg']}"}
                    for e in errors
                ],
                code="VALIDATION_ERROR",
                field=field,
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        import logging
        logging.getLogger("ssc").exception("Unhandled error: %s", exc)
        origin = request.headers.get("origin", "")
        cors_headers = {
            "Access-Control-Allow-Origin": origin if origin else "*",
            "Access-Control-Allow-Credentials": "true",
        }
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_envelope("Internal server error", "INTERNAL_ERROR"),
            headers=cors_headers,
        )
