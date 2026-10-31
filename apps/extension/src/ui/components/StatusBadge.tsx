import type { Status } from '../types';
import { copy } from '../copy.id';
import { StatusIcon } from './StatusIcon';

// Kontrak Design.md §6.1: pil status, ikon + kata pendek (DS-02), warna lewat pola var(--${status}-*) (DS-41).
export function StatusBadge({
  status,
  size = 'md',
  showLabel = true,
}: {
  status: Status;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}) {
  return (
    <span
      className="ph-badge ph-surface"
      data-status={status}
      data-size={size}
      role="status"
    >
      <StatusIcon status={status} size={size === 'sm' ? 16 : 20} />
      {showLabel && <span className="ph-badge-label">{copy.status[status].short}</span>}
    </span>
  );
}
