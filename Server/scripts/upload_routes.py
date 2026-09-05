"""Endpoints backing the client's direct-to-S3 chunked upload flow.

These only ever exchange small JSON metadata with the browser — the actual
file bytes flow browser -> S3 (or the local mock) over presigned URLs, never
through this process. That's what lets an upload be arbitrarily large without
this server's memory use growing with it, unlike `/api/scan` (which reads a
whole file into memory on purpose, to run it through the LLM comparison).
"""

import os

from botocore.exceptions import ClientError
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from scripts.s3_storage import (
    abort_multipart_upload,
    complete_multipart_upload,
    compute_total_parts,
    get_upload_part_size_bytes,
    initiate_multipart_upload,
    list_uploaded_parts,
    presign_upload_parts,
)

MAX_CLOUD_UPLOAD_MB = int(os.environ.get("MAX_CLOUD_UPLOAD_MB", "5120"))  # 5 GB default
MAX_CLOUD_UPLOAD_BYTES = MAX_CLOUD_UPLOAD_MB * 1024 * 1024

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


class InitiateRequest(BaseModel):
    filename: str
    fileSize: int = Field(gt=0)
    contentType: str | None = None


class InitiateResponse(BaseModel):
    uploadId: str
    key: str
    partSize: int
    totalParts: int


class PresignRequest(BaseModel):
    key: str
    uploadId: str
    partNumbers: list[int]


class PresignResponse(BaseModel):
    urls: dict[int, str]


class PartInput(BaseModel):
    partNumber: int
    etag: str


class CompleteRequest(BaseModel):
    key: str
    uploadId: str
    parts: list[PartInput]


class CompleteResponse(BaseModel):
    location: str
    key: str


class AbortRequest(BaseModel):
    key: str
    uploadId: str


class UploadedPart(BaseModel):
    partNumber: int
    etag: str
    size: int


class ListPartsResponse(BaseModel):
    parts: list[UploadedPart]


def _as_http_error(exc: ClientError) -> HTTPException:
    code = exc.response.get("Error", {}).get("Code", "")
    message = exc.response.get("Error", {}).get("Message", str(exc))
    status = 404 if code in {"NoSuchUpload", "NoSuchKey", "NoSuchBucket"} else 502
    return HTTPException(status_code=status, detail=f"S3 error ({code}): {message}")


@router.post("/initiate", response_model=InitiateResponse)
async def initiate(body: InitiateRequest) -> InitiateResponse:
    if body.fileSize > MAX_CLOUD_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {MAX_CLOUD_UPLOAD_MB} MB limit for cloud uploads.",
        )

    try:
        result = initiate_multipart_upload(body.filename, body.contentType)
    except ClientError as exc:
        raise _as_http_error(exc) from exc

    return InitiateResponse(
        uploadId=result["uploadId"],
        key=result["key"],
        partSize=get_upload_part_size_bytes(),
        totalParts=compute_total_parts(body.fileSize),
    )


@router.post("/parts/presign", response_model=PresignResponse)
async def presign(body: PresignRequest) -> PresignResponse:
    if not body.partNumbers:
        raise HTTPException(status_code=400, detail="partNumbers must not be empty.")

    try:
        urls = presign_upload_parts(body.key, body.uploadId, body.partNumbers)
    except ClientError as exc:
        raise _as_http_error(exc) from exc

    return PresignResponse(urls=urls)


@router.get("/{upload_id}/parts", response_model=ListPartsResponse)
async def list_parts(upload_id: str, key: str) -> ListPartsResponse:
    try:
        parts = list_uploaded_parts(key, upload_id)
    except ClientError as exc:
        raise _as_http_error(exc) from exc

    return ListPartsResponse(parts=[UploadedPart(**part) for part in parts])


@router.post("/complete", response_model=CompleteResponse)
async def complete(body: CompleteRequest) -> CompleteResponse:
    if not body.parts:
        raise HTTPException(status_code=400, detail="parts must not be empty.")

    try:
        location = complete_multipart_upload(
            body.key,
            body.uploadId,
            [{"partNumber": part.partNumber, "etag": part.etag} for part in body.parts],
        )
    except ClientError as exc:
        raise _as_http_error(exc) from exc

    return CompleteResponse(location=location, key=body.key)


@router.post("/abort")
async def abort(body: AbortRequest) -> dict:
    try:
        abort_multipart_upload(body.key, body.uploadId)
    except ClientError as exc:
        raise _as_http_error(exc) from exc

    return {"ok": True}
