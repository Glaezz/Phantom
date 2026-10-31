import { useEffect, useRef, useState } from 'react';
import type { Verdict } from '../types';
import { copy } from '../copy.id';
import { StatusIcon } from './StatusIcon';
import { Button } from './Button';
import './VerdictBanner.css';

// Kontrak Design.md §6.3. Hanya untuk caution/danger (DS-07).
// Gate: Batal Kirim fokus awal & paling menonjol (DS-03); Tetap Kirim 2 ketukan di danger (DS-04).
// Scrim hanya danger + gate + overlay.
export function VerdictBanner({
  verdict,
  mode,
  surface,
  onCancelSubmit,
  onContinueSubmit,
  onWhy,
  onDismiss,
}: {
  verdict: Verdict;
  mode: 'info' | 'gate';
  surface: 'overlay' | 'web';
  onCancelSubmit?: () => void;
  onContinueSubmit?: () => void;
  onWhy: () => void;
  onDismiss?: () => void;
}) {
  const { status } = verdict;
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isGate = mode === 'gate';
  const withScrim = status === 'danger' && isGate && surface === 'overlay';

  // Fokus awal ke Batal Kirim pada gate (DS-03)
  useEffect(() => {
    if (isGate) cancelRef.current?.focus();
  }, [isGate]);

  // Esc = Batal Kirim pada gate; focus trap sederhana
  useEffect(() => {
    if (!isGate) return;
    const el = rootRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancelSubmit?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = el.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [isGate, onCancelSubmit]);

  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  const handleContinue = () => {
    if (status === 'danger' && !confirming) {
      setConfirming(true);
      confirmTimer.current = setTimeout(() => setConfirming(false), 5000);
      return;
    }
    clearTimeout(confirmTimer.current);
    onContinueSubmit?.();
  };

  const ariaProps = isGate
    ? {
        role: 'alertdialog' as const,
        'aria-modal': true as const,
        'aria-labelledby': 'ph-banner-title',
        'aria-describedby': 'ph-banner-reasons',
      }
    : status === 'danger'
      ? { role: 'alert' as const, 'aria-live': 'assertive' as const }
      : { role: 'status' as const, 'aria-live': 'polite' as const };

  const banner = (
    <div
      ref={rootRef}
      className="ph-banner ph-surface"
      data-status={status}
      data-mode={mode}
      data-surface={surface}
      {...ariaProps}
    >
      <div className="ph-banner-accent" aria-hidden="true" />
      <div className="ph-banner-body">
        <div className="ph-banner-head">
          <StatusIcon status={status} size={28} />
          <h2 id="ph-banner-title" className="ph-banner-title">
            {copy.status[status].title}
            {isGate ? ` — ${copy.gate.held}` : ''}
          </h2>
          {mode === 'info' && onDismiss && (
            <button
              className="ph-banner-close"
              aria-label={copy.gate.closeAlert}
              onClick={onDismiss}
            >
              ✕
            </button>
          )}
        </div>
        <p id="ph-banner-reasons" className="ph-banner-reasons">
          {verdict.reasons.slice(0, 2).join(' ')}
        </p>
        {isGate && <p className="ph-banner-privacy">{copy.privacy.noRead}</p>}
        <div className="ph-banner-actions">
          {isGate ? (
            <>
              <Button
                ref={cancelRef}
                variant="status"
                status={status}
                tall
                minWidth160
                onClick={onCancelSubmit}
              >
                {copy.gate.cancel}
              </Button>
              <Button variant="secondary" onClick={handleContinue}>
                {confirming ? copy.gate.confirmContinue : copy.gate.continue}
              </Button>
              <Button variant="tertiary" onClick={onWhy}>
                {copy.gate.why}
              </Button>
            </>
          ) : (
            <>
              <Button variant="tertiary" onClick={onWhy}>
                {copy.gate.why}
              </Button>
              {onDismiss && (
                <Button variant="secondary" onClick={onDismiss}>
                  {copy.gate.understood}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (withScrim) {
    return (
      <div className="ph-banner-scrim">
        {banner}
      </div>
    );
  }
  return banner;
}
