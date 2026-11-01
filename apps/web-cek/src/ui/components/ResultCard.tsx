import { useState, type CSSProperties } from 'react';
import type { Verdict } from '../../lib/types';
import { copy } from '../copy.id';
import { StatusIcon } from '../icons/StatusIcon';
import { Button } from './Button';
import './ResultCard.css';

export interface ResultCardProps {
  verdict: Verdict;
  onCopy: () => void;
  onWhy: () => void;
  notices?: Verdict['notices'];
}

export function ResultCard({ verdict, onCopy, onWhy, notices }: ResultCardProps) {
  const [copied, setCopied] = useState(false);
  const status = verdict.status;

  const activeNotices = notices ?? verdict.notices ?? [];
  const showCache = verdict.cacheHit === true;
  const showDeep = !showCache && verdict.agentUsed === true;
  const showRulesOnly =
    !showCache && !showDeep && (activeNotices.includes('rulesOnly') || verdict.source === 'rules');
  const showSpaLimit = activeNotices.includes('spaLimit');
  const showBudgetLimited = activeNotices.includes('budgetLimited');
  const showContentUnchecked = activeNotices.includes('contentUnchecked');
  const showDeepUnavailable = activeNotices.includes('deepUnavailable');
  const showOtherLinksUnchecked = activeNotices.includes('otherLinksUnchecked');

  const brandName = verdict.claimedBrand?.name || copy.web.officialChannelDefault;
  const officialChannelFirst =
    verdict.claimedBrand?.officialDomains[0] ||
    verdict.claimedBrand?.officialPhones[0] ||
    copy.web.officialChannelDefault;

  // Kalimat aksi (Design.md 6.7)
  const actionSentence =
    status === 'official'
      ? copy.action.official.replace('{brand}', brandName)
      : copy.action[status];

  // Langkah selanjutnya (Design.md 595-602)
  const nextSteps =
    status === 'danger'
      ? copy.web.nextStepsDanger.map((step) =>
          step.replace('{channel}', officialChannelFirst),
        )
      : status === 'caution'
        ? copy.web.nextStepsCaution.map((step) =>
            step.replace('{channel}', officialChannelFirst),
          )
        : status === 'neutral'
          ? copy.web.nextStepsNeutral
          : [];

  const handleCopy = async () => {
    const lines: string[] = [
      `Phantom: ${copy.status[status].title}`,
      actionSentence,
      '',
      `${copy.panel.summary}:`,
      ...verdict.reasons.map((r) => `- ${r}`),
    ];

    if (verdict.claimedBrand) {
      lines.push('');
      lines.push(copy.web.officialChannels.replace('{brand}', verdict.claimedBrand.name) + ':');
      if (verdict.claimedBrand.officialDomains.length > 0) {
        lines.push(`- ${copy.web.officialDomainsLabel}: ${verdict.claimedBrand.officialDomains.join(', ')}`);
      }
      if (verdict.claimedBrand.officialPhones.length > 0) {
        lines.push(`- ${copy.web.officialPhonesLabel}: ${verdict.claimedBrand.officialPhones.join(', ')}`);
      }
    }

    lines.push('');
    lines.push(`(${copy.panel.disclaimer})`);

    const textToCopy = lines.join('\n');

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      }
    } catch {
      // Abaikan bila peramban membatasi akses clipboard
    }

    setCopied(true);
    onCopy();
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const cardStyle = {
    '--card-status-fg': `var(--${status}-fg)`,
    '--card-status-bg': `var(--${status}-bg)`,
    '--card-status-border': `var(--${status}-border)`,
    '--card-status-strong': `var(--${status}-strong)`,
  } as CSSProperties;

  return (
    <article
      className="ph-result-card"
      data-status={status}
      style={cardStyle}
      aria-labelledby="ph-result-status-title"
    >
      {/* 1. Ikon 56 px + judul status */}
      <header className="ph-result-card__header">
        <div className="ph-result-card__icon-wrap">
          <StatusIcon status={status} size={56} className="ph-result-card__icon" />
        </div>
        <div className="ph-result-card__title-wrap">
          <h2 id="ph-result-status-title" className="ph-result-card__title">
            {copy.status[status].title}
          </h2>
          {showRulesOnly && (
            <span className="ph-result-card__notice-pill">
              {copy.mode.rulesOnly}
            </span>
          )}
          {showDeep && (
            <span className="ph-result-card__notice-pill">
              {copy.mode.deep}
            </span>
          )}
          {showCache && (
            <span className="ph-result-card__notice-pill">
              {copy.mode.cache}
            </span>
          )}
        </div>
      </header>

      {/* 2. Kalimat aksi */}
      <p className="ph-result-card__action">{actionSentence}</p>

      {/* 3. Alasan (1-3 kalimat) */}
      {verdict.reasons.length > 0 && (
        <ul className="ph-result-card__reasons">
          {verdict.reasons.map((reason, index) => (
            <li key={index} className="ph-result-card__reason-item">
              {reason}
            </li>
          ))}
        </ul>
      )}

      {/* 4. Kanal resmi (teks mono, bukan tautan aktif) */}
      {verdict.claimedBrand && (
        <section
          className="ph-result-card__official-channels"
          aria-labelledby="ph-result-channels-title"
        >
          <h3 id="ph-result-channels-title" className="ph-result-card__section-title">
            {copy.web.officialChannels.replace('{brand}', verdict.claimedBrand.name)}
          </h3>

          {verdict.claimedBrand.officialDomains.length > 0 && (
            <div className="ph-result-card__channel-group">
              <span className="ph-result-card__channel-label">
                {copy.web.officialDomainsLabel}
              </span>
              <div className="ph-result-card__mono-list">
                {verdict.claimedBrand.officialDomains.map((domain, i) => (
                  <code key={i} className="ph-result-card__mono">
                    {domain}
                  </code>
                ))}
              </div>
            </div>
          )}

          {verdict.claimedBrand.officialPhones.length > 0 && (
            <div className="ph-result-card__channel-group">
              <span className="ph-result-card__channel-label">
                {copy.web.officialPhonesLabel}
              </span>
              <div className="ph-result-card__mono-list">
                {verdict.claimedBrand.officialPhones.map((phone, i) => (
                  <code key={i} className="ph-result-card__mono">
                    {phone}
                  </code>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 5. Langkah selanjutnya (2-3 butir bernomor) */}
      {nextSteps.length > 0 && (
        <section
          className="ph-result-card__next-steps"
          aria-labelledby="ph-result-next-steps-title"
        >
          <h3 id="ph-result-next-steps-title" className="ph-result-card__section-title">
            {copy.web.nextSteps}
          </h3>
          <ol className="ph-result-card__step-list">
            {nextSteps.map((step, idx) => (
              <li key={idx} className="ph-result-card__step-item">
                {step}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 6. Baris aksi */}
      <footer className="ph-result-card__actions">
        <Button variant="secondary" onClick={handleCopy} className="ph-result-card__btn-copy">
          {copied ? copy.web.copied : copy.web.copyResult}
        </Button>
        <Button variant="tertiary" onClick={onWhy} className="ph-result-card__btn-why">
          {copy.gate.why}
        </Button>
        <span className="ph-sr-only" aria-live="polite">
          {copied ? copy.web.copied : ''}
        </span>
      </footer>

      {/* 7. Penutup DS-09 */}
      <p className="ph-result-card__disclaimer">{copy.panel.disclaimer}</p>

      {/* 8. Notices bawah bila ada */}
      {showDeepUnavailable && (
        <p className="ph-result-card__sub-notice">{copy.web.deepUnavailable}</p>
      )}
      {showOtherLinksUnchecked && (
        <p className="ph-result-card__sub-notice">{copy.web.otherLinksUnchecked}</p>
      )}
      {showContentUnchecked && (
        <p className="ph-result-card__sub-notice">{copy.web.contentUnchecked}</p>
      )}
      {showSpaLimit && (
        <p className="ph-result-card__sub-notice">{copy.web.spaLimit}</p>
      )}
      {showBudgetLimited && (
        <p className="ph-result-card__sub-notice">{copy.web.budgetLimited}</p>
      )}
    </article>
  );
}
