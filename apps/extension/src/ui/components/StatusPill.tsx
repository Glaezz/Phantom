import { useEffect, useState } from 'react';
import type { Status } from '../types';
import { copy } from '../copy.id';
import { StatusIcon } from './StatusIcon';

export function StatusPill({ status, onOpen }: {
  status: Extract<Status, 'caution' | 'danger'>;
  onOpen: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    setExpanded(true);
    const timer = setTimeout(() => setExpanded(false), 8000);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div className="ph-pill-status" role="status" aria-live="polite" aria-atomic="true">
      <button type="button" className="ph-pill ph-surface" data-status={status} data-expanded={expanded}
        aria-label={copy.pill.open.replace('{status}', copy.status[status].short)} onClick={onOpen}>
        <StatusIcon status={status} size={20} />
        <span className="ph-pill-label">{copy.status[status].short}</span>
      </button>
    </div>
  );
}
