import { cn } from '@/utils/cn';

interface SpinnerProps {
  className?: string;
  label?: string;
}

const Spinner = ({ className, label = 'Loading' }: SpinnerProps) => {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  );
};

export default Spinner;
