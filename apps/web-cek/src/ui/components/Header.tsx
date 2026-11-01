import { Link, useLocation } from 'react-router-dom';
import { copy } from '../copy.id';
import { Logo } from './Logo';
import './Header.css';
import './Button.css';

const NAV_ITEMS = [
  { to: '/', label: copy.nav.home },
  { to: '/cek', label: copy.nav.check },
  { to: '/unduh', label: copy.nav.download },
] as const;

export function Header() {
  const { pathname } = useLocation();

  const isCek = pathname === '/cek' || pathname === '/cek/';

  return (
    <>
      <a href="#main-content" className="ph-skip-link">
        {copy.nav.skipToContent}
      </a>
      <header className="ph-header" role="banner">
        <div className="ph-header__inner ph-container ph-container--wide">
          {/* Logo + merek */}
          <Link to="/" className="ph-header__brand" aria-label={copy.nav.brand}>
            <Logo size={32} />
            <span className="ph-header__brand-name">{copy.nav.brand}</span>
          </Link>

          {/* Navigasi */}
          <nav className="ph-header__nav" aria-label="Utama">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`ph-header__link${active ? ' ph-header__link--active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                  {/* Penanda aktif: titik persegi kecil (bukan hanya tebal huruf) */}
                  <span className="ph-header__link-dot" aria-hidden="true" />
                </Link>
              );
            })}
          </nav>

          {/* CTA paling kanan, varian secondary; primer hanya di hero. Sembunyikan di /cek */}
          {!isCek && (
            <Link to="/cek" className="ph-header__cta ph-button ph-button--secondary">
              {copy.landing.cta}
            </Link>
          )}
        </div>
      </header>
    </>
  );
}