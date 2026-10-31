import { useState } from 'react';
import { Copy as CopyIcon } from 'lucide-react';
import { copy } from '../copy.id';
import { Button } from './Button';
import './InstallStepper.css';

export interface InstallStepperProps {
  initialBrowser?: 'chrome' | 'edge';
  onStepChange?: (step: number) => void;
}

// Diagram ilustrasi garis tunggal per langkah (Design.md 6.12, DS-64)
function StepDiagram({ stepIndex, browser }: { stepIndex: number; browser: 'chrome' | 'edge' }) {
  const altText = copy.download.stepAlts[stepIndex] || `Langkah ${stepIndex + 1}`;
  const addressUrl = browser === 'chrome' ? copy.download.chromeAddress : copy.download.edgeAddress;

  switch (stepIndex) {
    case 0:
      // Langkah 1: Unduh berkas zip
      return (
        <svg
          role="img"
          aria-label={altText}
          className="ph-stepper__diagram"
          viewBox="0 0 280 120"
          fill="none"
          stroke="currentColor"
        >
          {/* Berkas zip */}
          <rect x="50" y="20" width="70" height="80" rx="4" strokeWidth="2" stroke="var(--ink-800)" />
          <path d="M70 20v80M65 30h10M65 45h10M65 60h10M65 75h10" strokeWidth="2" stroke="var(--ink-400)" />
          <text x="60" y="95" fill="var(--ink-800)" fontSize="10" fontFamily="var(--font-mono)">.ZIP</text>
          {/* Tombol unduh dengan kotak sorotan */}
          <rect x="150" y="40" width="100" height="40" rx="6" strokeWidth="2" stroke="var(--focus)" strokeDasharray="3 3" />
          <rect x="154" y="44" width="92" height="32" rx="4" fill="var(--ink-900)" />
          <path d="M200 52v12M195 60l5 5 5-5" stroke="var(--surface)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 1:
      // Langkah 2: Ekstrak zip
      return (
        <svg
          role="img"
          aria-label={altText}
          className="ph-stepper__diagram"
          viewBox="0 0 280 120"
          fill="none"
          stroke="currentColor"
        >
          <rect x="40" y="30" width="60" height="60" rx="4" strokeWidth="2" stroke="var(--ink-400)" />
          <path d="M120 60h40M150 50l10 10-10 10" strokeWidth="2" stroke="var(--ink-800)" strokeLinecap="round" strokeLinejoin="round" />
          {/* Folder hasil ekstrak dengan sorotan */}
          <rect x="175" y="25" width="80" height="70" rx="6" strokeWidth="2" stroke="var(--focus)" strokeDasharray="3 3" />
          <path d="M185 45h25l5 5h35v35h-65Z" strokeWidth="2" stroke="var(--ink-800)" fill="var(--ink-100)" />
        </svg>
      );
    case 2:
      // Langkah 3: Buka chrome://extensions atau edge://extensions
      return (
        <svg
          role="img"
          aria-label={altText}
          className="ph-stepper__diagram"
          viewBox="0 0 280 120"
          fill="none"
          stroke="currentColor"
        >
          {/* Peramban bilah alamat */}
          <rect x="20" y="20" width="240" height="80" rx="6" strokeWidth="2" stroke="var(--ink-400)" />
          <circle cx="35" cy="35" r="3" fill="var(--ink-400)" />
          <circle cx="45" cy="35" r="3" fill="var(--ink-400)" />
          <circle cx="55" cy="35" r="3" fill="var(--ink-400)" />
          {/* Kotak alamat peramban bergaris sorotan */}
          <rect x="70" y="27" width="180" height="18" rx="4" strokeWidth="2" stroke="var(--focus)" strokeDasharray="3 3" />
          <text x="76" y="40" fill="var(--ink-800)" fontSize="10" fontFamily="var(--font-mono)">
            {addressUrl}
          </text>
        </svg>
      );
    case 3:
      // Langkah 4: Aktifkan Mode pengembang
      return (
        <svg
          role="img"
          aria-label={altText}
          className="ph-stepper__diagram"
          viewBox="0 0 280 120"
          fill="none"
          stroke="currentColor"
        >
          <rect x="20" y="25" width="240" height="70" rx="6" strokeWidth="2" stroke="var(--ink-300)" />
          <text x="35" y="62" fill="var(--ink-800)" fontSize="12" fontWeight="600" fontFamily="var(--font-ui)">
            Mode pengembang
          </text>
          {/* Sakelar toggle aktif bergaris sorotan */}
          <rect x="180" y="40" width="60" height="40" rx="6" strokeWidth="2" stroke="var(--focus)" strokeDasharray="3 3" />
          <rect x="190" y="48" width="40" height="22" rx="11" fill="var(--official-strong)" />
          <circle cx="219" cy="59" r="8" fill="var(--surface)" />
        </svg>
      );
    case 4:
      // Langkah 5: Klik Muat yang belum dipak
      return (
        <svg
          role="img"
          aria-label={altText}
          className="ph-stepper__diagram"
          viewBox="0 0 280 120"
          fill="none"
          stroke="currentColor"
        >
          {/* Tombol Muat yang belum dipak dengan sorotan */}
          <rect x="20" y="35" width="180" height="50" rx="6" strokeWidth="2" stroke="var(--focus)" strokeDasharray="3 3" />
          <rect x="26" y="41" width="168" height="38" rx="4" strokeWidth="1" stroke="var(--ink-600)" fill="var(--surface)" />
          <text x="40" y="65" fill="var(--ink-900)" fontSize="11" fontWeight="600" fontFamily="var(--font-ui)">
            Muat yang belum dipak
          </text>
          {/* Kursor klik */}
          <path d="M190 70l15 15-5 2 4 8-4 2-4-8-5 5Z" fill="var(--ink-900)" stroke="var(--surface)" strokeWidth="1" />
        </svg>
      );
    case 5:
    default:
      // Langkah 6: Sematkan ikon Phantom di toolbar
      return (
        <svg
          role="img"
          aria-label={altText}
          className="ph-stepper__diagram"
          viewBox="0 0 280 120"
          fill="none"
          stroke="currentColor"
        >
          {/* Toolbar bilah atas */}
          <rect x="20" y="25" width="240" height="45" rx="4" strokeWidth="2" stroke="var(--ink-300)" />
          {/* Ikon puzzle dan pin dengan sorotan */}
          <rect x="175" y="30" width="70" height="35" rx="4" strokeWidth="2" stroke="var(--focus)" strokeDasharray="3 3" />
          {/* Ikon puzzle ekstensi */}
          <path d="M190 42h4a3 3 0 0 0 6 0h4v4a3 3 0 0 0 0 6v4h-4a3 3 0 0 0-6 0h-4Z" strokeWidth="1.5" stroke="var(--ink-800)" />
          {/* Ikon pin sematkan */}
          <path d="M225 38v8l-3 4h10l-3-4v-8M227 50v8" strokeWidth="1.5" stroke="var(--official-strong)" />
        </svg>
      );
  }
}

export function InstallStepper({
  initialBrowser = 'chrome',
  onStepChange,
}: InstallStepperProps) {
  const [browser, setBrowser] = useState<'chrome' | 'edge'>(initialBrowser);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const addressToCopy =
    browser === 'chrome'
      ? copy.download.chromeAddress
      : copy.download.edgeAddress;

  const handleCopyAddress = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(addressToCopy);
      }
    } catch {
      // Abaikan bila tidak didukung
    }
    setCopiedAddress(true);
    setTimeout(() => {
      setCopiedAddress(false);
    }, 2000);
  };

  const handleSelectBrowser = (b: 'chrome' | 'edge') => {
    setBrowser(b);
  };

  return (
    <div className="ph-stepper">
      {/* Pengalih Peramban: Chrome atau Edge */}
      <div className="ph-stepper__browser-toggle" role="tablist" aria-label="Pilih peramban">
        <button
          type="button"
          role="tab"
          aria-selected={browser === 'chrome'}
          className={`ph-stepper__browser-tab ${browser === 'chrome' ? 'ph-stepper__browser-tab--active' : ''}`}
          onClick={() => handleSelectBrowser('chrome')}
        >
          {copy.download.browserChrome}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={browser === 'edge'}
          className={`ph-stepper__browser-tab ${browser === 'edge' ? 'ph-stepper__browser-tab--active' : ''}`}
          onClick={() => handleSelectBrowser('edge')}
        >
          {copy.download.browserEdge}
        </button>
      </div>

      {/* Enam Langkah Pemasangan */}
      <ol className="ph-stepper__list">
        {copy.download.steps.map((stepText, idx) => {
          const isAddressStep = idx === 2;

          return (
            <li
              key={idx}
              className="ph-stepper__item"
              onClick={() => onStepChange?.(idx + 1)}
            >
              <div className="ph-stepper__item-body">
                {/* Nomor di atas titik persegi (Design.md 6.12) */}
                <div className="ph-stepper__marker-wrap">
                  <span className="ph-stepper__num">{idx + 1}</span>
                  <span className="ph-stepper__dot" aria-hidden="true" />
                </div>

                <div className="ph-stepper__info">
                  {/* Satu kalimat instruksi */}
                  <p className="ph-stepper__instruction">{stepText}</p>

                  {/* Tombol Salin alamat untuk langkah 3 */}
                  {isAddressStep && (
                    <div className="ph-stepper__address-box">
                      <code className="ph-stepper__address-text">
                        {addressToCopy}
                      </code>
                      <Button
                        variant="secondary"
                        onClick={handleCopyAddress}
                        className="ph-stepper__btn-copy"
                      >
                        <CopyIcon size={16} aria-hidden="true" />
                        <span>
                          {copiedAddress
                            ? copy.download.stepAddressCopied
                            : copy.download.stepAddress}
                        </span>
                      </Button>
                      <span className="ph-sr-only" aria-live="polite">
                        {copiedAddress ? copy.download.stepAddressCopied : ''}
                      </span>
                    </div>
                  )}

                  {/* Tangkapan layar / skema ber-alt dengan sorotan elemen klik */}
                  <div className="ph-stepper__diagram-wrap">
                    <StepDiagram stepIndex={idx} browser={browser} />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
