import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import type { Verdict } from '../types';
import { copy } from '../copy.id';
import { Button } from './Button';
import './HoldIndicator.css';

// Kontrak Design.md §6.4. Durasi tetap 6 dtk. Hanya tombol Batal.
// Pemanggil memicu resolve() lewat ref saat hasil (fixture) L4 tersedia:
// neutral → teks releasing 1 dtk (lalu pemanggil melanjutkan form);
// caution/danger → pemanggil mengganti komponen ini dengan VerdictBanner mode gate.
export interface HoldIndicatorHandle {
  resolve: (v: Verdict) => void;
}

export const HoldIndicator = forwardRef<
  HoldIndicatorHandle,
  {
    durationMs?: 6000;
    anchor: HTMLElement | null;
    onCancel: () => void;
    onResolve: (v: Verdict) => void;
  }
>(function HoldIndicator({ anchor, onCancel, onResolve }, ref) {
  const DURATION_MS = 6000;
  const [remainingSec, setRemainingSec] = useState(Math.ceil(DURATION_MS / 1000));
  const [releasing, setReleasing] = useState(false);
  const reducedMotion = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      setRemainingSec(Math.max(0, Math.ceil((DURATION_MS - elapsed) / 1000)));
    }, 250);
    return () => clearInterval(tick);
  }, []);

  useImperativeHandle(ref, () => ({
    resolve: (v: Verdict) => {
      if (v.status === 'neutral' || v.status === 'official') {
        setReleasing(true);
        setTimeout(() => onResolve(v), 1000);
      } else {
        onResolve(v);
      }
    },
  }), [onResolve]);

  const style = anchor
    ? undefined
    : { position: 'fixed' as const, bottom: 'var(--s-6)', left: '50%', transform: 'translateX(-50%)' };

  if (releasing) {
    return (
      <div className="ph-hold ph-surface" role="status" aria-live="polite" style={style}>
        <p className="ph-hold-text">{copy.hold.releasing}</p>
      </div>
    );
  }

  return (
    <div className="ph-hold ph-surface" role="status" aria-live="polite" style={style}>
      <p className="ph-hold-text">{copy.hold.verifying}</p>
      {reducedMotion.current ? (
        <p className="ph-hold-countdown">
          {copy.hold.remaining.replace('{n}', String(remainingSec))}
        </p>
      ) : (
        <div className="ph-hold-track">
          <div className="ph-hold-bar" style={{ animationDuration: `${DURATION_MS}ms` }} />
        </div>
      )}
      <Button variant="secondary" onClick={onCancel}>
        {copy.hold.cancel}
      </Button>
    </div>
  );
});
