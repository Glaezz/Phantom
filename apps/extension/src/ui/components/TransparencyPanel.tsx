import { useEffect, useRef } from 'react';
import type { Verdict, TraceStep } from '../types';
import { copy } from '../copy.id';
import { StatusBadge } from './StatusBadge';

// Kontrak Design.md §6.6. Urutan isi tetap: badge → ringkasan → langkah L0-L4 → kartu floor → sumber → kalimat DS-09.
export function TransparencyPanel({
  verdict,
  surface,
  onClose,
}: {
  verdict: Verdict;
  surface: 'overlay' | 'popup' | 'web';
  onClose: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<Element | null>(null);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const el = panelRef.current;
    el?.addEventListener('keydown', onKey);
    return () => {
      el?.removeEventListener('keydown', onKey);
      (prevFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="ph-panel ph-surface"
      data-surface={surface}
      role="dialog"
      aria-labelledby="ph-panel-title"
    >
      <div className="ph-panel-header">
        <h2 id="ph-panel-title" className="ph-panel-title" tabIndex={-1} ref={titleRef}>
          {copy.panel.title}
        </h2>
        <button className="ph-panel-close" onClick={onClose} aria-label={copy.panel.close}>
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="ph-panel-status"><StatusBadge status={verdict.status} size="sm" /></div>

      <section className="ph-panel-section">
        <h3 className="ph-panel-subtitle">{copy.panel.summary}</h3>
        <ul className="ph-panel-reasons">
          {verdict.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </section>

      <section className="ph-panel-section">
        <h3 className="ph-panel-subtitle">{copy.panel.steps}</h3>
        <ol className="ph-panel-steps">
          {verdict.trace.map((step, i) => (
            <TraceRow key={i} step={step} />
          ))}
        </ol>
      </section>

      {verdict.floor && (
        <section className="ph-panel-section ph-panel-floor">
          <h3 className="ph-panel-subtitle">
            {copy.floor.title.replace('{status}', copy.status[verdict.floor].short)}
          </h3>
          <p>{copy.floor.explain}</p>
        </section>
      )}

      <section className="ph-panel-section">
        <p className="ph-panel-source">{copy.panel.source[verdict.source]}</p>
      </section>

      <p className="ph-panel-disclaimer">{copy.panel.disclaimer}</p>
    </div>
  );
}

function TraceRow({ step }: { step: TraceStep }) {
  const label = (copy.trace as Record<string, string>)[step.summaryKey] ?? step.summaryKey;
  return (
    <li className="ph-trace-row" data-finding={step.finding}>
      <span className="ph-trace-marker" aria-hidden="true" />
      <div className="ph-trace-body">
        <div className="ph-trace-head">
          <span className="ph-trace-label">{copy.trace[step.stage]}</span>
          <span className="ph-trace-stage">{step.stage}</span>
        </div>
        {label !== copy.trace[step.stage] && <p className="ph-trace-summary">{label}</p>}
        {step.finding === 'skipped' && step.skipReasonKey && (
          <p className="ph-trace-skip">
            {(copy.trace as Record<string, string>)[step.skipReasonKey] ?? step.skipReasonKey}
          </p>
        )}
        {step.technical && (
          <details className="ph-trace-details">
            <summary>{copy.panel.technical}</summary>
            <dl>
              {step.technical.signal && (
                <>
                  <dt>Signal</dt>
                  <dd>{step.technical.signal}</dd>
                </>
              )}
              {step.technical.tool && (
                <>
                  <dt>Tool</dt>
                  <dd>{step.technical.tool}</dd>
                </>
              )}
              {step.technical.value && (
                <>
                  <dt>Value</dt>
                  <dd>{step.technical.value}</dd>
                </>
              )}
            </dl>
          </details>
        )}
      </div>
    </li>
  );
}
