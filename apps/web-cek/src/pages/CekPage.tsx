import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { analyze, NoUrlFoundError } from '../lib/analyzer';
import type { Verdict } from '../lib/types';
import { copy } from '../ui/copy.id';
import { Header } from '../ui/components/Header';
import { Footer } from '../ui/components/Footer';
import { PasteBox } from '../ui/components/PasteBox';
import { ResultCard } from '../ui/components/ResultCard';
import { MessageParserList } from '../ui/components/MessageParserList';
import { TransparencyPanel } from '../ui/components/TransparencyPanel';
import './Page.css';
import './CekPage.css';

type InputError = 'empty' | 'invalid' | 'blocked' | 'offline' | 'noUrl' | 'failed';

const ERROR_COPY: Record<InputError, { title: string; body: string }> = {
  empty: { title: copy.cek.errorTitle, body: copy.web.empty },
  invalid: { title: copy.cek.errorTitle, body: copy.web.invalidUrl },
  blocked: { title: copy.cek.blockedTitle, body: copy.web.blockedTarget },
  offline: { title: copy.cek.offlineTitle, body: copy.web.offline },
  noUrl: { title: copy.cek.errorTitle, body: copy.web.noUrlFound },
  failed: { title: copy.cek.errorTitle, body: copy.error.connectionFailed },
};

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const PRIVATE_HOST =
  /^(localhost|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/i;

/**
 * Validasi masukan sebelum memanggil analyze().
 * Bukan logika deteksi: hanya memilah isian yang jelas tidak bisa diperiksa
 * (WEB-04: hanya http/https, tanpa host internal atau IP literal).
 */
function inspectInput(value: string): InputError | null {
  if (!value) return 'empty';

  // Pesan panjang boleh berisi kalimat bebas; tautan di dalamnya diurai analyzer.
  if (/\s/.test(value)) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
    ? value
    : `https://${value}`;

  let target: URL;
  try {
    target = new URL(withScheme);
  } catch {
    return 'invalid';
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return 'blocked';
  }

  const host = target.hostname.toLowerCase();
  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.')) {
    return 'invalid';
  }
  if (
    host.startsWith('[') ||
    IPV4.test(host) ||
    PRIVATE_HOST.test(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return 'blocked';
  }

  return null;
}

export function CekPage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<InputError | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const resultRef = useRef<HTMLElement>(null);
  const resultTitleRef = useRef<HTMLHeadingElement>(null);
  const whyTriggerRef = useRef<HTMLElement | null>(null);
  const requestIdRef = useRef(0);

  // Setelah hasil muncul: fokus dan gulir pindah ke judul hasil.
  // Offset memakai tinggi header lengket yang sebenarnya agar judul tidak
  // tertutup di layar sempit (375 px) maupun saat zoom 200%.
  useEffect(() => {
    if (!verdict) return;
    const title = resultTitleRef.current;
    const section = resultRef.current;
    if (!title || !section) return;

    title.focus({ preventScroll: true });

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rootStyles = getComputedStyle(document.documentElement);
    const gapToken =
      parseFloat(rootStyles.getPropertyValue('--s-4')) || 0;
    const headerHeight =
      document.querySelector('.ph-header')?.getBoundingClientRect().height ?? 0;
    const top =
      window.scrollY +
      section.getBoundingClientRect().top -
      headerHeight -
      gapToken;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [verdict]);

  const handleChange = (value: string) => {
    setInput(value);
    if (error) setError(null);
  };

  const handleSubmit = async (raw: string) => {
    const trimmed = raw.trim();
    setError(null);

    const invalid = inspectInput(trimmed);
    if (invalid) {
      setVerdict(null);
      setError(invalid);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setVerdict(null);
      setError('offline');
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setVerdict(null);
    setLoading(true);
    setSlow(false);

    const slowTimer = window.setTimeout(() => setSlow(true), 3000);

    try {
      const result = await analyze(trimmed);
      if (requestIdRef.current !== requestId) return;
      setVerdict(result);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError(err instanceof NoUrlFoundError ? 'noUrl' : 'failed');
    } finally {
      window.clearTimeout(slowTimer);
      if (requestIdRef.current === requestId) {
        setLoading(false);
        setSlow(false);
      }
    }
  };

  const openWhy = () => {
    whyTriggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setPanelOpen(true);
  };

  const closeWhy = () => {
    setPanelOpen(false);
    const trigger = whyTriggerRef.current;
    // Kembalikan fokus ke pemicu "Kenapa?" (Design.md 6.6).
    if (trigger) window.requestAnimationFrame(() => trigger.focus());
  };

  const errorCopy = error ? ERROR_COPY[error] : null;
  const parsedItems = verdict?.parsedItems ?? [];
  const showParser = parsedItems.length > 1;

  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="ph-page">
        <div className="ph-container ph-container--wide">
          <div className="ph-page__column">
            <header className="ph-page__head">
              <h1 className="ph-page__title">
                {copy.cek.title}
                <span className="ph-dot ph-page__dot" aria-hidden="true" />
              </h1>
              <p className="ph-page__intro">{copy.cek.intro}</p>
            </header>

            <div className="ph-page__stack">
              <PasteBox
                value={input}
                onChange={handleChange}
                onSubmit={handleSubmit}
                loading={loading}
              />

              {loading && (
                <section
                  className="ph-check-status"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                  aria-labelledby="ph-check-status-title"
                >
                  <h2
                    id="ph-check-status-title"
                    className="ph-check-status__title"
                  >
                    {copy.web.checking}
                  </h2>
                  <ol
                    className="ph-check-status__steps"
                    aria-label={copy.cek.stepLabel}
                  >
                    {copy.web.stepsActive.map((step) => (
                      <li key={step} className="ph-check-status__step">
                        <span
                          className="ph-check-status__dot"
                          aria-hidden="true"
                        />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  {slow && (
                    <p className="ph-check-status__slow">{copy.web.slow}</p>
                  )}
                </section>
              )}

              {errorCopy && (
                <section
                  className="ph-check-notice"
                  role="alert"
                  aria-labelledby="ph-check-notice-title"
                >
                  <div className="ph-check-notice__head">
                    <AlertCircle
                      size={20}
                      aria-hidden="true"
                      className="ph-check-notice__icon"
                    />
                    <h2
                      id="ph-check-notice-title"
                      className="ph-check-notice__title"
                    >
                      {errorCopy.title}
                    </h2>
                  </div>
                  <p className="ph-check-notice__body">{errorCopy.body}</p>
                </section>
              )}

              {verdict && (
                <section
                  ref={resultRef}
                  className="ph-check-result"
                  aria-labelledby="ph-check-result-title"
                >
                  <h2
                    id="ph-check-result-title"
                    ref={resultTitleRef}
                    tabIndex={-1}
                    className="ph-check-result__title"
                  >
                    {copy.cek.resultTitle}
                  </h2>
                  <div className="ph-check-result__stack">
                    <ResultCard
                      verdict={verdict}
                      onCopy={() => setError(null)}
                      onWhy={openWhy}
                      notices={verdict.notices}
                    />
                    {showParser && (
                      <MessageParserList
                        items={parsedItems}
                        rawMessage={verdict.rawText}
                      />
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>

        <Footer />
      </main>

      {panelOpen && verdict && (
        <TransparencyPanel
          verdict={verdict}
          surface="web"
          onClose={closeWhy}
        />
      )}
    </>
  );
}
