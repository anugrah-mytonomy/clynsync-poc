/**
 * Direct-to-S3 chunked upload for large files.
 *
 * The file is never read into memory as a whole: `File.slice()` produces a
 * lazy Blob per chunk, and each chunk streams straight from the browser to
 * S3 (or the local mock — see Server/scripts/s3_storage.py) over a presigned
 * URL obtained from this app's own server (Server/scripts/upload_routes.py).
 * That server only ever sees small JSON metadata (keys, upload IDs, part
 * numbers, ETags) — file bytes never pass through it, so upload size isn't
 * bounded by anything on this app's backend.
 *
 * Multiple parts upload concurrently (bounded by MAX_CONCURRENT_PARTS) for
 * throughput on large files, each with its own retry/backoff. A failed part
 * (after retries exhausted) stops the pool and rejects `start()`, but
 * everything already-uploaded is kept — call `retry()` to resume from
 * exactly the parts that didn't make it, instead of re-uploading the file.
 */

const API_BASE = import.meta.env.VITE_SCAN_API_URL;
const MAX_CONCURRENT_PARTS = Number(import.meta.env.VITE_UPLOAD_CONCURRENCY) || 4;
const MAX_RETRIES_PER_PART = 5;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 15_000;

export class S3UploadError extends Error {}
export class S3UploadAborted extends Error {}

export interface S3UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  percent: number;
}

export interface S3UploadResult {
  key: string;
  location: string;
}

interface PartRecord {
  partNumber: number;
  start: number;
  end: number;
  etag?: string;
  uploadedBytes: number;
}

interface InitiateResponse {
  uploadId: string;
  key: string;
  partSize: number;
  totalParts: number;
}

function apiUrl(path: string): string {
  if (!API_BASE) {
    throw new S3UploadError(
      'VITE_SCAN_API_URL is not configured — set it in .env to point at the ClinSync server.',
    );
  }
  return `${API_BASE}${path}`;
}

async function readJsonOrThrow<T>(response: Response, context: string): Promise<T> {
  if (!response.ok) {
    let detail = `${context} failed (HTTP ${response.status}).`;
    try {
      const body = await response.json();
      if (typeof body?.detail === 'string') detail = body.detail;
    } catch {
      // non-JSON error body — fall back to the generic message
    }
    throw new S3UploadError(detail);
  }
  return response.json() as Promise<T>;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new S3UploadAborted('Upload canceled.'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new S3UploadAborted('Upload canceled.'));
      },
      { once: true },
    );
  });
}

/** PUTs one chunk with upload-progress events, resolving with its ETag response header. */
function putChunk(
  url: string,
  blob: Blob,
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
  registerXhr: (xhr: XMLHttpRequest) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new S3UploadAborted('Upload canceled.'));
      return;
    }

    const xhr = new XMLHttpRequest();
    registerXhr(xhr);

    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag');
        if (!etag) {
          reject(
            new S3UploadError(
              "Upload succeeded but no ETag header was readable — check the bucket's CORS " +
                'ExposeHeaders includes "ETag".',
            ),
          );
          return;
        }
        onProgress(blob.size);
        resolve(etag);
      } else {
        reject(new S3UploadError(`Chunk upload failed (HTTP ${xhr.status}).`));
      }
    };

    xhr.onerror = () => reject(new S3UploadError('Network error during chunk upload.'));
    xhr.onabort = () => reject(new S3UploadAborted('Upload canceled.'));

    xhr.send(blob);
  });
}

export class S3MultipartUploader {
  private readonly file: File;
  private readonly onProgress?: (progress: S3UploadProgress) => void;
  private readonly controller = new AbortController();
  private readonly activeXhrs = new Set<XMLHttpRequest>();

  private uploadId?: string;
  private key?: string;
  private parts: PartRecord[] = [];

  constructor(file: File, handlers: { onProgress?: (progress: S3UploadProgress) => void } = {}) {
    this.file = file;
    this.onProgress = handlers.onProgress;
  }

