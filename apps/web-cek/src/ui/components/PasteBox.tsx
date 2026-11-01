import { useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { copy } from '../copy.id';
import { Button } from './Button';
import './PasteBox.css';

export interface ExampleItem {
  label: string;
  value: string;
}

export interface PasteBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  loading?: boolean;
  examples?: ExampleItem[];
}

const DEFAULT_EXAMPLES: ExampleItem[] = [
  {
    label: 'Undangan Palsu (.apk)',
    value:
      'Surat Undangan Pernikahan Putri Kami. Silakan unduh berkas undangan-pernikahan-digital.apk dan konfirmasi kehadiran ke +62 812-9999-8888.',
  },
  {
    label: 'Login Tiruan',
    value: 'https://login-nusantara-promo.my.id/login',
  },
  {
    label: 'Situs Resmi',
    value: 'https://bank-nusantara-contoh.id',
  },
];

export function PasteBox({
  value,
  onChange,
  onSubmit,
  loading = false,
  examples = DEFAULT_EXAMPLES,
}: PasteBoxProps) {
  const [showPasteHelp, setShowPasteHelp] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
  };

  const handlePaste = async () => {
    setShowPasteHelp(false);
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          onChange(text);
          return;
        }
      }
      setShowPasteHelp(true);
    } catch {
      setShowPasteHelp(true);
    }
  };

  const handleSelectExample = (exValue: string) => {
    onChange(exValue);
    setShowPasteHelp(false);
  };

  return (
    <form className="ph-pastebox" onSubmit={handleSubmit} noValidate>
      {/* Label tampak di atas */}
      <label htmlFor="ph-pastebox-textarea" className="ph-pastebox__label">
        {copy.web.label}
      </label>

      {/* Chip contoh (merek fiktif, NFR-07) */}
      {examples && examples.length > 0 && (
        <div className="ph-pastebox__examples" aria-label={copy.pasteBox.examplesLabel}>
          <span className="ph-pastebox__examples-label">
            {copy.pasteBox.examplesLabel}
          </span>
          <div className="ph-pastebox__chips">
            {examples.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className="ph-pastebox__chip"
                onClick={() => handleSelectExample(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Textarea min 140 px, border 2 px ink-300, focus */}
      <div className="ph-pastebox__textarea-wrap">
        <textarea
          id="ph-pastebox-textarea"
          className="ph-pastebox__textarea"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (showPasteHelp) setShowPasteHelp(false);
          }}
          placeholder={copy.pasteBox.placeholder}
          rows={5}
          disabled={loading}
          aria-required="true"
        />
      </div>

      {/* Pesan bantuan tempel bila akses clipboard ditolak */}
      {showPasteHelp && (
        <p className="ph-pastebox__paste-help" role="status">
          {copy.web.pasteHelp}
        </p>
      )}

      {/* Baris tombol aksi */}
      <div className="ph-pastebox__actions">
        <Button
          type="button"
          variant="secondary"
          onClick={handlePaste}
          disabled={loading}
          className="ph-pastebox__btn-paste"
        >
          {copy.web.paste}
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!value.trim() || loading}
          loading={loading}
          loadingLabel={copy.web.checking}
          className="ph-pastebox__btn-check"
        >
          {copy.web.check}
        </Button>
      </div>

      {/* Persetujuan tersirat Web Cek (EXT-06 hanya untuk ekstensi) */}
      <p className="ph-pastebox__consent">{copy.web.consentNotice}</p>

      {/* Privasi: noStore dengan ikon gembok */}
      <div className="ph-pastebox__privacy">
        <Lock size={16} aria-hidden="true" className="ph-pastebox__privacy-icon" />
        <span>{copy.privacy.noStore}</span>
      </div>
    </form>
  );
}
