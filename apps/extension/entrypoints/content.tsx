// Fase 3: interaksi nyata di laman, masih memakai fixture (bukan analisis asli).
// Fase 4 mengganti fixture dengan analyzeCurrentPage() dari packages/core.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import tokensCss from '../src/ui/tokens.css?inline';
import badgeCss from '../src/ui/components/StatusBadge.css?inline';
import buttonCss from '../src/ui/components/Button.css?inline';
import bannerCss from '../src/ui/components/VerdictBanner.css?inline';
import holdCss from '../src/ui/components/HoldIndicator.css?inline';
import calloutCss from '../src/ui/components/FieldCallout.css?inline';
import panelCss from '../src/ui/components/TransparencyPanel.css?inline';
import consentCss from '../src/ui/components/ConsentDialog.css?inline';
import {
  fixtures,
  fixtureS3Resolved,
  isL4Pending,
  type FixtureKey,
} from '../src/__fixtures__/verdicts';
import type { Verdict } from '../src/ui/types';
import { VerdictBanner } from '../src/ui/components/VerdictBanner';
import { TransparencyPanel } from '../src/ui/components/TransparencyPanel';
import { FieldCallout } from '../src/ui/components/FieldCallout';
import { StatusBadge } from '../src/ui/components/StatusBadge';
import { ConsentDialog } from '../src/ui/components/ConsentDialog';
import { HoldIndicator, type HoldIndicatorHandle } from '../src/ui/components/HoldIndicator';

const ALL_CSS = [
  ':host { all: initial; z-index: 2147483647; }',
  tokensCss,
  badgeCss,
  buttonCss,
  bannerCss,
  holdCss,
  calloutCss,
  panelCss,
  consentCss,
].join('\n');

const CONSENT_STORAGE_KEY = 'phantom:consentShown';
const SENSITIVE_SELECTOR =
  'input[type="password"], input[autocomplete="one-time-code"], input[autocomplete="current-password"]';

type Panel =
  | { kind: 'none' }
  | { kind: 'banner-info' }
  | { kind: 'banner-gate' }
  | { kind: 'hold' }
  | { kind: 'transparency' };

function Harness() {
  const [verdict, setVerdict] = React.useState<Verdict | null>(null);
  const [panel, setPanel] = React.useState<Panel>({ kind: 'none' });
  const [calloutRect, setCalloutRect] = React.useState<DOMRect | null>(null);
  const [calloutShown, setCalloutShown] = React.useState(false);
  const [showConsent, setShowConsent] = React.useState(false);
  const pendingSubmit = useRefNull<HTMLFormElement>();
  const holdRef = React.useRef<HoldIndicatorHandle>(null);

  // --- Pesan dari popup: pilih fixture ---
  React.useEffect(() => {
    const onMsg = (msg: { type: string; fixture?: FixtureKey }) => {
      if (msg.type !== 'phantom:render' || !msg.fixture) return;
      const v = fixtures[msg.fixture];
      setVerdict(v);
      setCalloutShown(false);
      pendingSubmit.current = null;
      if (v.status === 'caution' || v.status === 'danger') {
        setPanel({ kind: 'banner-info' });
      } else {
        setPanel({ kind: 'none' });
      }
    };
    browser.runtime.onMessage.addListener(onMsg);
    return () => browser.runtime.onMessage.removeListener(onMsg);
  }, []);

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

  return (
    <>
      {showConsent && (
        <ConsentDialog onAllow={() => dismissConsent(true)} onDeny={() => dismissConsent(false)} />
      )}

      {verdict && (verdict.status === 'neutral' || verdict.status === 'official') && (
        <div style={{ position: 'fixed', top: 'var(--s-3)', right: 'var(--s-3)', zIndex: 2147483647 }}>
          <StatusBadge status={verdict.status} />
        </div>
      )}

      {verdict && panel.kind === 'banner-info' && (
        <VerdictBanner
          verdict={verdict}
          mode="info"
          surface="overlay"
          onWhy={() => setPanel({ kind: 'transparency' })}
          onDismiss={() => setPanel({ kind: 'none' })}
        />
      )}

      {verdict && panel.kind === 'banner-gate' && (
        <VerdictBanner
          verdict={verdict}
          mode="gate"
          surface="overlay"
          onCancelSubmit={cancelSubmit}
          onContinueSubmit={continueSubmit}
          onWhy={() => setPanel({ kind: 'transparency' })}
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
          onClose={() =>
            setPanel(
              verdict.status === 'caution' || verdict.status === 'danger'
                ? { kind: 'banner-info' }
                : { kind: 'none' },
            )
          }
        />
      )}

      {verdict && calloutShown && calloutRect && (verdict.status === 'caution' || verdict.status === 'danger') && (
        <FieldCallout status={verdict.status} targetRect={calloutRect} />
      )}
    </>
  );
}

// HoldIndicator butuh simulasi "L4 selesai setelah N detik" — di sini disimulasikan 2 dtk
// memakai fixtureS3Resolved. Fase 4 mengganti ini dengan hasil fetch proxy sungguhan.
const HoldIndicatorBridge = React.forwardRef<
  HoldIndicatorHandle,
  { verdict: Verdict; onCancel: () => void; onResolved: (v: Verdict) => void }
>(function HoldIndicatorBridge({ verdict, onCancel, onResolved }, ref) {
  const innerRef = React.useRef<HoldIndicatorHandle>(null);
  React.useImperativeHandle(ref, () => innerRef.current as HoldIndicatorHandle, []);

  React.useEffect(() => {
    const t = setTimeout(() => {
      innerRef.current?.resolve(fixtureS3Resolved);
    }, 2000);
    return () => clearTimeout(t);
  }, [verdict]);

  return <HoldIndicator ref={innerRef} anchor={null} onCancel={onCancel} onResolve={onResolved} />;
});

function useRefNull<T>() {
  return React.useRef<T | null>(null);
}

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'phantom-overlay',
      position: 'inline',
      anchor: 'body',
      onMount: (container, shadow) => {
        // DS-22: semua gaya di dalam shadow root; jangan warisi gaya situs.
        const style = document.createElement('style');
        style.textContent = ALL_CSS;
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
