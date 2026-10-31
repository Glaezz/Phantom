import { useId, useState, type ReactNode } from 'react';
import type { ParsedItem, Status } from '../../lib/types';
import { copy } from '../copy.id';
import { StatusIcon } from '../icons/StatusIcon';
import { StatusBadge } from './StatusBadge';
import './MessageParserList.css';

export interface MessageParserListProps {
  items: ParsedItem[];
  rawMessage?: string;
  onSelectItem?: (item: ParsedItem) => void;
}

const STATUS_RANK: Record<Status, number> = {
  danger: 0,
  caution: 1,
  neutral: 2,
  official: 3,
};

const VISIBLE_LIMIT = 10;

export function MessageParserList({
  items,
  rawMessage,
  onSelectItem,
}: MessageParserListProps) {
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();

  // Hitung jumlah tautan dan nomor telepon
  const linksCount = items.filter((i) => i.type === 'url').length;
  const phonesCount = items.filter((i) => i.type === 'phone').length;

  const headerText = copy.parser.found
    .replace('{links}', String(linksCount))
    .replace('{phones}', String(phonesCount));

  // Urutkan dari paling berbahaya ke teraman-relatif (Design.md 6.9)
  const sortedItems = [...items].sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status],
  );

  const visibleItems = expanded
    ? sortedItems
    : sortedItems.slice(0, VISIBLE_LIMIT);

  // Sorot pada salinan pesan hanya-baca (Design.md 6.9)
  const renderHighlightedMessage = (): ReactNode => {
    if (!rawMessage) return null;

    type MatchRange = {
      start: number;
      end: number;
      status: Status;
      text: string;
    };

    const matches: MatchRange[] = [];

    for (const item of items) {
      if (!item.value) continue;
      let startIdx = 0;
      while ((startIdx = rawMessage.indexOf(item.value, startIdx)) !== -1) {
        matches.push({
          start: startIdx,
          end: startIdx + item.value.length,
          status: item.status,
          text: item.value,
        });
        startIdx += item.value.length;
      }
    }

    // Urutkan rentang dan hindari tumpang-tindih
    matches.sort((a, b) => a.start - b.start);

    const nonOverlapping: MatchRange[] = [];
    let lastEnd = 0;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        nonOverlapping.push(m);
        lastEnd = m.end;
      }
    }

    const segments: ReactNode[] = [];
    let cursor = 0;

    for (let i = 0; i < nonOverlapping.length; i++) {
      const m = nonOverlapping[i];
      if (m.start > cursor) {
        segments.push(rawMessage.slice(cursor, m.start));
      }
      segments.push(
        <mark
          key={`highlight-${i}`}
          className="ph-parser__highlight"
          data-status={m.status}
        >
          {m.text}
        </mark>,
      );
      cursor = m.end;
    }

    if (cursor < rawMessage.length) {
      segments.push(rawMessage.slice(cursor));
    }

    return (
      <div
        className="ph-parser__preview"
        tabIndex={0}
        aria-label={copy.parser.readOnlyLabel}
      >
        <div className="ph-parser__preview-header">
          <span className="ph-parser__preview-title">
            {copy.parser.readOnlyLabel}
          </span>
        </div>
        <p className="ph-parser__preview-text">{segments}</p>
      </div>
    );
  };

  return (
    <section
      className="ph-parser-list"
      aria-labelledby={headingId}
    >
      {/* Header dengan hitungan */}
      <header className="ph-parser-list__header">
        <h3 id={headingId} className="ph-parser-list__heading">
          {headerText}
        </h3>
      </header>

      {/* Salinan pesan hanya-baca dengan sorotan garis bawah sesuai status */}
      {renderHighlightedMessage()}

      {/* Daftar baris temuan */}
      <ul className="ph-parser-list__items">
        {visibleItems.map((item, index) => {
          const isApk =
            item.isApk || item.value.toLowerCase().includes('.apk');

          return (
            <li
              key={item.id ?? `item-${index}`}
              className="ph-parser-list__row"
              data-status={item.status}
              onClick={() => onSelectItem?.(item)}
            >
              <div className="ph-parser-list__row-main">
                <StatusBadge status={item.status} size="sm" />

                {/* Domain dan nomor telepon selalu teks mono, bukan tautan aktif */}
                <code
                  className="ph-parser-list__value"
                  data-status={item.status}
                >
                  {item.value}
                </code>

                <span className="ph-parser-list__finding">
                  {item.finding}
                </span>
              </div>

              {/* Peringatan khusus file .apk */}
              {isApk && (
                <div
                  className="ph-parser-list__apk-warning"
                  role="alert"
                >
                  <StatusIcon
                    status="danger"
                    size={18}
                    className="ph-parser-list__apk-icon"
                  />
                  <span>{copy.parser.apkWarning}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Batas 10 baris: sisanya di Lihat semua */}
      {sortedItems.length > VISIBLE_LIMIT && (
        <div className="ph-parser-list__footer">
          <button
            type="button"
            className="ph-parser-list__toggle-btn"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            {expanded ? copy.parser.showLess : copy.parser.showAll}
          </button>
        </div>
      )}
    </section>
  );
}
