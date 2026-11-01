import React from 'react';
import { createRoot } from 'react-dom/client';
import { analyze, mergeProxyResult, needsDeepCheck, type PageFeatures, type AnalyzeResponse } from '@phantom/core';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { analyzeCurrentPage } from '../src/analyze/analyzePage';
import { analyzeDeep } from '../src/analyze/proxyClient';
import { toVerdict, type DeepSkipReason } from '../src/analyze/toVerdict';
import { extractFeatures, SENSITIVE_SELECTOR } from '../src/analyze/extractFeatures';
import type { Verdict } from '../src/ui/types';
import { fontFaceCss } from '../src/ui/fonts';
import { VerdictBanner } from '../src/ui/components/VerdictBanner';
import { TransparencyPanel } from '../src/ui/components/TransparencyPanel';
import { FieldCallout } from '../src/ui/components/FieldCallout';
import { ConsentDialog } from '../src/ui/components/ConsentDialog';
import { HoldIndicator, type HoldIndicatorHandle } from '../src/ui/components/HoldIndicator';
import { StatusPill } from '../src/ui/components/StatusPill';

const DEEP_CHECK_KEY = 'phantom:deepCheck';
// Key lama (EXT-06) dibaca sekali untuk migrasi agar pengguna tidak melihat dialog lagi.
const LEGACY_CONSENT_KEY = 'phantom:consentShown';
const DISMISS_SESSION_KEY = `phantom:bannerDismissed:${location.origin}`;

// Deteksi lanjutan (L3+L4) aktif? Satu sumber kebenaran untuk overlay dan popup.
async function readDeepCheck(): Promise<boolean> {
  try {
    const res = await browser.storage.local.get([DEEP_CHECK_KEY, `${LEGACY_CONSENT_KEY}:allow`]);
    const current = res[DEEP_CHECK_KEY];
    if (typeof current === 'boolean') return current;
    return res[`${LEGACY_CONSENT_KEY}:allow`] === true;
  } catch {
    return false;
  }
}

