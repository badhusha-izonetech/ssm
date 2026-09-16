import io
import uuid
import mimetypes
from datetime import datetime
from typing import Optional

import aioboto3
from fastapi import UploadFile, HTTPException

from app.core.config import settings

session = aioboto3.Session()

async def get_boto_client():
    endpoint = settings.MINIO_ENDPOINT
    if not endpoint.startswith("http"):
        endpoint = f"https://{endpoint}" if settings.MINIO_SECURE else f"http://{endpoint}"
        
    from botocore.config import Config
    boto_config = Config(connect_timeout=3, read_timeout=3, retries={'max_attempts': 1})
    
    return session.client(
        's3',
        endpoint_url=endpoint,
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        config=boto_config
    )

async def init_bucket():
    """Ensure the MinIO bucket exists and is public."""
    async with await get_boto_client() as s3:
        try:
            await s3.head_bucket(Bucket=settings.MINIO_BUCKET)
        except Exception:
            try:
                await s3.create_bucket(Bucket=settings.MINIO_BUCKET)
            except Exception as e:
                print(f"Error creating bucket {settings.MINIO_BUCKET}: {e}")
                
        # Always ensure the bucket is public read
        try:
            policy = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": "*",
                        "Action": ["s3:GetObject"],
                        "Resource": [f"arn:aws:s3:::{settings.MINIO_BUCKET}/*"]
                    }
                ]
            }
            import json
            await s3.put_bucket_policy(Bucket=settings.MINIO_BUCKET, Policy=json.dumps(policy))
        except Exception as e:
            print(f"Error setting public policy for {settings.MINIO_BUCKET}: {e}")

async def upload_file(file: UploadFile, folder: str = "general") -> str:
    """
    Uploads a file to MinIO and returns the object key.
    """
    if file.size and file.size > settings.max_file_size_bytes:
        raise HTTPException(status_code=413, detail="File too large")
        
    ext = mimetypes.guess_extension(file.content_type or "") or ""
    # fallback for common extensions
    if not ext and file.filename:
        if "." in file.filename:
            ext = "." + file.filename.split(".")[-1]
            
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    random_id = str(uuid.uuid4())[:8]
    object_key = f"{folder}/{timestamp}_{random_id}{ext}"
    
    # Read file content safely
    content = await file.read()
    
    async with await get_boto_client() as s3:
        try:
            await s3.upload_fileobj(
                io.BytesIO(content),
                settings.MINIO_BUCKET,
                object_key,
                ExtraArgs={"ContentType": file.content_type or "application/octet-stream"}
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")
            
    return object_key

async def get_presigned_url(object_key: str, expiration: int = 3600) -> str:
    """
    Generates a pre-signed URL to download the file.
    """
    async with await get_boto_client() as s3:
        try:
            url = await s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': settings.MINIO_BUCKET, 'Key': object_key},
                ExpiresIn=expiration
            )
            return url
        except Exception as e:
            print(f"Error generating pre-signed URL: {e}")
            return ""

def get_public_url(object_key: str) -> str:
    """
    Returns the public URL for the file (assuming bucket policy allows GetObject).
    """
    return f"{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET}/{object_key}"

async def delete_file(object_key: str) -> bool:
    """
    Deletes a file from MinIO.
    """
    async with await get_boto_client() as s3:
        try:
            await s3.delete_object(Bucket=settings.MINIO_BUCKET, Key=object_key)
            return True
        except Exception as e:
            print(f"Error deleting file: {e}")
            return False