  /** Starts (or restarts from scratch) the upload. Resolves with the final object's key/location. */
  async start(): Promise<S3UploadResult> {
    const initiateResponse = await fetch(apiUrl('/api/uploads/initiate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: this.file.name,
        fileSize: this.file.size,
        contentType: this.file.type || 'application/octet-stream',
      }),
      signal: this.controller.signal,
    });
    const initiated = await readJsonOrThrow<InitiateResponse>(initiateResponse, 'Upload initiation');

    this.uploadId = initiated.uploadId;
    this.key = initiated.key;
    this.parts = this.buildParts(initiated.partSize, initiated.totalParts);

    return this.runToCompletion();
  }

  /** Resumes after a failed `start()`/`retry()` — re-uploads only parts that never succeeded. */
  async retry(): Promise<S3UploadResult> {
    if (!this.uploadId || !this.key) {
      throw new S3UploadError('Nothing to retry — call start() first.');
    }
    return this.runToCompletion();
  }

  /** Aborts all in-flight requests and tells S3 to discard the incomplete upload. */
  cancel(): void {
    this.controller.abort();
    for (const xhr of this.activeXhrs) xhr.abort();
    this.activeXhrs.clear();

    if (this.uploadId && this.key) {
      // Best-effort — the browser tab may be closing, so don't await this.
      void fetch(apiUrl('/api/uploads/abort'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: this.key, uploadId: this.uploadId }),
        keepalive: true,
      }).catch(() => {});
    }
  }

  private buildParts(partSize: number, totalParts: number): PartRecord[] {
    const parts: PartRecord[] = [];
    for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
      const start = (partNumber - 1) * partSize;
      const end = Math.min(start + partSize, this.file.size);
      parts.push({ partNumber, start, end, uploadedBytes: 0 });
    }
    return parts;
  }

  private reportProgress(): void {
    if (!this.onProgress) return;
    const uploadedBytes = this.parts.reduce((sum, part) => sum + part.uploadedBytes, 0);
    const totalBytes = this.file.size;
    this.onProgress({
      uploadedBytes,
      totalBytes,
      percent: totalBytes > 0 ? Math.min(100, Math.round((uploadedBytes / totalBytes) * 100)) : 100,
    });
  }

  private async presignParts(partNumbers: number[]): Promise<Record<number, string>> {
    const response = await fetch(apiUrl('/api/uploads/parts/presign'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: this.key, uploadId: this.uploadId, partNumbers }),
      signal: this.controller.signal,
    });
    const { urls } = await readJsonOrThrow<{ urls: Record<number, string> }>(
      response,
      'Presigning upload parts',
    );
    return urls;
  }

  private async uploadPartWithRetry(part: PartRecord, presignedUrl: string): Promise<void> {
    let attempt = 0;
    for (;;) {
      try {
        const blob = this.file.slice(part.start, part.end);
        part.etag = await putChunk(
          presignedUrl,
          blob,
          this.controller.signal,
          (loaded) => {
            part.uploadedBytes = loaded;
            this.reportProgress();
          },
          (xhr) => this.activeXhrs.add(xhr),
        );
        return;
      } catch (err) {
        if (err instanceof S3UploadAborted) throw err;

        part.uploadedBytes = 0;
        attempt += 1;
        if (attempt > MAX_RETRIES_PER_PART) {
          throw new S3UploadError(
            `Part ${part.partNumber} failed after ${MAX_RETRIES_PER_PART} retries: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }

        const delay = Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), RETRY_MAX_DELAY_MS);
        await sleep(delay, this.controller.signal);

        // A presigned URL can outlive several retries, but re-fetch on the
        // last attempt in case it expired mid-upload on a very slow link.
        if (attempt === MAX_RETRIES_PER_PART) {
          const urls = await this.presignParts([part.partNumber]);
          presignedUrl = urls[part.partNumber];
        }
      }
    }
  }

  private async runToCompletion(): Promise<S3UploadResult> {
    if (!this.uploadId || !this.key) throw new S3UploadError('Upload was not initiated.');

    const pending = this.parts.filter((part) => !part.etag);
    if (pending.length > 0) {
      const presignedUrls = await this.presignParts(pending.map((part) => part.partNumber));

      let cursor = 0;
      let firstError: unknown = null;

      const worker = async (): Promise<void> => {
        for (;;) {
          if (firstError) return;
          const index = cursor;
          cursor += 1;
          if (index >= pending.length) return;

          const part = pending[index];
          try {
            await this.uploadPartWithRetry(part, presignedUrls[part.partNumber]);
          } catch (err) {
            firstError ??= err;
            return;
          }
        }
      };

      const workerCount = Math.min(MAX_CONCURRENT_PARTS, pending.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      if (firstError) throw firstError;
    }

    const completeResponse = await fetch(apiUrl('/api/uploads/complete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: this.key,
        uploadId: this.uploadId,
        parts: this.parts.map((part) => ({ partNumber: part.partNumber, etag: part.etag })),
      }),
      signal: this.controller.signal,
    });
    return readJsonOrThrow<S3UploadResult>(completeResponse, 'Completing upload');
  }
}