// Proxy membalas tanpa `skipReason` ketika aturan lokal sudah memutuskan (CORE-09):
// L3/L4 memang tidak dijalankan, bukan gagal. Jangan biarkan panel bilang "tidak dapat diselesaikan".
function inferredSkipReason(data: AnalyzeResponse): DeepSkipReason | undefined {
  if (data.final.skipReason) return data.final.skipReason;
  if (data.final.source === 'rules' && !data.l3?.length) return 'notNeeded';
  return undefined;
}

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
  const consentRef = React.useRef(false);
  const deepAbortRef = React.useRef<AbortController | null>(null);
  // Referensi stabil ke verdict terkini lalu dipegang MutationObserver/pesan popup.
  // Ditulis dari effect [verdict] supaya popup menerima hasil L3/L4, bukan ulang L0â€“L2.
  const lastVerdictRef = React.useRef<Verdict | null>(null);
  // Deep check atas permintaan submit sudah berjalan/selesai untuk verdict ini.
  const [evidence, setEvidence] = React.useState<PageFeatures | null>(null);
  const signatureRef = React.useRef('');
  const deepRequest = React.useRef<ReturnType<typeof analyzeDeep> | null>(null);
  // Dinaikkan saat popup mengubah phantom:deepCheck â†’ memicu effect di bawah.
  const [deepTick, setDeepTick] = React.useState(0);

  // --- Analisis L0â€“L2 nyata dari core; simpan hasil terakhir untuk popup. ---
  React.useEffect(() => {
    const run = () => {
      // Navigasi/penyesuaian DOM mengubah bukti â†’ temuan lama tidak berlaku lagi.
      const features = extractFeatures();
      const signature = JSON.stringify(features);
      if (signature === signatureRef.current) return;
      signatureRef.current = signature;
      deepAbortRef.current?.abort();
      deepRequest.current = null;
      setEvidence(features);
      setVerdict(toVerdict(analyze({ url: features.url, features })));
    };
    run();

    // CORE-10: periksa ulang pada navigasi SPA dan perubahan DOM yang relevan.
    const onHistoryChange = () => run();
    window.addEventListener('pushState', onHistoryChange);
    window.addEventListener('replaceState', onHistoryChange);
    window.addEventListener('popstate', onHistoryChange);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const relevant = 'form, input, select, textarea, label, legend, [role="heading"], h1, meta[property="og:site_name"], meta[name="application-name"], script[src], img[src], link[href], iframe[src]';
    const observer = new MutationObserver((mutations) => {
      if (!mutations.some((mutation) => {
        if (mutation.type === 'attributes') return true;
        return [...mutation.addedNodes, ...mutation.removedNodes].some((node) =>
          node instanceof Element && (node.matches(relevant) || !!node.querySelector(relevant)) ||
          node instanceof Text && node.parentElement?.matches('h1, label, legend, [role="heading"]')
        );
      })) return;
      clearTimeout(timer);
      timer = setTimeout(run, 300);
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['action', 'method', 'type', 'name', 'id', 'autocomplete', 'placeholder', 'aria-label', 'src', 'href', 'content'],
    });

    // Popup menerima verdict siap tampil agar tidak memuat mesin core kedua kali.
    const onMsg = (msg: { type: string }) => {
      if (msg.type === 'phantom:getStatus') return Promise.resolve(lastVerdictRef.current);
      if (msg.type === 'phantom:openDetail') {
        setPanel({ kind: 'transparency', from: 'visit' });
        return Promise.resolve(true);
      }
      return undefined;
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

  // Status memburuk â†’ reset dismissed supaya banner Bahaya kembali muncul.
  React.useEffect(() => {
    if (!verdict) return;
    lastVerdictRef.current = verdict;
    const prev = prevStatusRef.current;
    if (prev && STATUS_RANK[verdict.status] > STATUS_RANK[prev]) {
      writeDismissed(false);
      setBannerDismissed(false);
    }
    prevStatusRef.current = verdict.status;
  }, [verdict]);

  // --- Deteksi lanjutan: izin sekali lewat dialog, bisa diubah dari popup ---
  React.useEffect(() => {
    let active = true;
    let changed = false;
    void readDeepCheck().then((enabled) => {
      if (!active || changed) return;
      consentRef.current = enabled;
      setDeepTick((n) => n + 1);
    });
    browser.storage.local.get(LEGACY_CONSENT_KEY).then((res) => {
      if (!res[LEGACY_CONSENT_KEY]) setShowConsent(true);
    });

    // Popup mengubah phantom:deepCheck â†’ berlaku tanpa reload halaman.
    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local' || !changes[DEEP_CHECK_KEY]) return;
      changed = true;
      consentRef.current = changes[DEEP_CHECK_KEY].newValue === true;
      if (!consentRef.current) deepAbortRef.current?.abort();
      // Mati â†’ temuan lama tidak berlaku; nyala â†’ boleh diperiksa ulang.
      setDeepTick((n) => n + 1);
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => {
      active = false;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  const setDeepCheck = (enabled: boolean) => {
    browser.storage.local.set({
      [DEEP_CHECK_KEY]: enabled,
      [LEGACY_CONSENT_KEY]: true,
    });
    consentRef.current = enabled;
    setDeepTick((n) => n + 1);
    setShowConsent(false);
  };

  React.useEffect(() => {
    if (!evidence) return;
    const local = analyze({ url: evidence.url, features: evidence });
    const signature = JSON.stringify(evidence);
    if (!consentRef.current || showConsent) {
      deepAbortRef.current?.abort();
      deepRequest.current = null;
      const next = toVerdict(local);
      setVerdict(next);
      if (panel.kind === 'hold') holdRef.current?.resolve(next);
      return;
    }
    if (!needsDeepCheck(local)) {
      if (panel.kind === 'hold') holdRef.current?.resolve(toVerdict(local));
      return;
    }
    let active = true;
    if (!deepRequest.current) {
      const controller = new AbortController();
      deepAbortRef.current = controller;
      deepRequest.current = analyzeDeep(evidence, { cloud: true, domainAge: true }, controller.signal);
    }
    const controller = deepAbortRef.current!;
    void deepRequest.current.then((res) => {
      if (!active || controller.signal.aborted || signatureRef.current !== signature) return;
      const next = res.ok
        ? toVerdict(local, { l3: res.data.l3, l4: res.data.l4 }, {
            status: mergeProxyResult(local, res.data), source: res.data.final.source,
            skipReason: inferredSkipReason(res.data),
          })
        : toVerdict(local, {}, { skipReason: 'proxyUnavailable' });
      setVerdict(next);
      if (panel.kind === 'hold') holdRef.current?.resolve(next);
    });
    return () => { active = false; };
  }, [evidence, deepTick, showConsent, panel.kind]);

  React.useEffect(() => () => { deepAbortRef.current?.abort(); }, []);

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

  // --- Soft gate: submit laman ditahan (EXT-04) ---
  React.useEffect(() => {
    if (!verdict || (verdict.status !== 'caution' && verdict.status !== 'danger')) return;
    const onSubmit = (e: SubmitEvent) => {
      e.preventDefault();
      pendingSubmit.current = e.target as HTMLFormElement;
      // Hati-hati yang perlu investigasi: verifikasi L3/L4 dulu, maks 6 dtk.
      if (verdict.status === 'caution' && needsAgentCheck()) {
        setPanel({ kind: 'hold' });
      } else {
        setPanel({ kind: 'banner-gate' });
      }
    };
    document.addEventListener('submit', onSubmit, true);
    return () => document.removeEventListener('submit', onSubmit, true);
  }, [verdict]);

  // Ikuti flag core, termasuk klaim merek di hosting gratis dengan aset resmi.
  const needsAgentCheck = () => {
    const { needsAgent } = analyzeCurrentPage();
    return needsAgent;
  };

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
        <ConsentDialog onAllow={() => setDeepCheck(true)} onDeny={() => setDeepCheck(false)} />
      )}

      {/* Netral/Resmi tanpa UI overlay (DS-07) â€” status terlihat di popup */}

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

// Menjembatani hold ke ref Harness: resolve() selalu dipanggil, baik L3/L4 berhasil maupun gagal.
const HoldIndicatorBridge = React.forwardRef<
  HoldIndicatorHandle,
  { verdict: Verdict; onCancel: () => void; onResolved: (v: Verdict) => void }
>(function HoldIndicatorBridge({ onCancel, onResolved }, ref) {
  const innerRef = React.useRef<HoldIndicatorHandle>(null);
  React.useImperativeHandle(
    ref,
    () => ({ resolve: (v: Verdict) => innerRef.current?.resolve(v) }),
    [],
  );

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
