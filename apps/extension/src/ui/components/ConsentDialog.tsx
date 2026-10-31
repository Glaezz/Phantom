import { useEffect, useRef } from 'react';
import { copy } from '../copy.id';
import { Button } from './Button';
import './ConsentDialog.css';

// Kontrak Design.md §6.10: dua tombol setara, menolak tanpa galat (DS-11).
export function ConsentDialog({
  onAllow,
  onDeny,
}: {
  onAllow: () => void;
  onDeny: () => void;
}) {
  const allowRef = useRef<HTMLButtonElement>(null);
  const prevFocus = useRef<Element | null>(null);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    allowRef.current?.focus();
    return () => {
      (prevFocus.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDeny();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDeny]);

  return (
    <div className="ph-consent-backdrop">
      <div
        className="ph-consent ph-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ph-consent-title"
      >
        <h2 id="ph-consent-title" className="ph-consent-title">
          {copy.consent.title}
        </h2>
        <p className="ph-consent-body">{copy.consent.body}</p>
        <p className="ph-consent-detail">{copy.consent.sent}</p>
        <p className="ph-consent-detail">{copy.consent.neverSent}</p>
        <div className="ph-consent-actions">
          <Button ref={allowRef} variant="primary" onClick={onAllow}>
            {copy.consent.allow}
          </Button>
          <Button variant="secondary" onClick={onDeny}>
            {copy.consent.deny}
          </Button>
        </div>
      </div>
    </div>
  );
}
