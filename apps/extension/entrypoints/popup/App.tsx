import { useState } from 'react';
import { fixtures, type FixtureKey } from '../../src/__fixtures__/verdicts';
import { copy } from '../../src/ui/copy.id';
import { StatusBadge } from '../../src/ui/components/StatusBadge';
import './App.css';

const SCENARIOS: Array<{ key: FixtureKey; label: string }> = [
  { key: 'S1', label: 'S1 · danger — login tiruan .my.id' },
  { key: 'S2', label: 'S2 · neutral — startup sah' },
  { key: 'S3', label: 'S3 · caution — L4 pending' },
  { key: 'S5', label: 'S5 · floor — prompt injection' },
  { key: 'S6', label: 'S6 · official — kanal resmi' },
];

export default function App() {
  const [last, setLast] = useState<FixtureKey | null>(null);

  const render = async (key: FixtureKey) => {
    setLast(key);
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await browser.tabs.sendMessage(tab.id, { type: 'phantom:render', fixture: key });
    }
  };

  return (
    <main className="popup">
      <h1 className="popup-title">Phantom Dev Harness</h1>
      <p className="popup-desc">Pilih skenario fixture untuk dirender di tab aktif.</p>
      <ul className="popup-list">
        {SCENARIOS.map(({ key, label }) => (
          <li key={key}>
            <button className="popup-btn" onClick={() => render(key)}>
              <StatusBadge status={fixtures[key].status} size="sm" />
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ul>
      {last && (
        <p className="popup-last" role="status">
          Terakhir dirender: {copy.status[fixtures[last].status].short}
        </p>
      )}
    </main>
  );
}
