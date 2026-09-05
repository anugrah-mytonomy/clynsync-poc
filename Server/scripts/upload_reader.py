"""Bounded, disk-free read of an upload straight off the request stream.

Bypasses FastAPI's UploadFile/multipart machinery on purpose: that path fully
buffers the file (spooling to a real temp file on disk past ~1MB) before our
route code ever runs. Reading request.stream() directly means we control
exactly how much is ever held, can reject oversized uploads without reading
them, and can abort mid-transfer the moment a running total crosses the cap.

This must run to completion BEFORE the route returns a StreamingResponse.
Uvicorn sends the SSE response's headers the moment that response object
starts iterating — and once that happens, it stops servicing this same
request's body (`receive()` calls block forever). So request-body-reading and
response-body-streaming can't be interleaved on this stack; live per-chunk
upload progress has to come from the browser's own XMLHttpRequest.upload
progress events instead (see web/index.html), not from the server.
"""


class UploadTooLarge(ValueError):
    pass


async def read_upload_bounded(request, max_bytes: int) -> tuple[bytes, int | None]:
    """Read the full request body, enforcing max_bytes as it arrives.

    Returns (body_bytes, declared_content_length_or_None). Raises
    UploadTooLarge immediately if Content-Length already exceeds the cap, or
    the instant a running total does — whether or not Content-Length was
    present or accurate.
    """
    content_length = request.headers.get("content-length")
    declared_size = int(content_length) if content_length and content_length.isdigit() else None

    if declared_size is not None and declared_size > max_bytes:
        raise UploadTooLarge(
            f"Declared upload size ({declared_size / 1_048_576:.1f} MB) exceeds the "
            f"{max_bytes / 1_048_576:.0f} MB limit for this POC — rejected before reading any of it."
        )

    buffer = bytearray()
    async for network_chunk in request.stream():
        buffer.extend(network_chunk)
        if len(buffer) > max_bytes:
            raise UploadTooLarge(
                f"Upload exceeded the {max_bytes / 1_048_576:.0f} MB limit for this POC after "
                f"receiving {len(buffer) / 1_048_576:.1f} MB — aborted mid-transfer."
            )

    return bytes(buffer), declared_size
