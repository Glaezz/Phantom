// Pemeriksaan otomatis Design.md bagian 11, dibatasi ke apps/web-cek.
// Setiap temuan membuat skrip keluar dengan kode 1.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = join(appRoot, 'src');

// scripts/ dilewati agar pemeriksa tidak memindai contoh pola di dalam dirinya.
const SKIP_DIRS = new Set(['node_modules', 'dist', '.vite', 'coverage', 'scripts']);
const findings = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else {
      checkFile(full);
    }
  }
}

function rel(file) {
  return relative(appRoot, file).split(sep).join('/');
}

function add(file, line, message) {
  findings.push(`${rel(file)}:${line}  ${message}`);
}

function isCss(file) {
  return file.endsWith('.css');
}
function isCode(file) {
  return file.endsWith('.ts') || file.endsWith('.tsx');
}

function checkFile(file) {
  if (!isCss(file) && !isCode(file) && !file.endsWith('.html')) return;

  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const name = rel(file);

  lines.forEach((line, i) => {
    const lineNo = i + 1;

    // Komentar bukan teks UI atau sumber daya sungguhan; lewati baris komentar penuh.
    if (/^\s*(\/\/|\/\*|\*|<!--)/.test(line)) return;

    // 1. Warna hex mentah di luar tokens.css dan icons/ (DS-40).
    if (
      (isCss(file) || isCode(file)) &&
      name !== 'src/ui/tokens.css' &&
      !name.includes('/icons/') &&
      /#[0-9a-fA-F]{3,8}\b/.test(line)
    ) {
      add(file, lineNo, 'warna hex mentah (DS-40)');
    }

    // 2. Kata terlarang di teks UI (DS-01, 8.2).
    if (isCode(file) && /\b(aman|terjamin|100% asli|terbukti menipu)\b/i.test(line)) {
      add(file, lineNo, 'kata terlarang di teks UI (DS-01, 8.2)');
    }

    // 3. Sumber daya jarak jauh (DS-08).
    if (
      /fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg|jsdelivr|https?:\/\/[^"' )]+\.(woff2?|css|js)/i.test(
        line,
      )
    ) {
      add(file, lineNo, 'sumber daya jarak jauh (DS-08)');
    }
  });
}

walk(appRoot);

// 4. Bentuk status tunggal (DS-60): hanya StatusIcon.tsx yang mendefinisikan bentuk.
const iconFile = join(srcRoot, 'ui', 'icons', 'StatusIcon.tsx');
const iconText = readFileSync(iconFile, 'utf8');
for (const status of ['official', 'neutral', 'caution', 'danger']) {
  if (!new RegExp(`\\b${status}\\s*:`).test(iconText)) {
    findings.push(`src/ui/icons/StatusIcon.tsx  bentuk status "${status}" hilang (DS-60)`);
  }
}

// 5. Pembacaan nilai input situs (DS-05) hanya relevan untuk ekstensi; dilewati.

if (findings.length > 0) {
  console.error('ds:check gagal:\n');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('ds:check lolos: tidak ada temuan di apps/web-cek.');
