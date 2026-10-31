import { forwardRef } from 'react';
import type { Status } from '../types';
import { copy } from '../copy.id';

// Kontrak Design.md §6.2. Varian status memakai var(--${status}-strong|on) (DS-41).
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'status' | 'secondary' | 'tertiary';
  status?: Status; // wajib bila variant === 'status'
  loading?: boolean;
  minWidth160?: boolean; // Batal Kirim di gate (min lebar 160px)
  tall?: boolean;        // 48px (Batal Kirim di gate); default --hit-min (44px)
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', status, loading = false, minWidth160, tall, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={[
        'ph-btn',
        `ph-btn-${variant}`,
        minWidth160 ? 'ph-btn-minw' : '',
        tall ? 'ph-btn-tall' : '',
        className ?? '',
      ].join(' ').trim()}
      data-status={variant === 'status' ? status : undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="ph-btn-spinner" aria-hidden="true" />}
      <span>{loading ? copy.web.checking : children}</span>
    </button>
  );
});
