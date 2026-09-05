"""
app.py — ClinSync Streaming Compare POC (FastAPI)

Proves out one mechanic: a user-uploaded .docx is read straight into memory,
each section checked for live-verifiable clinical claims and, for a bounded
subset of those, verified against current external guidance (Groq's
groq/compound model, validated against references/source_tier_db.json — see
scripts/compare_engine.py). Each section's verdict is pushed to the browser
over Server-Sent Events the moment it's ready. The uploaded file is never
written to disk and is discarded as soon as the request finishes.

Endpoints:
  GET  /            → serves the UI (web/index.html)
  POST /api/scan     → accepts one .docx upload, streams results as SSE
  GET  /health        → health check
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from scripts.compare_engine import run_comparison_stream
from scripts.llm_client import get_provider
from scripts.s3_storage import ensure_bucket_ready
from scripts.upload_reader import UploadTooLarge, read_upload_bounded
from scripts.upload_routes import router as upload_router

load_dotenv(Path(__file__).parent / ".env", override=True)

ROOT = Path(__file__).parent
WEB_DIR = ROOT / "web"
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_MB", "15")) * 1024 * 1024
LARGE_FILE_WARN_BYTES = int(os.environ.get("LARGE_FILE_WARN_MB", "5")) * 1024 * 1024
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
    ).split(",")
    if origin.strip()
]

app = FastAPI(title="ClinSync Streaming Compare POC")

# Lets the React client (Client/, served by Vite on a different origin) call
# /api/scan directly. X-Filename is a non-simple header, so the browser sends
# a CORS preflight (OPTIONS) before the real POST — allow_headers must list it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Filename"],
)

app.include_router(upload_router)


@app.on_event("startup")
async def _ensure_s3_ready() -> None:
    # Local dev only: creates the mock bucket + CORS policy against
    # moto_server the first time the app boots. Against real AWS this just
    # checks the bucket is reachable — see s3_storage.ensure_bucket_ready.
    ensure_bucket_ready(CORS_ALLOWED_ORIGINS)


if WEB_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(WEB_DIR)), name="static")


@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    html_path = WEB_DIR / "index.html"
    if not html_path.exists():
        raise HTTPException(status_code=404, detail="UI not found")
    return HTMLResponse(html_path.read_text(encoding="utf-8"))


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "llm_provider": get_provider(),
        "source_registry_configured": (ROOT / "references" / "source_tier_db.json").exists(),
    }


@app.post("/api/scan")
async def scan(request: Request):
    filename = request.headers.get("x-filename", "")
    if Path(filename).suffix.lower() != ".docx":
        raise HTTPException(status_code=400, detail="Only .docx files are supported (missing/invalid X-Filename header).")

    if get_provider() is None:
        raise HTTPException(
            status_code=500,
            detail="No LLM provider configured on the server. Set GROQ_API_KEY or ANTHROPIC_API_KEY in .env.",
        )

    # The request body must be read to completion *before* we open the SSE
    # response — once a StreamingResponse starts sending, this server stack
    # stops servicing this request's body reads, so the two can't overlap.
    # Live upload progress therefore comes from the browser's own
    # XMLHttpRequest.upload progress events (web/index.html), not from here.
    try:
        candidate_bytes, declared_size = await read_upload_bounded(request, MAX_UPLOAD_BYTES)
    except UploadTooLarge as exc:
        raise HTTPException(status_code=413, detail=str(exc))

    async def event_stream():
        if declared_size and declared_size >= LARGE_FILE_WARN_BYTES:
            yield (
                "data: "
                + json.dumps(
                    {
                        "type": "upload_warning",
                        "message": (
                            f"Received a {declared_size / 1_048_576:.1f} MB file — "
                            "larger uploads take longer to extract and compare."
                        ),
                    }
                )
                + "\n\n"
            )
        try:
            async for event in run_comparison_stream(candidate_bytes, filename):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:  # noqa: BLE001 - surface fatal errors to the open stream
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
