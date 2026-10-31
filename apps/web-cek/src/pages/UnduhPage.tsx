import { copy } from '../ui/copy.id';
import { Header } from '../ui/components/Header';

export function UnduhPage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <div className="ph-container" style={{ paddingBlock: 'var(--s-16)', textAlign: 'center' }}>
          <h1>{copy.nav.download}</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 'var(--s-3)' }}>
            {copy.placeholder.comingSoon}
          </p>
        </div>
      </main>
    </>
  );
}