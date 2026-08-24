import React from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'outline' | 'secondary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
  as?: 'button' | 'a';
  href?: string;
  children: React.ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary:   'btn-primary',
  outline:   'btn-outline',
  secondary: 'btn-secondary',
  ghost:     'btn-ghost',
  danger:    'btn-danger',
};

const sizeClass: Record<Size, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      block = false,
      children,
      className = '',
      disabled,
      ...rest
    },
    ref
  ) => {
    const classes = [
      'btn',
      variantClass[variant],
      sizeClass[size],
      block ? 'btn-block' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        {...rest}
      >
        {loading && <Loader2 size={14} strokeWidth={2.5} className="spin-icon" style={{ animation: 'spin 0.65s linear infinite' }} />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
