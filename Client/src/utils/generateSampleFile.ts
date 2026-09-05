/**
 * Builds a synthetic File of an arbitrary size for exercising the upload
 * pipeline without needing to source a real large file. Reuses the same
 * small chunk as every Blob part instead of allocating `sizeMB` worth of
 * memory up front — the browser only materializes bytes as parts are
 * actually read (i.e. as each upload chunk is sliced off during upload).
 */
export function createSampleFile(sizeMB: number, chunkSizeMB = 1): File {
  const chunkBytes = Math.max(1, chunkSizeMB) * 1024 * 1024;
  const chunk = new Uint8Array(chunkBytes);
  // A little real randomness so the data isn't trivially compressible;
  // the rest can stay zeroed — content doesn't matter for a perf test.
  crypto.getRandomValues(chunk.subarray(0, Math.min(65536, chunkBytes)));

  const totalChunks = Math.max(1, Math.ceil((sizeMB * 1024 * 1024) / chunkBytes));
  const parts: BlobPart[] = new Array(totalChunks).fill(chunk);

  return new File(parts, `sample-${sizeMB}mb.bin`, { type: 'application/octet-stream' });
}
