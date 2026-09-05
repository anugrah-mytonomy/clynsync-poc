import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  error?: string;
  size?: InputSize;
  fullWidth?: boolean;
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'px-sm py-xs text-sm',
  md: 'px-md py-sm text-sm',
  lg: 'px-lg py-md text-base',
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, size = 'md', fullWidth = true, id, className, ...props }, ref) => {
    const inputId = id ?? props.name;

    return (
      <div className={cn('flex flex-col gap-xs', fullWidth && 'w-full')}>
        <label htmlFor={inputId} className="text-sm font-medium text-slate-900">
          {label}
        </label>
        <input
          id={inputId}
          ref={ref}
          aria-invalid={Boolean(error)}
          className={cn(
            'rounded border border-border bg-background text-slate-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20',
            sizeClasses[size],
            fullWidth && 'w-full',
            error && 'border-danger focus:border-danger focus:ring-danger/20',
            className,
          )}
          {...props}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
