// Footer bersama untuk Cek dan Unduh. Container sama dengan landing
// (ph-container--wide) agar tepi kiri/kanan sejajar dengan header.
import { copy } from '../copy.id';
import { Logo } from './Logo';
import './Footer.css';

export function Footer() {
  return (
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
  );
}
