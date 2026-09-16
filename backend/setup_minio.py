import json
import sys
from pathlib import Path

# Ensure backend directory is in the path
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from minio import Minio
from app.core.config import settings


def setup_minio() -> None:
    print("Connecting to MinIO storage server...")
    # MinIO endpoint should not include protocol for SDK
    endpoint = settings.MINIO_ENDPOINT.replace("http://", "").replace("https://", "")
    bucket = settings.MINIO_BUCKET

    try:
        client = Minio(
            endpoint,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_ENDPOINT.startswith("https"),
        )

        # 1. Check if the bucket exists, and create it if not
        if not client.bucket_exists(bucket):
            print(f"Bucket '{bucket}' does not exist. Creating bucket...")
            client.make_bucket(bucket)
            print(f"Bucket '{bucket}' created successfully.")
        else:
            print(f"Bucket '{bucket}' already exists.")

        # 2. Set public read-only policy
        print(f"Applying public read-only policy to bucket '{bucket}'...")
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket}/*"],
                }
            ],
        }
        client.set_bucket_policy(bucket, json.dumps(policy))
        print("Bucket policy applied successfully. MinIO setup completed.")

    except Exception as e:
        print(f"MinIO setup warning/error: {e}")
        print("MinIO storage server is currently unavailable or misconfigured.")
        print("Exiting gracefully...")
        # Graceful exit with code 0 as requested
        sys.exit(0)


if __name__ == "__main__":
    setup_minio()
