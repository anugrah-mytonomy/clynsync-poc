import { cn } from '@/utils/cn';
import { formatBytes } from '@/utils/formatBytes';
import ProgressBar from '@/components/ui/ProgressBar';
import ScanResults from '@/components/ui/uploadFile/ScanResults';
import {
  AlertIcon,
  CheckCircleIcon,
  CloudIcon,
  DocumentIcon,
  RefreshIcon,
  TrashIcon,
  VideoIcon,
} from '@/components/ui/icons';
import type { UploadQueueItem } from '@/types/contentLibrary';

interface UploadQueueRowProps {
  item: UploadQueueItem;
  onRemove: (id: string) => void;
  onRetryCloudUpload?: (id: string) => void;
}

const CloudUploadStatusLine = ({
  item,
  onRetryCloudUpload,
}: {
  item: UploadQueueItem;
  onRetryCloudUpload?: (id: string) => void;
}) => {
  const cloudUpload = item.cloudUpload;
  if (!cloudUpload) return null;

  if (cloudUpload.status === 'uploading') {
    return (
      <div className="mt-sm flex items-center gap-sm">
        <ProgressBar
          value={cloudUpload.percent}
          variant="primary"
          label={`${item.name} upload progress`}
          className="flex-1"
        />
        <span className="shrink-0 text-xs font-medium text-slate-900">{cloudUpload.percent}%</span>
        <span className="shrink-0 text-xs text-muted">
          {formatBytes(cloudUpload.uploadedBytes)} / {formatBytes(cloudUpload.totalBytes)}
        </span>
      </div>
    );
  }

  if (cloudUpload.status === 'success') {
    return (
      <p className="mt-xs flex items-center gap-xs text-xs text-muted">
        <CloudIcon className="h-3.5 w-3.5" />
        Stored in cloud storage
      </p>
    );
  }

  if (cloudUpload.status === 'failed') {
    return (
      <div className="mt-xs flex items-center gap-sm">
        <p className="truncate text-xs text-danger" title={cloudUpload.error}>
          Cloud upload failed{cloudUpload.error ? `: ${cloudUpload.error}` : '.'}
        </p>
        {onRetryCloudUpload && (
          <button
            type="button"
            onClick={() => onRetryCloudUpload(item.id)}
            className="flex shrink-0 items-center gap-xs text-xs font-medium text-danger underline hover:no-underline"
          >
            <RefreshIcon className="h-3.5 w-3.5" />
            Retry
          </button>
        )}
      </div>
    );
  }

  return null;
};

const UploadQueueRow = ({ item, onRemove, onRetryCloudUpload }: UploadQueueRowProps) => {
  const hasVideoSections = Boolean(item.validation?.videoSections?.length);
  const isQueued = item.status === 'queued';
  const isScanning = item.status === 'scanning';
  const isSuccess = item.status === 'success';
  const isFailed = item.status === 'validation-failed' || item.status === 'upload-failed';
  const scanProgress =
    item.scan && item.scan.totalChecks
      ? Math.round((item.scan.sections.length / item.scan.totalChecks) * 100)
      : 0;

  return (
    <li className="flex items-start gap-md py-md">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface text-muted">
        {hasVideoSections ? <VideoIcon className="h-4 w-4" /> : <DocumentIcon className="h-4 w-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-md">
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'truncate text-sm font-medium',
                isQueued ? 'text-muted' : 'text-slate-900',
                isSuccess && 'text-slate-900',
              )}
            >
              {item.name}
            </p>
            {!isScanning && (
              <p className="text-xs text-muted">
                {formatBytes(item.size)}
                {hasVideoSections &&
                  ` · ${item.validation!.videoSections!.length} video section${item.validation!.videoSections!.length === 1 ? '' : 's'}`}
                {item.validation?.zipEntries &&
                  ` · ${item.validation.zipEntries.filter((entry) => entry.valid).length}/${item.validation.zipEntries.length} documents valid`}
              </p>
            )}
            {item.status === 'validation-failed' && item.validation?.errors && (
              <p className="truncate text-xs text-danger">{item.validation.errors.join(' ')}</p>
            )}
            {item.status === 'upload-failed' && item.scan?.error && (
              <p className="truncate text-xs text-danger" title={item.scan.error}>
                {item.scan.error}
              </p>
            )}
            {item.scan && <ScanResults scan={item.scan} />}
            <CloudUploadStatusLine item={item} onRetryCloudUpload={onRetryCloudUpload} />
          </div>

          <div className="shrink-0 text-right">
            {isSuccess && (
              <span className="flex items-center justify-end gap-xs text-xs font-medium text-success">
                <CheckCircleIcon className="h-4 w-4" />
                {item.scan && item.scan.status !== 'unsupported' ? 'Scan complete' : 'Validated'}
              </span>
            )}

            {isQueued && <span className="text-xs text-muted">Queued for upload</span>}

            {isFailed && (
              <span
                className="flex items-center justify-end gap-xs text-xs font-medium text-danger"
                title={item.validation?.errors.join(' ')}
              >
                <AlertIcon className="h-4 w-4 shrink-0" />
                {item.status === 'validation-failed' ? 'Validation failed' : 'Upload failed'}
              </span>
            )}
          </div>
        </div>

        {isScanning && (
          <div className="mt-sm flex items-center gap-sm">
            <ProgressBar
              value={scanProgress}
              variant="accent"
              label={`${item.name} scan progress`}
              className="flex-1"
            />
            <span className="shrink-0 text-xs font-medium text-slate-900">{scanProgress}%</span>
            <span className="shrink-0 text-xs text-muted">{formatBytes(item.size)}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onRemove(item.id)}
        disabled={isScanning}
        aria-label={`Remove ${item.name}`}
        className="shrink-0 rounded-md p-xs text-muted transition-colors hover:bg-surface hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </li>
  );
};

export default UploadQueueRow;
