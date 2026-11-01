import type { ReactNode } from 'react';
import type { Status } from '../../lib/types';

interface StatusIconProps {
  status: Status;
  size?: number;
  className?: string;
}

// Empat bentuk tetap (Design.md bagian 5). Dilarang menukar bentuk antar status.
const SHAPES: Record<Status, ReactNode> = {
  official: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.6 2.6L16 9.5" />
    </>
  ),
  neutral: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </>
  ),
  caution: (
    <>
      <path d="M12 3.5 21.5 20.5H2.5L12 3.5Z" />
      <path d="M12 9.5v4.5" />
      <path d="M12 17.5h.01" />
    </>
  ),
  danger: (
    <>
      <path d="M8.5 3h7L21 8.5v7L15.5 21h-7L3 15.5v-7L8.5 3Z" />
      <path d="M12 8v5" />
      <path d="M12 16.5h.01" />
    </>
  ),
};

export function StatusIcon({ status, size = 24, className }: StatusIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {SHAPES[status]}
    </svg>
  );
}
