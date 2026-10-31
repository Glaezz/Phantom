import React from 'react';
import { createRoot } from 'react-dom/client';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import type { AnalysisResult } from '@phantom/core';
import { analyzeCurrentPage } from '../src/analyze/analyzePage';
import { toVerdict } from '../src/analyze/toVerdict';
import { SENSITIVE_SELECTOR } from '../src/analyze/extractFeatures';
import { isL4Pending } from '../src/__fixtures__/verdicts';
import type { Verdict } from '../src/ui/types';
import { fontFaceCss } from '../src/ui/fonts';
import { VerdictBanner } from '../src/ui/components/VerdictBanner';
import { TransparencyPanel } from '../src/ui/components/TransparencyPanel';
import { FieldCallout } from '../src/ui/components/FieldCallout';
import { ConsentDialog } from '../src/ui/components/ConsentDialog';
import { HoldIndicator, type HoldIndicatorHandle } from '../src/ui/components/HoldIndicator';
import { StatusPill } from '../src/ui/components/StatusPill';

const CONSENT_STORAGE_KEY = 'phantom:consentShown';
const DISMISS_SESSION_KEY = `phantom:bannerDismissed:${location.origin}`;

type Panel =
  | { kind: 'none' }
  | { kind: 'banner-info' }   // dipakai setelah Batal Kirim (bukan banner visit)
  | { kind: 'banner-gate' }
  | { kind: 'hold' }
  | { kind: 'transparency'; from: 'gate' | 'visit' };

const STATUS_RANK: Record<Verdict['status'], number> = {
  official: 0, neutral: 1, caution: 2, danger: 3,
};

function readDismissed(): boolean {
  try { return sessionStorage.getItem(DISMISS_SESSION_KEY) === '1'; } catch { return false; }
}
function writeDismissed(v: boolean): void {
  try { v ? sessionStorage.setItem(DISMISS_SESSION_KEY, '1') : sessionStorage.removeItem(DISMISS_SESSION_KEY); } catch { /* noop */ }
}

