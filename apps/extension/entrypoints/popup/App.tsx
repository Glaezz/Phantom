import { useEffect, useRef, useState } from 'react';
import type { Verdict } from '../../src/ui/types';
import { copy } from '../../src/ui/copy.id';
import { StatusBadge } from '../../src/ui/components/StatusBadge';
import './App.css';

// Satu-satunya binding yang dibaca content script (lihat entrypoints/content.tsx).
const DEEP_CHECK_KEY = 'phantom:deepCheck';

export default function App() {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [site, setSite] = useState('');
  const [deepCheck, setDeepCheck] = useState<boolean | null>(null);
  const tabIdRef = useRef<number | null>(null);

  useEffect(() => {
    void browser.storage.local
      .get(DEEP_CHECK_KEY)
      .then((res) => setDeepCheck(res[DEEP_CHECK_KEY] === true))
      .catch(() => setDeepCheck(false));
  }, []);

  const toggleDeep = (enabled: boolean) => {
    setDeepCheck(enabled);
    void browser.storage.local.set({ [DEEP_CHECK_KEY]: enabled, 'phantom:consentShown': true });
  };

  useEffect(() => {
    void (async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setUnavailable(true);
        return;
      }
      tabIdRef.current = tab.id;
      try { if (tab.url) setSite(new URL(tab.url).hostname); } catch { /* laman internal */ }
      try {
        const result = (await browser.tabs.sendMessage(tab.id, {
          type: 'phantom:getStatus',
        })) as Verdict | undefined;
        if (result) setVerdict(result);
        else setUnavailable(true);
      } catch {
        setUnavailable(true);
      }
    })();
  }, []);

  // Panel rincian hidup di content script; popup hanya meminta overlay membukanya.
  const openDetail = () => {
    const id = tabIdRef.current;
    if (!id) return;
    void browser.tabs.sendMessage(id, { type: 'phantom:openDetail' }).catch(() => undefined);
    window.close();
  };

  // DS-08: tanpa permintaan jaringan. Buka Web Cek (Vite dev) di tab baru.
  // ponytail: URL hardcoded ke dev server; belum ada env untuk URL Web Cek produksi.
  const openWebCek = () => {
    void browser.tabs.create({ url: 'http://localhost:5173' });
  };

  return (
    <main className="popup">
      <header className="popup-header">
        <img
          className="popup-logo popup-logo-light"
          src="/phantom-full-logo.svg"
          alt="Phantom"
        />
        <img
          className="popup-logo popup-logo-dark"
          src="/phantom-full-logo-light.svg"
          alt=""
          aria-hidden="true"
        />
      </header>

      {!verdict && !unavailable && (
        <section className="popup-status ph-surface" role="status">
          <p className="popup-action">Memeriksa laman…</p>
        </section>
      )}

      {unavailable && (
        <section className="popup-status ph-surface" role="status">
          {site && <p className="popup-site">{site}</p>}
          <p className="popup-detail">Laman ini tidak dapat diperiksa.</p>
        </section>
      )}

      {verdict && (
        <section className="popup-status ph-surface" data-status={verdict.status}>
          <StatusBadge status={verdict.status} />
          <p className="popup-action">
            {verdict.status === 'official' && verdict.claimedBrand
              ? copy.action.official.replace('{brand}', verdict.claimedBrand.name)
              : copy.action[verdict.status]}
          </p>
          {site && <p className="popup-site">{site}</p>}
          {verdict.status === 'official' && verdict.claimedBrand && (
            <p className="popup-detail">
              {copy.popup.officialOf.replace('{brand}', verdict.claimedBrand.name)}
            </p>
          )}
          {(verdict.status === 'caution' || verdict.status === 'danger') && (
            <ul className="popup-detail">
              {verdict.reasons.slice(0, 2).map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          )}
          {verdict.status === 'neutral' && (
            <p className="popup-detail">{copy.status.neutral.title}</p>
          )}
          <div className="popup-actions">
            <button className="popup-link" onClick={openDetail}>
              {copy.popup.viewDetail}
            </button>
            <button className="popup-link" onClick={openWebCek}>
              {copy.popup.openWeb}
            </button>
          </div>
        </section>
      )}

      {deepCheck !== null && (
        <section className="popup-settings ph-surface">
          <label className="popup-toggle">
            <input
              type="checkbox"
              checked={deepCheck}
              onChange={(e) => toggleDeep(e.target.checked)}
            />
            <span>{copy.popup.toggleDeep}</span>
          </label>
        </section>
      )}
    </main>
  );
}
