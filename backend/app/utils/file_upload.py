"""
File upload utilities — multipart upload, path resolution, validation.
Replaces frontend base64 DataURL approach with real file storage.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

import io
from minio import Minio
from minio.error import S3Error

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "application/octet-stream"}
ALLOWED_MEDIA_TYPES = ALLOWED_IMAGE_TYPES | {"video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/avi"}
ALLOWED_DOC_TYPES = {"application/pdf", "image/jpeg", "image/jpg", "image/png", "application/octet-stream"}

import json

def get_minio_client() -> Minio:
    raw_endpoint = settings.MINIO_ENDPOINT
    is_local = "localhost" in raw_endpoint or "127.0.0.1" in raw_endpoint
    is_secure = settings.MINIO_SECURE or raw_endpoint.startswith("https") or not is_local
    endpoint = raw_endpoint.replace("http://", "").replace("https://", "").rstrip("/")
    client = Minio(
        endpoint,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=is_secure,
    )
    return client

def ensure_bucket_exists():
    client = get_minio_client()
    try:
        if not client.bucket_exists(settings.MINIO_BUCKET):
            try:
                client.make_bucket(settings.MINIO_BUCKET)
                print(f"Created bucket {settings.MINIO_BUCKET}")
            except Exception as err:
                print(f"Could not create bucket {settings.MINIO_BUCKET}: {err}")
            
            # Make bucket public read
            try:
                policy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {"AWS": ["*"]},
                            "Action": ["s3:GetObject"],
                            "Resource": [f"arn:aws:s3:::{settings.MINIO_BUCKET}/*"],
                        }
                    ],
                }
                client.set_bucket_policy(settings.MINIO_BUCKET, json.dumps(policy))
                print(f"Set public read policy on {settings.MINIO_BUCKET}")
            except Exception as err:
                print(f"Could not set bucket policy on {settings.MINIO_BUCKET}: {err}")
    except Exception as err:
        print("MinIO Bucket Check Error:", err)

# Initialize bucket
try:
    ensure_bucket_exists()
except Exception:
    pass

async def save_upload(
    file: UploadFile,
    subfolder: str,
    allowed_types: set[str] | None = None,
) -> str:
    """
    Validate and save an uploaded file to MinIO.
    Returns the URL path to access it.
    """
    ext = file.filename.split('.')[-1].lower() if file.filename and '.' in file.filename else ''
    is_valid_ext = ext in {"jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "mkv", "avi", "pdf"}

    if allowed_types and file.content_type not in allowed_types and not is_valid_ext:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '{file.content_type}' not allowed.",
        )

    content = await file.read()
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.MAX_FILE_SIZE_MB}MB limit.",
        )

    from werkzeug.utils import secure_filename
    safe_name = secure_filename(file.filename or "file")
    filename = f"{uuid.uuid4().hex}_{safe_name}"
    object_name = f"{subfolder}/{filename}"

    client = get_minio_client()
    try:
        # Use explicit part_size for multi-part uploads if file size > 5MB
        part_size = 5 * 1024 * 1024 if len(content) > 5 * 1024 * 1024 else 0
        client.put_object(
            settings.MINIO_BUCKET,
            object_name,
            io.BytesIO(content),
            length=len(content),
            content_type=file.content_type or "application/octet-stream",
            part_size=part_size
        )
        is_local = "localhost" in settings.MINIO_ENDPOINT or "127.0.0.1" in settings.MINIO_ENDPOINT
        is_secure = settings.MINIO_SECURE or settings.MINIO_ENDPOINT.startswith("https") or not is_local
        protocol = "https" if is_secure else "http"
        endpoint = settings.MINIO_ENDPOINT.replace("http://", "").replace("https://", "")
        return f"{protocol}://{endpoint}/{settings.MINIO_BUCKET}/{object_name}"
    except Exception as err:
        import traceback
        print("MinIO PutObject Error (using local disk fallback):", err)
        traceback.print_exc()
        local_dir = Path(settings.UPLOAD_DIR) / subfolder
        local_dir.mkdir(parents=True, exist_ok=True)
        file_path = local_dir / filename
        with open(file_path, "wb") as f:
            f.write(content)
        return f"/uploads/{subfolder}/{filename}"

async def save_field_visit_photo(file: UploadFile) -> str:
    return await save_upload(file, "field_visit_photos", ALLOWED_IMAGE_TYPES)

async def save_payment_proof(file: UploadFile) -> str:
    return await save_upload(file, "payment_proofs", ALLOWED_DOC_TYPES)

async def save_quotation_document(file: UploadFile) -> str:
    return await save_upload(file, "quotation_documents", ALLOWED_DOC_TYPES)

async def save_stock_document(file: UploadFile) -> str:
    return await save_upload(file, "stock_documents", ALLOWED_DOC_TYPES)

async def save_employee_document(file: UploadFile) -> str:
    return await save_upload(file, "employee_documents", ALLOWED_DOC_TYPES)

async def save_eb_document(file: UploadFile) -> str:
    return await save_upload(file, "eb_documents", ALLOWED_DOC_TYPES)

import base64
async def save_base64_file(data_url: str, subfolder: str = "site_visit_evidence") -> str | None:
    if not data_url.startswith("data:"):
        return None
    try:
        header, encoded = data_url.split(",", 1)
        mime_type = header.split(":")[1].split(";")[0]
        content = base64.b64decode(encoded)
        
        ext = mime_type.split("/")[-1] if "/" in mime_type else "bin"
        filename = f"{uuid.uuid4().hex}.{ext}"
        object_name = f"{subfolder}/{filename}"
        
        client = get_minio_client()
        client.put_object(
            settings.MINIO_BUCKET,
            object_name,
            io.BytesIO(content),
            length=len(content),
            content_type=mime_type
        )
        is_local = "localhost" in settings.MINIO_ENDPOINT or "127.0.0.1" in settings.MINIO_ENDPOINT
        is_secure = settings.MINIO_SECURE or settings.MINIO_ENDPOINT.startswith("https") or not is_local
        protocol = "https" if is_secure else "http"
        endpoint = settings.MINIO_ENDPOINT.replace("http://", "").replace("https://", "")
        return f"{protocol}://{endpoint}/{settings.MINIO_BUCKET}/{object_name}"
    except Exception as e:
        print("Base64 upload error:", e)
        return None
