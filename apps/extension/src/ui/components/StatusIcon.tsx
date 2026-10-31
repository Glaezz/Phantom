import type { Status } from '../types';

// Ikon status sesuai Design.md §5 (DS-60/61): inline SVG, aria-hidden, bentuk tetap.
// currentColor agar pewarnaan dari token --${status}-fg di komponen pemakai.
const paths: Record<Status, React.ReactNode> = {
  official: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.6-4.8" />
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
      <path d="M12 3.5 21 19.5H3L12 3.5Z" />
      <path d="M12 9.5v4" />
      <path d="M12 16.5h.01" />
    </>
  ),
  danger: (
    <>
      <path d="M8.5 3.5h7l5 5v7l-5 5h-7l-5-5v-7l5-5Z" />
      <path d="M12 8.5v4.5" />
      <path d="M12 16h.01" />
    </>
  ),
};

export function StatusIcon({ status, size = 24 }: { status: Status; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[status]}
    </svg>
  );
}
