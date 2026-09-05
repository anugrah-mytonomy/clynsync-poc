# POC 5: Large File Upload with ReactJS

**Status:** Built and validated locally (mock S3). Ready for a real AWS bucket to be dropped in.
**Where to see it:** Sidebar → **POC 5** (`/dashboard/poc-5`), in the Clinic AI Portal React app.

---

## 1. What this POC set out to prove

| Task | Delivered |
|---|---|
| Build a ReactJS file upload interface | Yes — dropzone + queue with live status, on the new **POC 5** page |
| Support large file uploads using streaming/chunked upload | Yes — files are sliced into chunks client-side and uploaded incrementally |
| Upload files directly to S3 or Google Drive | Yes, to **S3** (browser → S3 directly, not routed through our server) |
| Handle upload progress, failures, and retry scenarios | Yes — live progress bar, automatic retry with backoff, manual "Retry" on the UI after that's exhausted |
| Validate performance with large sample files | Yes — see §5 (250 MB scripted test + in-browser sample generator up to 1 GB) |

| Success criterion | Result |
|---|---|
| Large files upload without loading the entire file into memory | **Confirmed.** A 250 MB upload peaked at ~65 MB of memory in the uploading process; our app server never sees file bytes at all (see §3) |
| Upload progress and failure handling are supported | **Confirmed** — live % + bytes, per-chunk retry, resumable manual retry, cancel |
| Cloud storage integration is validated | **Confirmed against a local S3-compatible mock** (byte-for-byte integrity verified); real AWS not yet exercised — see §7 |

---

## 2. The one idea this POC is built around

Normally, uploading a file means: browser → your server → cloud storage. Your server has to receive the whole thing before it can hand it off, which means it's holding the file in memory (or writing it to disk) the entire time. For a 500 MB video, that's 500 MB of RAM per concurrent upload on your server, times however many users are uploading at once.

**This POC skips that middle step.** The browser talks to S3 directly. Our server's only job is to hand out temporary, pre-signed permission slips ("you're allowed to upload part 3 of this specific file, for the next hour") — a few hundred bytes of JSON. The actual file bytes never pass through our server. That's what makes the memory story work: our server's memory use doesn't depend on file size at all, and the browser only ever holds one small chunk per upload slot in memory, not the whole file.

```
Browser                          Our App Server                    S3 (or local mock)
   |                                    |                                  |
   |--- "I want to upload X.mp4" ----->|                                  |
   |<-- uploadId, key, chunk plan -----|                                  |
   |                                    |                                  |
   |--- "give me upload URLs" -------->|                                  |
   |<-- presigned URL per chunk -------|                                  |
   |                                    |                                  |
   |======= chunk 1 bytes ============================================>  |   (direct, not through our server)
   |======= chunk 2 bytes ============================================>  |
   |======= chunk 3 bytes ============================================>  |
   |                                    |                                  |
   |--- "all chunks done, here are their receipts (ETags)" ------------->|
   |<---------------------- "assembled, here's the final file" ---------|
```

This is the standard pattern S3 itself calls **multipart upload** — it's not something we invented, we're just wiring the browser up to speak it directly instead of proxying it.

---

## 3. How it works, piece by piece

### Client side (`Client/src/utils/s3ChunkedUpload.ts`)

