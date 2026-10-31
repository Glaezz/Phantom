import { useEffect, useState } from 'react';
import type { AnalysisResult } from '@phantom/core';
import { toVerdict } from '../../src/analyze/toVerdict';
import type { Verdict } from '../../src/ui/types';
import { copy } from '../../src/ui/copy.id';
import { StatusBadge } from '../../src/ui/components/StatusBadge';
import './App.css';

export default function App() {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    void (async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setUnavailable(true);
        return;
      }
      try {
        const result = (await browser.tabs.sendMessage(tab.id, {
          type: 'phantom:getStatus',
        })) as AnalysisResult | undefined;
        if (result) setVerdict(toVerdict(result));
        else setUnavailable(true);
      } catch {
        setUnavailable(true);
      }
    })();
  }, []);

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

      {unavailable && (
        <section className="popup-status ph-surface">
          <StatusBadge status="neutral" />
          <p className="popup-detail">Laman ini tidak dapat diperiksa.</p>
        </section>
      )}

      {verdict && (
        <section className="popup-status ph-surface">
          <StatusBadge status={verdict.status} />
          <p className="popup-action">
            {verdict.status === 'official' && verdict.claimedBrand
              ? copy.action.official.replace('{brand}', verdict.claimedBrand.name)
              : copy.action[verdict.status]}
          </p>
          {verdict.status === 'official' && verdict.claimedBrand && (
            <p className="popup-detail">
              {copy.popup.officialOf.replace('{brand}', verdict.claimedBrand.name)}
            </p>
          )}
          {verdict.status === 'neutral' && (
            <p className="popup-detail">{copy.status.neutral.title}</p>
          )}
          <div className="popup-actions">
            <button className="popup-link" onClick={openWebCek}>
              {copy.popup.openWeb}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
