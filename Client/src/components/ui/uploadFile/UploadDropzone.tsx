import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { cn } from '@/utils/cn';
import { UploadIcon } from '@/components/ui/icons';

interface UploadDropzoneProps {
  onFilesSelected: (files: FileList) => void;
  accept: string;
  formatsLabel: string;
}

const UploadDropzone = ({ onFilesSelected, accept, formatsLabel }: UploadDropzoneProps) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (event.dataTransfer.files.length) onFilesSelected(event.dataTransfer.files);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) onFilesSelected(event.target.files);
    event.target.value = '';
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragActive(true);
      }}
      onDragLeave={() => setIsDragActive(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-sm rounded-lg border-2 border-dashed px-lg py-xl text-center transition-colors',
        isDragActive ? 'border-danger bg-danger/5' : 'border-danger/40 hover:bg-danger/5',
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/10 text-danger">
        <UploadIcon className="h-5 w-5" />
      </span>
      <p className="text-sm text-slate-900">
        Drag and drop files here{' '}
        <span className="font-medium text-danger underline">or click to browse</span>
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
      />
      <p className="text-xs text-muted">{formatsLabel}</p>
    </div>
  );
};

export default UploadDropzone;
