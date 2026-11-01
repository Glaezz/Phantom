import type { CSSProperties } from 'react';
import type { Status } from '../../lib/types';
import { copy } from '../copy.id';
import { StatusIcon } from '../icons/StatusIcon';
import './StatusBadge.css';

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md';
  // DS-02: badge dilarang tampil tanpa kata, jadi label tidak pernah disembunyikan.
  showLabel?: true;
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const style = {
    '--badge-bg': `var(--${status}-bg)`,
    '--badge-fg': `var(--${status}-fg)`,
    '--badge-border': `var(--${status}-border)`,
  } as CSSProperties;

  return (
    <span
      className={`ph-status-badge ph-status-badge--${size}`}
      data-status={status}
      style={style}
    >
      <StatusIcon status={status} size={size === 'sm' ? 16 : 18} />
      <span>{copy.status[status].short}</span>
    </span>
  );
}
