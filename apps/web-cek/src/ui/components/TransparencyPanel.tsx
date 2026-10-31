import { useEffect, useRef, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import type { Stage, Surface, TraceStep, Verdict } from '../../lib/types';
import { copy } from '../copy.id';
import { StatusBadge } from './StatusBadge';
import './TransparencyPanel.css';

export interface TransparencyPanelProps {
  verdict: Verdict;
  surface: Surface;
  onClose: () => void;
}

const STAGES: Stage[] = ['L0', 'L1', 'L2', 'L3', 'L4'];

export function TransparencyPanel({
  verdict,
  surface = 'web',
  onClose,
}: TransparencyPanelProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fokus pindah ke judul saat dibuka (Design.md 6.6)
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Keyboard: Esc menutup, kembali ke pemicu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Siapkan daftar langkah L0-L4 lengkap
  const steps: TraceStep[] = STAGES.map((stage) => {
    const existing = verdict.trace.find((t) => t.stage === stage);
    if (existing) return existing;
    return {
      stage,
      finding: 'skipped',
      summaryKey: copy.trace[stage],
      skipReasonKey: copy.trace.skippedNoConsent,
    };
  });

  const panelStyle = {
    '--panel-status-border': `var(--${verdict.status}-border)`,
    '--panel-status-bg': `var(--${verdict.status}-bg)`,
  } as CSSProperties;

  return (
    <div
      className="ph-transparency-overlay"
      data-surface={surface}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="ph-transparency"
        data-surface={surface}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ph-transparency-title"
        style={panelStyle}
      >
        {/* 1. Judul + StatusBadge + Tombol Tutup */}
        <header className="ph-transparency__header">
          <div className="ph-transparency__header-title-row">
            <h2
              id="ph-transparency-title"
              ref={titleRef}
              tabIndex={-1}
              className="ph-transparency__title"
            >
              {copy.panel.title}
            </h2>
            <button
              type="button"
              className="ph-transparency__close-btn"
              onClick={onClose}
              aria-label={copy.panel.close}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="ph-transparency__badge-wrap">
            <StatusBadge status={verdict.status} size="md" />
          </div>
        </header>

        <div className="ph-transparency__content">
          {/* 2. Ringkasan (= reasons) */}
          <section
            className="ph-transparency__section"
            aria-labelledby="ph-transparency-summary-title"
          >
            <h3
              id="ph-transparency-summary-title"
              className="ph-transparency__section-title"
            >
              {copy.panel.summary}
            </h3>
            <ul className="ph-transparency__reasons">
              {verdict.reasons.map((reason, idx) => (
                <li key={idx} className="ph-transparency__reason-item">
                  {reason}
                </li>
              ))}
            </ul>
          </section>

          {/* 3. Daftar langkah L0 -> L4 */}
          <section
            className="ph-transparency__section"
            aria-labelledby="ph-transparency-steps-title"
          >
            <h3
              id="ph-transparency-steps-title"
              className="ph-transparency__section-title"
            >
              {copy.panel.steps}
            </h3>
            <ol className="ph-transparency__step-list">
              {steps.map((step) => {
                const isSkipped = step.finding === 'skipped';
                const isInjection =
                  step.stage === 'L4' &&
                  (step.summaryKey === copy.trace.injectionIgnored ||
                    step.technical?.signal === 'PROMPT_INJECTION');

                const summaryText = isInjection
                  ? copy.trace.injectionIgnored
                  : isSkipped
                    ? step.skipReasonKey &&
                      copy.trace[step.skipReasonKey as keyof typeof copy.trace]
                      ? copy.trace[
                          step.skipReasonKey as keyof typeof copy.trace
                        ]
                      : copy.trace.skippedNoConsent
                    : step.summaryKey;

                return (
                  <li
                    key={step.stage}
                    className="ph-transparency__step-item"
                    data-finding={step.finding}
                  >
                    <div className="ph-transparency__step-header">
                      {/* Penanda titik persegi --r-dot */}
                      <span
                        className="ph-transparency__step-dot"
                        data-finding={step.finding}
                        aria-hidden="true"
                      />
                      <span className="ph-transparency__step-stage">
                        {step.stage}
                      </span>
                      <span className="ph-transparency__step-name">
                        {copy.trace[step.stage]}
                      </span>
                    </div>

                    <p className="ph-transparency__step-summary">
                      {summaryText}
                    </p>

                    {/* Rincian teknis dalam details tertutup */}
                    {step.technical && !isSkipped && (
                      <details className="ph-transparency__details">
                        <summary className="ph-transparency__summary-toggle">
                          {copy.panel.technical}
                        </summary>
                        <div className="ph-transparency__tech-box">
                          {step.technical.signal && (
                            <div className="ph-transparency__tech-row">
                              <span className="ph-transparency__tech-label">Sinyal:</span>
                              <code className="ph-transparency__tech-value">
                                {step.technical.signal}
                              </code>
                            </div>
                          )}
                          {step.technical.tool && (
                            <div className="ph-transparency__tech-row">
                              <span className="ph-transparency__tech-label">Alat:</span>
                              <code className="ph-transparency__tech-value">
                                {step.technical.tool}
                              </code>
                            </div>
                          )}
                          {step.technical.value && (
                            <div className="ph-transparency__tech-row">
                              <span className="ph-transparency__tech-label">Nilai:</span>
                              <code className="ph-transparency__tech-value">
                                {step.technical.value}
                              </code>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          {/* 4. Kartu Batas bawah vonis bila floor ada */}
          {verdict.floor && verdict.floor !== 'neutral' && (
            <section
              className="ph-transparency__floor-card"
              data-floor={verdict.floor}
              aria-labelledby="ph-transparency-floor-title"
            >
              <h4
                id="ph-transparency-floor-title"
                className="ph-transparency__floor-title"
              >
                {copy.floor.title.replace(
                  '{status}',
                  copy.status[verdict.floor].short,
                )}
              </h4>
              <p className="ph-transparency__floor-explain">
                {copy.floor.explain}
              </p>
            </section>
          )}

          {/* 5. Sumber (source) */}
          <section className="ph-transparency__source-section">
            <span className="ph-transparency__source-label">
              Sumber pemeriksaan:
            </span>
            <span className="ph-transparency__source-val">
              {copy.panel.source[verdict.source]}
            </span>
          </section>

          {/* 6. Kalimat DS-09 */}
          <footer className="ph-transparency__footer">
            <p className="ph-transparency__disclaimer">
              {copy.panel.disclaimer}
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
