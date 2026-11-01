import { copy } from '../ui/copy.id';
import { DOWNLOAD_URL } from '../lib/constants';
import { Header } from '../ui/components/Header';
import { Footer } from '../ui/components/Footer';
import { InstallStepper } from '../ui/components/InstallStepper';
import '../ui/components/Button.css';
import './Page.css';
import './UnduhPage.css';

export function UnduhPage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="ph-page">
        <div className="ph-container ph-container--wide">
          <div className="ph-page__column ph-page__column--download">
            <header className="ph-page__head">
              <h1 className="ph-page__title">
                {copy.download.title}
                <span className="ph-dot ph-page__dot" aria-hidden="true" />
              </h1>
              <p className="ph-page__intro">{copy.download.subtitle}</p>
            </header>

            <div className="ph-page__stack">
              {/* Satu-satunya tombol primer di layar ini. */}
              <div className="ph-download__cta">
                <a
                  className="ph-button ph-button--primary ph-download__button"
                  href={DOWNLOAD_URL}
                  download
                >
                  {copy.download.button}
                </a>
                <div className="ph-download__notes">
                  <p className="ph-download__note">{copy.download.zipNote}</p>
                  <p className="ph-download__note">{copy.download.notInStore}</p>
                  <p className="ph-download__note">
                    {copy.download.requirements}
                  </p>
                </div>
              </div>

              <section
                className="ph-download__steps"
                aria-labelledby="unduh-steps-title"
              >
                <h2
                  id="unduh-steps-title"
                  className="ph-download__section-title"
                >
                  {copy.download.stepsTitle}
                </h2>
                <InstallStepper />
              </section>

              <section
                className="ph-download__privacy"
                aria-labelledby="unduh-privacy-title"
              >
                <h2
                  id="unduh-privacy-title"
                  className="ph-download__section-title"
                >
                  {copy.download.privacyTitle}
                </h2>
                <p className="ph-download__privacy-body">
                  {copy.download.privacyBody}
                </p>
                <ul className="ph-download__privacy-list">
                  <li className="ph-download__privacy-item">
                    {copy.privacy.noRead}
                  </li>
                  <li className="ph-download__privacy-item">
                    {copy.privacy.noStore}
                  </li>
                </ul>
              </section>
            </div>
          </div>
        </div>

        <Footer />
      </main>
    </>
  );
}
