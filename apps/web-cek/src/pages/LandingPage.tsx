import { Link } from 'react-router-dom';
import { copy } from '../ui/copy.id';
import type { Status } from '../lib/types';
import { Header } from '../ui/components/Header';
import { StatusBadge } from '../ui/components/StatusBadge';
import { Logo } from '../ui/components/Logo';
import '../ui/components/Button.css';
import './LandingPage.css';

const STATUS_ORDER: Status[] = ['official', 'neutral', 'caution', 'danger'];

// Kalimat aksi status; isi {brand} dengan merek fiktif untuk contoh (NFR-07).
function statusAction(status: Status): string {
  return copy.action[status].replace('{brand}', copy.landing.heroExampleBrand);
}

// Judul hero memakai copy.web.headline persis. Kata terakhir + titik merek
// diikat nowrap agar titik tidak pernah jatuh sendirian (DS-53).
function splitHeadline(headline: string) {
  const words = headline.trim().split(/\s+/);
  const last = words.pop() ?? '';
  return { lead: words.join(' '), last };
}

export function LandingPage() {
  const { lead, last } = splitHeadline(copy.web.headline);

  return (
    <>
      <Header />

      <main id="main-content" tabIndex={-1}>
        {/* Hero */}
        <section className="ph-hero" aria-labelledby="hero-heading">
          <div className="ph-container ph-container--wide ph-hero__inner">
            <div className="ph-hero__text">
              <h1 id="hero-heading" className="ph-hero__headline">
                {lead}{' '}
                <span className="ph-hero__last">
                  {last}
                  <span className="ph-dot ph-hero__dot" aria-hidden="true" />
                </span>
              </h1>
              <p className="ph-hero__subtitle">{copy.landing.subtitle}</p>
              <div className="ph-hero__actions">
                <Link to="/cek" className="ph-button ph-button--primary">
                  {copy.landing.cta}
                </Link>
                <Link to="/unduh" className="ph-button ph-button--secondary">
                  {copy.landing.secondaryCta}
                </Link>
              </div>
            </div>

            {/* Bukti visual: contoh hasil statis (bukan ResultCard sungguhan) */}
            <div className="ph-hero__visual">
              <div className="ph-hero__motif" aria-hidden="true">
                <svg
                  viewBox="0 0 200 200"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="ph-hero__motif-svg"
                >
                  <circle cx="100" cy="100" r="90" />
                  <path d="M50 100 A70 70 0 0 1 150 100" />
                  <path d="M40 80 A85 85 0 0 0 160 80" />
                </svg>
              </div>

              <figure className="ph-hero__example">
                <figcaption className="ph-hero__example-label">
                  {copy.landing.heroExampleLabel}
                </figcaption>
                <div className="ph-hero__example-card">
                  <StatusBadge status="danger" size="md" />
                  <p className="ph-hero__example-title">{copy.status.danger.title}</p>
                  <p className="ph-hero__example-action">{copy.action.danger}</p>
                  <code className="ph-hero__example-address">
                    {copy.landing.heroExampleAddress}
                  </code>
                </div>
              </figure>
            </div>
          </div>
        </section>

        {/* Cara Kerja */}
        <section className="ph-how ph-section" aria-labelledby="how-heading">
          <div className="ph-container ph-container--wide">
            <h2 id="how-heading" className="ph-section-heading">
              {copy.landing.howTitle}
            </h2>
            <ol className="ph-how__steps">
              {copy.landing.howSteps.map((step, i) => (
                <li key={i} className="ph-how__step">
                  <span className="ph-how__step-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3 className="ph-how__step-title">{copy.landing.howStepTitles[i]}</h3>
                  <p className="ph-how__step-text">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Empat Status Phantom */}
        <section className="ph-statuses ph-section" aria-labelledby="status-heading">
          <div className="ph-container ph-container--wide">
            <h2 id="status-heading" className="ph-section-heading">
              {copy.landing.statusPhantomTitle}
            </h2>
            <p className="ph-section-intro">{copy.landing.statusIntro}</p>
            <div className="ph-statuses__grid">
              {STATUS_ORDER.map((status) => (
                <div key={status} className="ph-statuses__card">
                  <StatusBadge status={status} size="md" />
                  <p className="ph-statuses__note">{statusAction(status)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Privasi */}
        <section className="ph-privacy ph-section" aria-labelledby="privacy-heading">
          <div className="ph-container ph-container--wide">
            <h2 id="privacy-heading" className="ph-section-heading">
              {copy.landing.privacyTitle}
            </h2>
            <p className="ph-section-intro">{copy.landing.privacyBody}</p>
            <ul className="ph-privacy__points">
              <li className="ph-privacy__point">{copy.privacy.noRead}</li>
              <li className="ph-privacy__point">{copy.privacy.noStore}</li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <footer className="ph-footer" role="contentinfo">
          <div className="ph-container ph-container--wide ph-footer__inner">
            {/* DS-09 */}
            <p className="ph-footer__tagline">{copy.footer.tagline}</p>
            <p className="ph-footer__disclaimer">{copy.footer.disclaimer}</p>
            <p className="ph-footer__copyright">{copy.footer.copyright}</p>

            <div className="ph-footer__brand">
              <Logo size={28} />
              <span className="ph-footer__brand-name">{copy.nav.brand}</span>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}