function Harness() {
  const [verdict, setVerdict] = React.useState<Verdict | null>(null);
  const [panel, setPanel] = React.useState<Panel>({ kind: 'none' });
  const [calloutRect, setCalloutRect] = React.useState<DOMRect | null>(null);
  const [calloutShown, setCalloutShown] = React.useState(false);
  const [showConsent, setShowConsent] = React.useState(false);
  const [bannerDismissed, setBannerDismissed] = React.useState<boolean>(readDismissed);
  const pendingSubmit = useRefNull<HTMLFormElement>();
  const holdRef = React.useRef<HoldIndicatorHandle>(null);
  const prevStatusRef = React.useRef<Verdict['status'] | null>(null);

  // --- Analisis L0–L2 nyata dari core; simpan hasil terakhir untuk popup. ---
  React.useEffect(() => {
    let lastResult: AnalysisResult | null = null;

    const run = () => {
      const result = analyzeCurrentPage();
      lastResult = result;
      setVerdict(toVerdict(result));
    };
    run();

    // CORE-10: periksa ulang pada navigasi SPA dan perubahan DOM yang relevan.
    const onHistoryChange = () => run();
    window.addEventListener('pushState', onHistoryChange);
    window.addEventListener('replaceState', onHistoryChange);
    window.addEventListener('popstate', onHistoryChange);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(run, 300);
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    // Popup bertanya status tab aktif; balas hasil mentah (kontrak core).
    const onMsg = (msg: { type: string }) => {
      if (msg.type !== 'phantom:getStatus') return;
      return Promise.resolve(lastResult);
    };
    browser.runtime.onMessage.addListener(onMsg);

    return () => {
      window.removeEventListener('pushState', onHistoryChange);
      window.removeEventListener('replaceState', onHistoryChange);
      window.removeEventListener('popstate', onHistoryChange);
      observer.disconnect();
      clearTimeout(timer);
      browser.runtime.onMessage.removeListener(onMsg);
    };
  }, []);

  // Status memburuk → reset dismissed supaya banner Bahaya kembali muncul.
  React.useEffect(() => {
    if (!verdict) return;
    const prev = prevStatusRef.current;
    if (prev && STATUS_RANK[verdict.status] > STATUS_RANK[prev]) {
      writeDismissed(false);
      setBannerDismissed(false);
    }
    prevStatusRef.current = verdict.status;
  }, [verdict]);

  // --- Consent sekali per perangkat (chrome.storage.local) ---
  React.useEffect(() => {
    browser.storage.local.get(CONSENT_STORAGE_KEY).then((res) => {
      if (!res[CONSENT_STORAGE_KEY]) setShowConsent(true);
    });
  }, []);

  const dismissConsent = (allowed: boolean) => {
    browser.storage.local.set({ [CONSENT_STORAGE_KEY]: true, [`${CONSENT_STORAGE_KEY}:allow`]: allowed });
    setShowConsent(false);
  };

  // --- FieldCallout: fokus kolom sensitif, maks 1 per laman per sesi ---
  React.useEffect(() => {
    if (!verdict || (verdict.status !== 'caution' && verdict.status !== 'danger')) return;
    const onFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (!target.matches?.(SENSITIVE_SELECTOR)) return;
      if (calloutShown) return;
      setCalloutRect(target.getBoundingClientRect());
      setCalloutShown(true);
    };
    document.addEventListener('focus', onFocus, true);
    return () => document.removeEventListener('focus', onFocus, true);
  }, [verdict, calloutShown]);

  // --- Soft gate: submit laman ditahan ---
  React.useEffect(() => {
    if (!verdict || (verdict.status !== 'caution' && verdict.status !== 'danger')) return;
    const onSubmit = (e: SubmitEvent) => {
      e.preventDefault();
      pendingSubmit.current = e.target as HTMLFormElement;
      if (verdict.status === 'caution' && isL4Pending(verdict)) {
        setPanel({ kind: 'hold' });
      } else {
        setPanel({ kind: 'banner-gate' });
      }
    };
    document.addEventListener('submit', onSubmit, true);
    return () => document.removeEventListener('submit', onSubmit, true);
  }, [verdict]);

  if (!verdict && !showConsent) return null;

  const cancelSubmit = () => {
    pendingSubmit.current = null;
    setPanel(verdict?.status === 'caution' || verdict?.status === 'danger' ? { kind: 'banner-info' } : { kind: 'none' });
  };

  const continueSubmit = () => {
    const form = pendingSubmit.current;
    pendingSubmit.current = null;
    setPanel({ kind: 'none' });
    form?.submit();
  };

  const dismissVisitBanner = () => {
    writeDismissed(true);
    setBannerDismissed(true);
  };

  // Banner visit otomatis: hanya danger + belum ditutup di sesi ini + tidak sedang menangani panel lain.
  const showVisitBanner =
    verdict?.status === 'danger' && !bannerDismissed && panel.kind === 'none';

  // Pil kecil: caution selalu, danger saat banner sudah ditutup. Sembunyikan jika panel lain terbuka.
  const showPill =
    verdict &&
    (verdict.status === 'caution' || (verdict.status === 'danger' && bannerDismissed)) &&
    panel.kind === 'none' &&
    !showVisitBanner;

  return (
    <>
      {showConsent && (
        <ConsentDialog onAllow={() => dismissConsent(true)} onDeny={() => dismissConsent(false)} />
      )}

      {/* Netral/Resmi tanpa UI overlay (DS-07) — status terlihat di popup */}

      {verdict && showVisitBanner && (
        <VerdictBanner
          verdict={verdict}
          mode="info"
          surface="overlay"
          onWhy={() => setPanel({ kind: 'transparency', from: 'visit' })}
          onDismiss={dismissVisitBanner}
        />
      )}

      {verdict && showPill && (
        <StatusPill
          status={verdict.status as 'caution' | 'danger'}
          onOpen={() => setPanel({ kind: 'transparency', from: 'visit' })}
        />
      )}

      {verdict && panel.kind === 'banner-info' && (
        <VerdictBanner
          verdict={verdict}
          mode="info"
          surface="overlay"
          onWhy={() => setPanel({ kind: 'transparency', from: 'visit' })}
          onDismiss={() => {
            dismissVisitBanner();
            setPanel({ kind: 'none' });
          }}
        />
      )}

      {verdict && panel.kind === 'banner-gate' && (
        <VerdictBanner
          verdict={verdict}
          mode="gate"
          surface="overlay"
          onCancelSubmit={cancelSubmit}
          onContinueSubmit={continueSubmit}
          onWhy={() => setPanel({ kind: 'transparency', from: 'gate' })}
        />
      )}

      {verdict && panel.kind === 'hold' && (
        <HoldIndicatorBridge
          ref={holdRef}
          verdict={verdict}
          onCancel={cancelSubmit}
          onResolved={(resolved) => {
            setVerdict(resolved);
            if (resolved.status === 'neutral' || resolved.status === 'official') {
              const form = pendingSubmit.current;
              pendingSubmit.current = null;
              setPanel({ kind: 'none' });
              form?.submit();
            } else {
              setPanel({ kind: 'banner-gate' });
            }
          }}
        />
      )}

      {verdict && panel.kind === 'transparency' && (
        <TransparencyPanel
          verdict={verdict}
          surface="overlay"
          onClose={() => setPanel({ kind: panel.from === 'gate' ? 'banner-gate' : 'none' })}
        />
      )}

      {verdict && calloutShown && calloutRect && (verdict.status === 'caution' || verdict.status === 'danger') && (
        <FieldCallout status={verdict.status} targetRect={calloutRect} />
      )}
    </>
  );
}

// L4 belum ada (proxy belum dibangun). hold tidak pernah dipicu; status caution langsung ke gate.
const HoldIndicatorBridge = React.forwardRef<
  HoldIndicatorHandle,
  { verdict: Verdict; onCancel: () => void; onResolved: (v: Verdict) => void }
>(function HoldIndicatorBridge({ onCancel, onResolved }, ref) {
  const innerRef = React.useRef<HoldIndicatorHandle>(null);
  React.useImperativeHandle(ref, () => innerRef.current as HoldIndicatorHandle, []);

  return <HoldIndicator ref={innerRef} anchor={null} onCancel={onCancel} onResolve={onResolved} />;
});

function useRefNull<T>() {
  return React.useRef<T | null>(null);
}

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    // DS-22: ambil overlay.css (entrypoint content-script-style) dan injeksikan ke shadow root.
    const cssUrl = browser.runtime.getURL('/content-scripts/overlay.css');
    // DS-50: @font-face + overlay.css (entrypoint content-script-style) ke shadow root.
    const cssText = await fetch(cssUrl).then((r) => r.text());
    const fontCss = fontFaceCss();

    const ui = await createShadowRootUi(ctx, {
      name: 'phantom-overlay',
      position: 'inline',
      anchor: 'body',
      onMount: (container, shadow) => {
        const style = document.createElement('style');
        style.textContent = fontCss + '\n' + cssText;
        shadow.prepend(style);

        const root = createRoot(container);
        root.render(<Harness />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
