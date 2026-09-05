"""Performance/correctness validation for the direct-to-S3 chunked upload path.

Drives the exact HTTP contract the browser client uses (Client/src/utils/
s3ChunkedUpload.ts): POST /api/uploads/initiate on this app's own server,
then concurrent presigned PUTs straight to S3 (or the local mock), then
POST /api/uploads/complete. Only ever holds one chunk per worker in memory —
proving upload size isn't bounded by this script's (or the browser's, or the
app server's) memory, only by disk space for the source file.

Usage (from Server/, with the app server and moto_server both already running):
    .venv/Scripts/python.exe scripts/validate_large_upload.py --size-mb 250
"""

import argparse
import hashlib
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

try:
    import resource  # Unix only

    def peak_rss_mb() -> float:
        return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
except ImportError:  # Windows
    import psutil

    _process = psutil.Process(os.getpid())

    def peak_rss_mb() -> float:
        return _process.memory_info().peak_wset / (1024 * 1024)


def generate_sample_file(path: str, size_mb: int, chunk_mb: int = 8) -> str:
    """Writes a size_mb file in chunk_mb pieces (never holds it all in memory)
    and returns its SHA-256 so the round trip can be verified byte-for-byte."""
    chunk = os.urandom(chunk_mb * 1024 * 1024)
    remaining = size_mb * 1024 * 1024
    digest = hashlib.sha256()

    with open(path, "wb") as handle:
        while remaining > 0:
            piece = chunk[: min(len(chunk), remaining)]
            handle.write(piece)
            digest.update(piece)
            remaining -= len(piece)

    return digest.hexdigest()


def upload_part(
    api_base: str, url: str, file_path: str, start: int, end: int, session: requests.Session
) -> tuple[int, str]:
    with open(file_path, "rb") as handle:
        handle.seek(start)
        data = handle.read(end - start)

    response = session.put(url, data=data, headers={"Content-Type": "application/octet-stream"})
    response.raise_for_status()
    etag = response.headers.get("ETag")
    if not etag:
        raise RuntimeError("No ETag in part-upload response.")
    return len(data), etag


def run_validation(api_base: str, size_mb: int, concurrency: int, keep_file: bool) -> None:
    sample_path = os.path.join(os.path.dirname(__file__), "..", f"_perf_sample_{size_mb}mb.bin")
    sample_path = os.path.abspath(sample_path)

    print(f"Generating {size_mb} MB sample file at {sample_path} ...")
    expected_hash = generate_sample_file(sample_path, size_mb)
    file_size = os.path.getsize(sample_path)
    print(f"  sha256={expected_hash}")

    session = requests.Session()
    started_at = time.monotonic()

    initiate = session.post(
        f"{api_base}/api/uploads/initiate",
        json={"filename": os.path.basename(sample_path), "fileSize": file_size, "contentType": "application/octet-stream"},
    )
    initiate.raise_for_status()
    initiated = initiate.json()
    upload_id, key, part_size, total_parts = (
        initiated["uploadId"],
        initiated["key"],
        initiated["partSize"],
        initiated["totalParts"],
    )
    print(f"Initiated upload: {total_parts} parts of up to {part_size / 1_048_576:.1f} MB each.")

    part_numbers = list(range(1, total_parts + 1))
    presign = session.post(
        f"{api_base}/api/uploads/parts/presign",
        json={"key": key, "uploadId": upload_id, "partNumbers": part_numbers},
    )
    presign.raise_for_status()
    urls = {int(k): v for k, v in presign.json()["urls"].items()}

    parts_meta = []
    for part_number in part_numbers:
        start = (part_number - 1) * part_size
        end = min(start + part_size, file_size)
        parts_meta.append((part_number, start, end))

    completed_parts: dict[int, str] = {}
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = {
            pool.submit(upload_part, api_base, urls[part_number], sample_path, start, end, session): part_number
            for part_number, start, end in parts_meta
        }
        for future in as_completed(futures):
            part_number = futures[future]
            _, etag = future.result()
            completed_parts[part_number] = etag

    complete = session.post(
        f"{api_base}/api/uploads/complete",
        json={
            "key": key,
            "uploadId": upload_id,
            "parts": [{"partNumber": n, "etag": completed_parts[n]} for n in part_numbers],
        },
    )
    complete.raise_for_status()
    location = complete.json()["location"]

    elapsed = time.monotonic() - started_at
    throughput_mb_s = (file_size / 1_048_576) / elapsed if elapsed > 0 else float("inf")

    print(f"\nCompleted: {location}")
    print(f"Elapsed: {elapsed:.2f}s  Throughput: {throughput_mb_s:.1f} MB/s  Concurrency: {concurrency}")
    print(f"Peak RSS of this validation script: {peak_rss_mb():.1f} MB (file was {size_mb} MB)")

    if not keep_file:
        os.remove(sample_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-base", default=os.environ.get("VALIDATE_API_BASE", "http://127.0.0.1:8000"))
    parser.add_argument("--size-mb", type=int, default=250)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--keep-file", action="store_true")
    args = parser.parse_args()

    run_validation(args.api_base, args.size_mb, args.concurrency, args.keep_file)
