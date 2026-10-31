import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import type { Status } from '../../lib/types';
import { copy } from '../copy.id';
import './Button.css';

type Variant = 'primary' | 'status' | 'secondary' | 'tertiary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  // Hanya dipakai oleh varian `status` (mis. Batal Kirim di banner).
  status?: Status;
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  status = 'danger',
  loading = false,
  loadingLabel = copy.web.checking,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['ph-button', `ph-button--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  const style =
    variant === 'status'
      ? ({
          '--button-bg': `var(--${status}-strong)`,
          '--button-fg': `var(--${status}-on)`,
        } as CSSProperties)
      : undefined;

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      style={style}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <>
          <span className="ph-button__spinner" aria-hidden="true" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
