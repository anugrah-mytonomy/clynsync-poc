import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
import Spinner from '@/components/ui/Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-surface text-slate-900 border border-border hover:bg-border/60',
  danger: 'bg-danger text-white hover:bg-danger/90',
  ghost: 'bg-transparent text-primary hover:bg-primary/10',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-sm py-xs text-sm',
  md: 'px-md py-sm text-sm',
  lg: 'px-lg py-md text-base',
};

const Button = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) => {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-sm rounded font-sans font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Spinner className="text-current" />}
      {children}
    </button>
  );
};

export default Button;
