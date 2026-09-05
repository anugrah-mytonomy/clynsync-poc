# ClinSync Streaming Compare — Server

FastAPI backend for the ClinSync POC. A user uploads a `.docx`; it's read straight into memory (never to disk), split into sections, and each checkable claim is live-verified against real external clinical guidance (CDC, FDA, NIH, and ~140 other authorities). Verdicts stream to the browser over Server-Sent Events as soon as they're ready.

For the full mechanism and design rationale, see **[ARCHITECTURE.md](ARCHITECTURE.md)**. For a plain-language walkthrough, see **[TEAM_OVERVIEW.md](TEAM_OVERVIEW.md)**. This file is the quick-start / reference doc: how to run it, what the API looks like, and where things live.

## Quick start

```bash
# from Server/
python -m venv .venv
.venv/bin/pip install -r requirements.txt   # Windows: .venv\Scripts\pip install -r requirements.txt

cp .env.example .env
# edit .env — set GROQ_API_KEY (free, console.groq.com) or ANTHROPIC_API_KEY

.venv/bin/python -m uvicorn app:app --port 8000   # Windows: .venv\Scripts\python -m uvicorn app:app --port 8000
```

Open `http://localhost:8000`, pick one or more `.docx` files, and watch results build live.

## Configuration (`.env`)

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Free-tier provider for triage/classification; if set, used instead of Anthropic. Get one at console.groq.com. |
| `GROQ_MODEL` | Cheap chat model used for triage (default `openai/gpt-oss-120b`). |
| `ANTHROPIC_API_KEY` | Used instead of Groq for triage/classification if `GROQ_API_KEY` is unset — this is the reference product's own main provider. |
| `CLAUDE_MODEL` | Claude model id when running on the Anthropic path (default `claude-sonnet-5`). |
| `PERPLEXITY_API_KEY` | Preferred provider for the live-search verify step, independent of which of the two above is doing triage/classification — the same Claude + Perplexity pairing the reference product uses. |
| `PERPLEXITY_MODEL` | Perplexity search model (default `sonar`). |
| `GROQ_SEARCH_MODEL` | Fallback search model used for live verification when `PERPLEXITY_API_KEY` isn't set and the main provider is Groq (default `groq/compound-mini` — the full `groq/compound` 413s on search at the free tier; see ARCHITECTURE.md §10c). |
| `MAX_LIVE_SEARCHES` | Cap on live-verified sections per document (default 5; `.env.example` ships 2 — the search provider's quota is tight). |
| `MAX_UPLOAD_MB` | Hard upload size cap for `/api/scan`; rejected with `413` (default 15). |
| `LARGE_FILE_WARN_MB` | Soft threshold for an `upload_warning` SSE event (default 5). |
| `PORT` | Server port (default 8000). |
| `S3_ENDPOINT_URL` | For `/api/uploads/*` (see below) — point at a local mock (`http://127.0.0.1:5001`) or unset for real AWS. |
| `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | S3 target/credentials for direct-to-S3 uploads. |
| `UPLOAD_PART_SIZE_MB`, `PRESIGN_EXPIRES_SECONDS`, `MAX_CLOUD_UPLOAD_MB` | Chunk size, presigned-URL TTL, and size cap for direct-to-S3 uploads (independent of `MAX_UPLOAD_MB`, since those bytes never pass through this server). |

## API

### `GET /`
Serves the UI (`web/index.html`).

### `GET /health`
```json
{"status": "ok", "llm_provider": "groq" | "anthropic" | null, "source_registry_configured": true}
```

### `POST /api/scan`
Uploads and scans **one** `.docx`. Not multipart — send the raw file bytes as the request body.

- **Header:** `X-Filename: <name>.docx` (required; only `.docx` is accepted)
- **Body:** raw file bytes
- **Response:** `text/event-stream` (SSE) — one `data: {...}\n\n` frame per event, in this order:

| `type` | When | Key fields |
|---|---|---|
| `upload_warning` | File ≥ `LARGE_FILE_WARN_MB` | `message` |
| `meta` | Once, after section extraction | `candidate_sections`, `total_checks`, `search_budget` |
| `scanning` | Before each section's verdict | `index`, `title` |
| `result` | One per section | `index`, `title`, `verdict`, `risk_level`, `explanation`, `source_url?`, `source_tier?` |
| `summary` | Once, at the end | `counts`, `checked`, `total_checks`, `highest_risk_level`, `sme_review_needed`, `coverage_note` |
| `error` | On a fatal failure | `message` |

**Verdicts:** `MATCH` (current) · `MODIFIED` (outdated) · `RISK` (outdated + weakens a safety instruction) · `UNVERIFIED` (unconfirmed, or source not in the registry) · `NOT_CHECKED` (no checkable claim, or search budget spent) · `ERROR` (technical failure, e.g. provider timeout).

**Document roll-up:** `highest_risk_level` is `HIGH` if any section is `RISK`, else `MEDIUM` if any `MODIFIED`/`UNVERIFIED`/`ERROR`, else `CONFIRMATORY`. `sme_review_needed` follows the same ladder (`YES — MANDATORY` / `YES — REQUIRED` / `OPTIONAL` / `NO`).

Errors before streaming starts (bad filename, no provider configured, upload too large) return a normal JSON `4xx`/`5xx` instead of SSE.

### Direct-to-S3 chunked uploads (`/api/uploads/*`)

Separate from `/api/scan`, this is how the React client (`Client/src/utils/s3ChunkedUpload.ts`) gets large files (video, big PDFs, etc.) into storage: it splits a file into chunks with `File.slice()` and PUTs each one straight to S3 over a presigned URL, with retry/backoff per chunk and resumable progress. This server only ever sees small JSON metadata for that path — never file bytes — so it stays memory-flat regardless of file size, unlike `/api/scan` above (which reads the whole file into memory on purpose).

**Local dev (no AWS account needed):**

```bash
# terminal 1, from Server/ — a local S3-API-compatible mock
.venv/Scripts/moto_server -p 5001   # Windows; macOS/Linux: .venv/bin/moto_server -p 5001

# terminal 2, from Server/ — the app server; picks up S3_ENDPOINT_URL from .env
# and points at the mock automatically
.venv/Scripts/python -m uvicorn app:app --port 8000
```

The app creates the mock bucket and its CORS policy on startup (see `scripts/s3_storage.py::ensure_bucket_ready`). To point at real AWS instead: unset `S3_ENDPOINT_URL`, set real `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, and pre-create `S3_BUCKET` with a CORS policy allowing `PUT` from your client origin and exposing the `ETag` header (the browser reads it to finish each multipart upload — without it in `ExposeHeaders`, uploads silently fail to complete).

| Endpoint | Purpose |
|---|---|
| `POST /api/uploads/initiate` | `{filename, fileSize, contentType}` → `{uploadId, key, partSize, totalParts}` |
| `POST /api/uploads/parts/presign` | `{key, uploadId, partNumbers}` → `{urls: {partNumber: url}}` |
| `GET /api/uploads/{uploadId}/parts?key=` | Already-committed parts, for resuming after a refresh/drop |
| `POST /api/uploads/complete` | `{key, uploadId, parts: [{partNumber, etag}]}` → `{location, key}` |
| `POST /api/uploads/abort` | `{key, uploadId}` — cancels and discards an in-progress upload |

**Validating with large files:** `scripts/validate_large_upload.py --size-mb 250` drives the same HTTP contract end-to-end (generates a sample file, uploads it in concurrent chunks, verifies it landed correctly) and reports throughput and this script's own peak memory — useful for confirming large uploads stay memory-bounded without needing the browser.

## Where things live

```
Server/
├── app.py                          FastAPI routes, SSE framing, upload orchestration
├── scripts/
│   ├── upload_reader.py            bounded, disk-free raw-body read (used by /api/scan)
│   ├── docx_sections.py            .docx → [{title, text}] sections, in-memory only
│   ├── compare_engine.py           triage pass + bounded serial verify pass + roll-up + SSE stream
│   ├── source_tiers.py             source_tier_db.json loader + specificity-based URL matching
│   ├── llm_client.py               Groq/Claude provider abstraction + Perplexity/Groq live-search verification
│   ├── s3_storage.py               S3 multipart-upload orchestration (presigned URLs, bucket/CORS setup)
│   ├── upload_routes.py            /api/uploads/* endpoints — direct-to-S3 chunked upload
│   └── validate_large_upload.py    drives a large end-to-end chunked upload for perf validation
├── web/index.html                  upload form (XHR) + live results panel + citation display + risk banner
├── references/source_tier_db.json  the "source of truth" — ~140 approved external clinical authorities
├── requirements.txt
├── .env.example                    copy to .env and fill in
└── ARCHITECTURE.md / TEAM_OVERVIEW.md   deep-dive and plain-language docs
```

## Known limitations (POC)

- Live search verification needs `PERPLEXITY_API_KEY` or `GROQ_API_KEY`. Claude alone (no Perplexity key) triages and classifies fine but has no web-search step wired up — those sections fall back to `NOT_CHECKED`.
- Each search provider's free-tier quota is tight in multiple dimensions (tokens/minute, tokens/day, requests/day) — expect occasional `ERROR` results under sustained use.
- `MAX_LIVE_SEARCHES` is a real coverage ceiling, not just a cost knob — `coverage_note` always states how much of the document was actually checked.
- Triage is a single, unaudited LLM call per section — it can misjudge a checkable claim as not checkable.
- No auth, no rate limiting, no result persistence — refresh the page and results are gone.
- `.docx` only, validated via the `X-Filename` header.
