"""S3 multipart-upload orchestration for direct browser-to-S3 uploads.

The server never touches file bytes for this path — it only issues presigned
URLs so the browser can PUT each chunk straight to S3 (or a local S3-compatible
mock; see README's "Local S3 mock" section). That's what makes large files
safe: memory use here stays flat regardless of file size, since only
metadata (keys, upload IDs, part numbers) passes through this process.

Local dev uses `moto_server` (an in-process S3-API-compatible mock) so this
can be fully exercised without real AWS credentials — set S3_ENDPOINT_URL to
point at it. Point the same env vars at real AWS (unset S3_ENDPOINT_URL,
set real credentials + bucket) and the code path is unchanged.
"""

import os
import uuid
from pathlib import PurePosixPath
from typing import TypedDict

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

# S3 requires every part but the last to be >= 5 MiB.
S3_MIN_PART_SIZE_BYTES = 5 * 1024 * 1024


class PartInput(TypedDict):
    partNumber: int
    etag: str


# Read lazily (inside functions, not at module import time) — app.py imports
# this module before calling load_dotenv(), same convention as llm_client.py.
def _s3_bucket() -> str:
    return os.environ.get("S3_BUCKET", "clinsync-uploads")


def _s3_endpoint_url() -> str | None:
    return os.environ.get("S3_ENDPOINT_URL") or None


def get_upload_part_size_bytes() -> int:
    part_size_mb = int(os.environ.get("UPLOAD_PART_SIZE_MB", "8"))
    return max(part_size_mb * 1024 * 1024, S3_MIN_PART_SIZE_BYTES)


def _presign_expires_seconds() -> int:
    return int(os.environ.get("PRESIGN_EXPIRES_SECONDS", "3600"))


_client = None
_client_endpoint_url: str | None = "unset"


def get_s3_client():
    global _client, _client_endpoint_url

    endpoint_url = _s3_endpoint_url()
    # Rebuild if the endpoint changed (e.g. .env reloaded) so a stale client
    # pointed at the wrong host/credentials is never reused.
    if _client is not None and _client_endpoint_url == endpoint_url:
        return _client

    _client = boto3.client(
        "s3",
        region_name=os.environ.get("AWS_REGION", "us-east-1"),
        endpoint_url=endpoint_url,
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID", "test" if endpoint_url else None),
        aws_secret_access_key=os.environ.get(
            "AWS_SECRET_ACCESS_KEY", "test" if endpoint_url else None
        ),
        config=Config(
            signature_version="s3v4",
            # Path-style (endpoint/bucket/key) is what local mocks like
            # moto_server understand; real AWS gets virtual-hosted style
            # (bucket.endpoint/key), which is its current default.
            s3={"addressing_style": "path" if endpoint_url else "auto"},
        ),
    )
    _client_endpoint_url = endpoint_url
    return _client


def ensure_bucket_ready(cors_allowed_origins: list[str]) -> None:
    """Create the bucket + CORS config on startup — local mock only.

    Against real AWS the bucket and its CORS policy should already be
    provisioned (see README); we just check reachability and warn instead of
    silently mutating a production bucket's config.
    """
    client = get_s3_client()
    bucket = _s3_bucket()

    if not _s3_endpoint_url():
        try:
            client.head_bucket(Bucket=bucket)
        except ClientError as exc:
            print(f"[s3_storage] WARNING: bucket '{bucket}' not reachable: {exc}")
        return

    try:
        client.head_bucket(Bucket=bucket)
    except ClientError:
        client.create_bucket(Bucket=bucket)

    # Browser-direct PUTs are cross-origin (Vite dev server -> mock S3), and
    # the client needs to read the ETag response header to complete the
    # multipart upload — that requires it in ExposeHeaders, or browsers hide
    # it even though the response carries it.
    client.put_bucket_cors(
        Bucket=bucket,
        CORSConfiguration={
            "CORSRules": [
                {
                    "AllowedOrigins": cors_allowed_origins or ["*"],
                    "AllowedMethods": ["PUT", "GET", "HEAD"],
                    "AllowedHeaders": ["*"],
                    "ExposeHeaders": ["ETag"],
                    "MaxAgeSeconds": 3600,
                }
            ]
        },
    )


def _build_object_key(filename: str) -> str:
    safe_name = PurePosixPath(filename or "upload.bin").name
    return f"uploads/{uuid.uuid4().hex}/{safe_name}"


def compute_total_parts(file_size: int) -> int:
    if file_size <= 0:
        return 1
    return max(1, -(-file_size // get_upload_part_size_bytes()))  # ceil division


def initiate_multipart_upload(filename: str, content_type: str | None) -> dict:
    key = _build_object_key(filename)
    client = get_s3_client()
    response = client.create_multipart_upload(
        Bucket=_s3_bucket(),
        Key=key,
        ContentType=content_type or "application/octet-stream",
    )
    return {"uploadId": response["UploadId"], "key": key}


def presign_upload_parts(key: str, upload_id: str, part_numbers: list[int]) -> dict[int, str]:
    client = get_s3_client()
    bucket = _s3_bucket()
    expires_in = _presign_expires_seconds()
    return {
        part_number: client.generate_presigned_url(
            "upload_part",
            Params={
                "Bucket": bucket,
                "Key": key,
                "UploadId": upload_id,
                "PartNumber": part_number,
            },
            ExpiresIn=expires_in,
        )
        for part_number in part_numbers
    }


def list_uploaded_parts(key: str, upload_id: str) -> list[dict]:
    """Already-committed parts for `upload_id` — lets a resumed upload skip
    parts it finished before a page refresh or network drop."""
    client = get_s3_client()
    bucket = _s3_bucket()
    parts: list[dict] = []
    part_number_marker = 0

    while True:
        response = client.list_parts(
            Bucket=bucket,
            Key=key,
            UploadId=upload_id,
            PartNumberMarker=part_number_marker,
        )
        for part in response.get("Parts", []):
            parts.append(
                {
                    "partNumber": part["PartNumber"],
                    "etag": part["ETag"],
                    "size": part["Size"],
                }
            )
        if not response.get("IsTruncated"):
            break
        part_number_marker = response.get("NextPartNumberMarker", 0)

    return parts


def complete_multipart_upload(key: str, upload_id: str, parts: list[PartInput]) -> str:
    client = get_s3_client()
    bucket = _s3_bucket()
    ordered = sorted(parts, key=lambda part: part["partNumber"])
    response = client.complete_multipart_upload(
        Bucket=bucket,
        Key=key,
        UploadId=upload_id,
        MultipartUpload={
            "Parts": [
                {"ETag": part["etag"], "PartNumber": part["partNumber"]} for part in ordered
            ]
        },
    )
    return response.get("Location") or f"s3://{bucket}/{key}"


def abort_multipart_upload(key: str, upload_id: str) -> None:
    client = get_s3_client()
    try:
        client.abort_multipart_upload(Bucket=_s3_bucket(), Key=key, UploadId=upload_id)
    except ClientError as exc:
        # Already completed/aborted/expired — nothing left to clean up.
        if exc.response.get("Error", {}).get("Code") not in {"NoSuchUpload", "404"}:
            raise
