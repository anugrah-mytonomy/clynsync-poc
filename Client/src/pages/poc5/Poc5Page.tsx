import { useRef, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import UploadDropzone from '@/components/ui/uploadFile/UploadDropzone';
import UploadQueue from '@/components/ui/uploadFile/UploadQueue';
import { S3MultipartUploader, S3UploadAborted } from '@/utils/s3ChunkedUpload';
import { createSampleFile } from '@/utils/generateSampleFile';
import type { CloudUploadState, UploadQueueItem } from '@/types/contentLibrary';

let idCounter = 0;
const createItemId = () => {
  idCounter += 1;
  return `poc5-item-${idCounter}`;
};

const SAMPLE_SIZES_MB = [50, 250, 1024];

/**
 * POC 5: Large File Upload with ReactJS.
 *
 * Standalone from the Content Library's clinical scan flow — this page is
 * only about the upload mechanic itself: any file type, streamed directly to
 * S3 in chunks (Client/src/utils/s3ChunkedUpload.ts) with live progress and
 * retry, never fully loaded into memory. See POC5_Large_File_Upload.md at
 * the repo root for the full write-up.
 */
const Poc5Page = () => {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const uploadersRef = useRef(new Map<string, S3MultipartUploader>());

  const patchCloudUpload = (id: string, updater: (cloudUpload: CloudUploadState) => CloudUploadState) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const current: CloudUploadState =
          item.cloudUpload ?? { status: 'idle', uploadedBytes: 0, totalBytes: item.size, percent: 0 };
        return { ...item, cloudUpload: updater(current) };
      }),
    );
  };

  const handleSettled = (id: string, run: Promise<{ key: string; location: string }>) => {
    run
      .then((result) => {
        patchCloudUpload(id, (cloudUpload) => ({
          ...cloudUpload,
          status: 'success',
          percent: 100,
          uploadedBytes: cloudUpload.totalBytes,
          key: result.key,
          location: result.location,
        }));
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'success' } : item)));
      })
      .catch((err: unknown) => {
        if (err instanceof S3UploadAborted) return;
        const message = err instanceof Error ? err.message : 'Cloud upload failed.';
        patchCloudUpload(id, (cloudUpload) => ({ ...cloudUpload, status: 'failed', error: message }));
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: 'upload-failed' } : item)),
        );
      });
  };

  const startUpload = (item: UploadQueueItem) => {
    const uploader = new S3MultipartUploader(item.file, {
      onProgress: (progress) =>
        patchCloudUpload(item.id, (cloudUpload) => ({
          ...cloudUpload,
          status: 'uploading',
          uploadedBytes: progress.uploadedBytes,
          totalBytes: progress.totalBytes,
          percent: progress.percent,
        })),
    });
    uploadersRef.current.set(item.id, uploader);
    patchCloudUpload(item.id, (cloudUpload) => ({ ...cloudUpload, status: 'uploading', error: undefined }));
    handleSettled(item.id, uploader.start());
  };

  const retryUpload = (id: string) => {
    const uploader = uploadersRef.current.get(id);
    if (!uploader) return;
    patchCloudUpload(id, (cloudUpload) => ({ ...cloudUpload, status: 'uploading', error: undefined }));
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'queued' } : item)));
    handleSettled(id, uploader.retry());
  };

  const cancelUpload = (id: string) => {
    uploadersRef.current.get(id)?.cancel();
    uploadersRef.current.delete(id);
  };

  const addFiles = (files: FileList | File[]) => {
    const newItems: UploadQueueItem[] = Array.from(files).map((file) => ({
      id: createItemId(),
      file,
      name: file.name,
      extension: null,
      size: file.size,
      status: 'queued',
      validated: true,
      validation: { valid: true, errors: [] },
    }));

    setItems((prev) => [...prev, ...newItems]);
    for (const item of newItems) startUpload(item);
  };

  const addSampleFile = (sizeMB: number) => {
    addFiles([createSampleFile(sizeMB)]);
  };

  const handleRemove = (id: string) => {
    cancelUpload(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearQueue = () => {
    for (const item of items) cancelUpload(item.id);
    setItems([]);
  };

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="POC 5: Large File Upload"
        subtitle="Chunked, direct-to-S3 uploads with progress, retry, and no full-file memory buffering."
      />

      <div className="flex flex-col gap-lg p-lg">
        <div className="rounded-lg border border-border bg-background p-lg">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Upload Files</p>
          <div className="mt-sm">
            <UploadDropzone onFilesSelected={addFiles} accept="*/*" formatsLabel="Any file type or size" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background p-lg">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Performance validation — generate a sample file in-browser
          </p>
          <p className="mt-xs text-xs text-muted">
            Builds a synthetic file client-side (never fully materialized in memory) so upload
            performance can be checked without sourcing a real large file.
          </p>
          <div className="mt-sm flex flex-wrap gap-sm">
            {SAMPLE_SIZES_MB.map((sizeMB) => (
              <Button key={sizeMB} variant="secondary" size="sm" onClick={() => addSampleFile(sizeMB)}>
                Upload {sizeMB >= 1024 ? `${sizeMB / 1024} GB` : `${sizeMB} MB`} sample
              </Button>
            ))}
          </div>
        </div>

        {items.length > 0 && (
          <div className="rounded-lg border border-border bg-background p-lg">
            <UploadQueue
              title="Uploads"
              items={items}
              onRemove={handleRemove}
              onRetryCloudUpload={retryUpload}
            />
          </div>
        )}

        {items.length > 0 && (
          <div className="flex items-center justify-between pt-md">
            <button
              type="button"
              onClick={handleClearQueue}
              className="text-sm font-medium text-muted hover:text-slate-900"
            >
              Clear Queue
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Poc5Page;