- **Slicing without loading the file:** `File.slice(start, end)` produces a lazy reference to a byte range of the file — the browser doesn't read those bytes into memory until something actually uploads that slice. So even a 5 GB file sits on disk until each 8 MB piece is sent.
- **Chunk size:** 8 MB per part (configurable), matching S3's own rules (every part except the last must be ≥ 5 MB).
- **Concurrency:** up to 4 chunks upload at the same time (a small worker pool), so throughput isn't limited to one chunk at a time on a large file.
- **Progress:** each chunk is sent via `XMLHttpRequest` (not `fetch`, because only XHR exposes upload progress events in the browser). Progress from all in-flight chunks is summed and reported as one overall percentage.
- **Retry:** if a chunk's upload fails (network blip, expired URL, S3 hiccup), it's retried automatically up to 5 times with exponential backoff (0.5s, 1s, 2s, 4s, 8s). If a chunk keeps failing after that, the whole upload is marked failed — but every chunk that *did* succeed stays recorded.
- **Resume, not restart:** clicking "Retry" in the UI doesn't start over — it re-fetches fresh upload URLs and only re-sends the chunks that never made it. For a 2 GB file where only the last chunk failed, retry re-sends a few MB, not 2 GB.
- **Cancel:** aborts any in-flight requests and tells S3 to throw away the incomplete upload (so it doesn't sit around consuming storage).

### Server side (`Server/scripts/s3_storage.py`, `Server/scripts/upload_routes.py`)

Five small endpoints under `/api/uploads/*`:

| Endpoint | Job |
|---|---|
| `POST /initiate` | Tells S3 "a new multipart upload is starting," returns an ID + the chunk plan |
| `POST /parts/presign` | Generates the temporary, signed URLs the browser uploads each chunk to |
| `GET /{uploadId}/parts` | Lists which chunks S3 already has — used to resume after a page refresh |
| `POST /complete` | Tells S3 "here are all the chunks and their receipts, assemble them" |
| `POST /abort` | Tells S3 to discard an incomplete upload |

None of these ever read a file's bytes — every request/response here is small JSON. That's the whole trick.

### Where the files actually land

Locally, this points at a **mock S3 server** (`moto_server`, an open-source tool that speaks the real S3 API) so the whole thing works without an AWS account. Swapping to a real AWS bucket is an environment-variable change, not a code change — see §7.

---

## 4. How this was built (the actual process)

1. **Looked at what already existed.** The app already had a "Content Library" upload page that sends a whole `.docx` file to our server for AI-based clinical scanning — but that path reads the entire file into server memory on purpose (it needs the whole document to run the LLM comparison). That's fine for a 36 KB `.docx`, but wrong for a 2 GB training video. So this POC deliberately does *not* touch that scanning path — it's a separate mechanism for a separate problem (getting large files into storage), living on its own page.

2. **Picked S3 over Google Drive**, and a local mock over needing real AWS credentials up front — confirmed with you before writing any code, since it changes which SDK and endpoints get built.

3. **Proved the core mechanic in isolation first**, before building any app code: a 10-line script that creates a multipart upload, uploads two parts via presigned URLs, and completes it — run directly against the mock S3 server. This caught a real bug early (see box below) cheaply, before it was buried under app code.

   > **A bug worth mentioning:** the first version of the server code read AWS configuration from environment variables *before* the app had actually loaded the `.env` file — a subtle ordering issue. It silently fell through to trying to talk to *real* AWS with fake credentials instead of the local mock, and failed with a confusing "invalid access key" error. Caught by testing against a live server instead of trusting the code by inspection, and fixed by reading configuration lazily (matching how the rest of this codebase already does it) instead of once at import time.

4. **Built the server endpoints**, then the client upload utility, then wired both into the existing Content Library page first (fastest way to get an end-to-end path working against real UI components).

5. **You asked for it as its own thing** — a dedicated **POC 5** page and sidebar entry, separate from Content Library, matching the original POC 5 brief exactly. Extracted the same upload engine into a standalone page (`Client/src/pages/poc5/Poc5Page.tsx`) that accepts *any* file type (not just clinical document formats) and added an in-browser "generate a sample file" tool so performance can be validated without needing to find a real large file lying around.

6. **Validated it three separate ways** (detail in §5): a scripted large-file test measuring memory and throughput, an automated headless-browser test driving the real UI (including deliberately breaking uploads to prove retry works), and a manual pass in the actual running app.

---

## 5. Validation performed

### A. Scripted 250 MB upload (`Server/scripts/validate_large_upload.py`)

Drives the exact same HTTP calls the browser makes, end to end, then verifies the result byte-for-byte:

```
Generating 250 MB sample file...
Initiated upload: 32 parts of up to 8.0 MB each.
Completed: http://clinsync-uploads.s3.amazonaws.com/uploads/.../file.bin
Elapsed: 6.08s   Throughput: 41.1 MB/s   Concurrency: 4
Peak RSS of this validation script: 64.6 MB   (file was 250 MB)
```

Then independently re-downloaded the object from S3 and hashed it (SHA-256) — **matched exactly**, confirming no corruption across the chunk/reassemble round trip.

The headline number: **64.6 MB of memory to move a 250 MB file.** Memory use is bounded by chunk size × concurrency, not file size — a 5 GB file would use roughly the same amount, not 20× more.

### B. Automated browser testing (headless Chromium, driving the real app)

- Dropped a file in, watched it progress to "Stored in cloud storage" with zero console errors.
- Uploaded a 40 MB file with the network artificially slowed down, captured a screenshot mid-upload showing a live progress bar.
- **Deliberately broke the network** for one file's uploads, watched all 5 automatic retries exhaust and the UI correctly show a "Cloud upload failed" message with a Retry button, then un-broke the network, clicked Retry, and watched it complete — proving the failure/retry path works, not just the happy path.
- Navigated to the new **POC 5** page via the sidebar, used the in-page "Upload 50 MB sample" button, watched it complete successfully.

### C. Manual verification

Ran the actual dev server (`npm run dev`) and used the feature by hand in a real browser to confirm what the automation reported.

---

## 6. How to run it locally

```bash
# Terminal 1 — local S3-compatible mock (no AWS account needed)
cd Server
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/moto_server -p 5001

# Terminal 2 — app server (auto-detects the mock via .env)
cd Server
.venv/Scripts/python -m uvicorn app:app --port 8000

# Terminal 3 — React app
cd Client
npm run dev
```

Open `http://localhost:5173/dashboard/poc-5`.

Full configuration reference: `Server/README.md`, section **"Direct-to-S3 chunked uploads."**

---

## 7. What's not done yet (being upfront about scope)

- **Google Drive isn't implemented** — the brief said "S3 *or* Google Drive"; S3 was the agreed choice. The client-side chunking/retry logic doesn't care which storage backend it talks to, so adding Drive later means a second small backend adapter, not a rewrite.
- **Not yet run against a real AWS bucket** — validated against a local S3-compatible mock (`moto_server`) that speaks the identical API, per what we agreed going in (no AWS account was available to test against). Pointing at real AWS is an environment-variable change (documented in `Server/README.md`), but hasn't been done.
- **No authentication on the upload endpoints themselves** — they trust whatever the (already-behind-login) app sends. Fine for a POC; would need real user/tenant checks before this touches production data.
- **No database record of what got uploaded** — S3 has the file, but nothing in this POC writes "user X uploaded file Y at time Z" anywhere durable. That's a natural next step once this moves past proof-of-concept.
- **The in-browser sample-file generator** (used for performance testing without a real large file) produces synthetic data — fine for exercising the upload pipeline, not a stand-in for testing with real clinical video content.

---

## 8. Files touched

**New:**
- `Client/src/utils/s3ChunkedUpload.ts` — the chunked-upload engine
- `Client/src/utils/generateSampleFile.ts` — in-browser large-file generator for perf testing
- `Client/src/pages/poc5/Poc5Page.tsx` — the standalone POC 5 page
- `Server/scripts/s3_storage.py` — S3 multipart orchestration
- `Server/scripts/upload_routes.py` — the `/api/uploads/*` endpoints
- `Server/scripts/validate_large_upload.py` — scripted large-file validation tool

**Modified:**
- `Server/app.py` (wired in the new routes + startup bucket setup)
- `Server/requirements.txt`, `Server/.env.example` (new dependencies/config)
- `Client/src/routes/private.routes.tsx`, `Client/src/components/layout/Sidebar.tsx` (POC 5 nav entry)
- `Client/src/types/contentLibrary.ts`, `Client/src/components/ui/uploadFile/*`, `Client/src/pages/content-library/ContentLibraryPage.tsx` (the same upload engine also wired into the existing Content Library page, so large clinical files there benefit too)
