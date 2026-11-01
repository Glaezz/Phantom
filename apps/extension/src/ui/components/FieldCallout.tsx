import { useEffect, useState } from 'react';
import type { Status } from '../types';
import { copy } from '../copy.id';

// Kontrak Design.md §6.5. Maks 1 per laman per sesi; posisi dari getBoundingClientRect (ARC-06/DS-05: tanpa .value).
export function FieldCallout({
  status,
  targetRect,
}: {
  status: Exclude<Status, 'official' | 'neutral'>;
  targetRect: DOMRect | null;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => setVisible(true), [targetRect]);

  if (!visible || !targetRect) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    top: targetRect.bottom + 8,
    left: Math.max(8, targetRect.left),
    maxWidth: Math.min(320, window.innerWidth - 16),
  };

  return (
    <div
      className="ph-callout ph-surface"
      data-status={status}
      role="status"
      aria-live="polite"
      style={style}
    >
      <span className="ph-callout-arrow" aria-hidden="true" />
      <p className="ph-callout-text">{copy.callout.dontFill}</p>
    </div>
  );
}
