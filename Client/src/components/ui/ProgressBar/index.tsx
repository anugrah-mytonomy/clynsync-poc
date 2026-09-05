import { cn } from '@/utils/cn';

type ProgressBarVariant = 'primary' | 'accent' | 'success' | 'danger';

interface ProgressBarProps {
  value: number;
  variant?: ProgressBarVariant;
  label?: string;
  className?: string;
}

const variantClasses: Record<ProgressBarVariant, string> = {
  primary: 'bg-primary',
  accent: 'bg-danger',
  success: 'bg-success',
  danger: 'bg-danger',
};

const ProgressBar = ({ value, variant = 'primary', label, className }: ProgressBarProps) => {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-border', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-150', variantClasses[variant])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};

export default ProgressBar;
