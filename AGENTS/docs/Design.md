---
name: phantom-design-system
version: 2.0.0
audience: ai-agent            # dokumen ini ditulis untuk dibaca dan dijalankan agen AI
language_ui: id-ID
source_of_truth: [PRD MVP Phantom v1.2, phantom_full_logo.svg]
platforms: [extension-overlay, extension-popup, web-cek-pwa, web-unduh]
stack: [Vite, React, TypeScript, CSS variables, Shadow DOM]
---

# Phantom Design System — Panduan untuk AI Agent

Dokumen ini adalah **kontrak** antara desain dan kode. Baca sebagai instruksi, bukan inspirasi. Tujuannya: setiap UI Phantom (overlay ekstensi, popup, Web Cek, halaman Unduh) tampil **identik secara gaya** dan **sama secara UX**, siapa pun (manusia atau agen) yang membuatnya.

Kata kunci: **WAJIB** = harus dipatuhi. **DILARANG** = tidak boleh dilakukan. **SEBAIKNYA** = default, boleh menyimpang bila ada alasan tertulis di komentar PR. Setiap aturan punya ID (`DS-xx`) agar bisa dirujuk di review. Rujukan `EXT-xx`, `CORE-xx`, `WEB-xx`, `G1–G4` mengacu ke PRD v1.2.

Versi untuk pembaca manusia (narasi, alasan, wireframe panjang) ada di `Design.referensi-manusia.md`. Bila dua dokumen bertentangan, **dokumen ini menang**.

---

## 0. Cara Memakai (alur kerja agen)

Lakukan berurutan setiap kali diminta membuat atau mengubah UI:

1. **Identifikasi permukaan** (bagian 2): overlay, popup, Web Cek, atau Unduh. Ini menentukan adaptor platform.
2. **Identifikasi status** yang ditampilkan (`official | neutral | caution | danger`) dan **momen** (laman dibuka, fokus kolom sensitif, form dikirim, menunggu L4, hasil Web Cek).
3. **Cari komponen** di bagian 6. **DILARANG membuat komponen baru** bila ada yang sudah mencakup. Bila benar-benar perlu, ikuti bagian 12.
4. **Ambil teks** dari katalog salinan (bagian 8). **DILARANG menulis teks UI baru di dalam komponen.** Tambahkan ke katalog dulu.
5. **Pakai token** (bagian 3). **DILARANG menulis nilai hex, px, atau ms mentah** di komponen.
6. **Jalankan pemeriksaan otomatis** (bagian 11) dan **daftar periksa UX** (bagian 10) sebelum menyatakan selesai.

Bila instruksi pengguna bertentangan dengan aturan di sini, ikuti pengguna **kecuali** aturan bertanda 🔒 (bagian 1.2). Aturan 🔒 melindungi keselamatan pengguna dan batasan PRD, jadi katakan terus terang bahwa Anda tidak bisa melakukannya.

---

## 1. Prinsip dan Aturan Keras

### 1.1 Prinsip (urutan prioritas bila bertabrakan)

1. **Keselamatan pengguna**: peringatan jelas, aksi aman termudah.
2. **Kejelasan untuk awam dan lansia**: satu keputusan per layar, bahasa sehari-hari.
3. **Positif palsu rendah** (`G2`): situs sah tidak boleh diganggu. Netral dan Resmi tidak memunculkan banner.
4. **Transparansi** (`G4`): setiap vonis bisa ditelusuri L0–L4.
5. **Konsistensi lintas platform**: satu token, satu komponen, satu salinan.
6. **Estetika modern dan tenang**: tegas tanpa panik.

### 1.2 Aturan keras

| ID | Aturan |
| --- | --- |
| DS-01 🔒 | **DILARANG** ada status "Aman". Hanya `official`, `neutral`, `caution`, `danger`. Kata "aman/terjamin/100% asli" dilarang sebagai vonis. |
| DS-02 🔒 | Status **WAJIB** diwakili tiga hal sekaligus: warna + bentuk ikon + kata. Warna saja dilarang. |
| DS-03 🔒 | **Batal Kirim** WAJIB tombol paling menonjol dan menerima fokus awal pada gerbang. **Tetap Kirim** DILARANG lebih menonjol atau menerima fokus awal. |
| DS-04 🔒 | Pada `danger`, **Tetap Kirim** WAJIB butuh dua ketukan. Tombol "percayai situs" DILARANG tampil pada `danger` (`EXT-07`). |
| DS-05 🔒 | UI DILARANG membaca, menyimpan, atau menampilkan nilai yang diketik pengguna di kolom situs (`EXT-04`, `NFR-01`). |
| DS-06 🔒 | **Tidak ada fitur pelaporan oleh pengguna** dan tidak ada pemblokiran keras (non-goals PRD). Hanya peringatan dan gerbang lunak. |
| DS-07 🔒 | Resmi dan Netral **tidak** memunculkan banner. `caution` hasil L1 saja = ikon kuning tanpa banner (`CORE-07`). |
| DS-08 🔒 | Tidak ada telemetri, font/ikon/skrip dari CDN, atau permintaan jaringan dari lapisan UI (`NFR-01`, `NFR-04`). Semua aset dibundel lokal. |
| DS-09 | Hasil adalah **peringatan, bukan putusan hukum**. Kalimat itu WAJIB ada di Transparency Panel dan kartu hasil Web Cek. |
| DS-10 | Tidak ada animasi berkedip, getar, atau suara. `prefers-reduced-motion` WAJIB dihormati. |
| DS-11 | Kegagalan LLM/jaringan WAJIB tampil sebagai hasil mode aturan dengan label "Pemeriksaan cepat", **tanpa pesan galat** (`NFR-03`). |

---

## 2. Permukaan dan Adaptor Platform

Satu paket bersama `packages/ui` berisi token, ikon, komponen React, dan katalog salinan. Setiap permukaan hanya berbeda pada **adaptor** di bawah. Komponen sama, isi sama.

| Permukaan | Wadah | Pemuat gaya | Ukuran dasar teks | Target sentuh | Catatan |
| --- | --- | --- | --- | --- | --- |
| `extension-overlay` | Shadow DOM tertutup (`<phantom-overlay>`) | CSS diimpor sebagai string, disuntik ke `shadowRoot` | 16 px | ≥ 44 px | `all: initial` di `:host`, `z-index: 2147483647`, DILARANG memodifikasi DOM situs |
| `extension-popup` | Dokumen popup MV3, lebar 360 px | `tokens.css` biasa | 16 px | ≥ 44 px | Font dibundel, tanpa CDN |
| `web-cek-pwa` | Halaman Vite + React | `tokens.css` biasa | **18 px** | **≥ 48 px** | Mobile-first, kolom maks. 640 px |
| `web-unduh` | Halaman Vite + React | `tokens.css` biasa | 18 px | ≥ 48 px | Stepper bergambar |

**Aturan konsistensi lintas platform**

| ID | Aturan |
| --- | --- |
| DS-20 | `packages/ui/tokens.css` adalah **satu-satunya** sumber nilai gaya. Overlay, popup, dan Web memakai berkas yang sama. |
| DS-21 | Komponen yang sama (`VerdictBanner`, `TransparencyPanel`, `StatusBadge`, …) dipakai di ekstensi **dan** Web Cek. Perbedaan hanya lewat prop `surface` dan adaptor, bukan salinan kode. |
| DS-22 | Di overlay, jangan mewarisi gaya situs: semua gaya di dalam Shadow DOM. Di Web, jangan memakai Tailwind preflight yang mengubah token. |
| DS-23 | Perbedaan resmi antar permukaan hanya: ukuran teks dasar, target sentuh, posisi (banner menempel atas vs kartu inline), dan keberadaan scrim. Selain itu **identik**. |
| DS-24 | Salinan teks selalu dari katalog (bagian 8), sehingga ekstensi dan Web Cek berkata sama untuk status yang sama. |

Struktur berkas yang diharapkan:

```
packages/ui/
  tokens.css            # bagian 3 (sumber tunggal)
  tokens.ts             # salinan bertipe untuk logika (statusUi)
  copy.id.ts            # bagian 8 (katalog salinan)
  icons/                # bagian 5 (SVG inline)
  fonts/                # Inter + JetBrains Mono (woff2 lokal)
  components/           # bagian 6
  adapters/overlay.ts   # menyuntik CSS ke shadow root
```

---

## 3. Token

### 3.1 Logo sebagai dasar

Logo (`phantom_full_logo.svg`): lambang mata + kaca pembesar dan wordmark "Phantom." dengan titik **persegi**. Hanya dua warna: `#202020` dan `#383838`. Konsekuensi yang **WAJIB** dipatuhi:

| ID | Aturan |
| --- | --- |
| DS-30 | Antarmuka netral hangat. **Warna kromatik hanya untuk status** (dan `--focus`/`--link`). Dilarang menambah warna merek lain. |
| DS-31 | Logo DILARANG diberi warna status, gradien, bayangan, rotasi, atau peregangan. Mode gelap: balik ke `#F2F2EF` (cincin/wordmark) dan `#BDBDB8` (iris). |
| DS-32 | Lambang saja = potong dengan `viewBox="0 0 188 168"`. Ukuran 16 px memakai versi sederhana (cincin + iris + gagang, tanpa sayap). |
| DS-33 | **Titik persegi merek** (`--r-dot: 2px`) dipakai sebagai: bullet jejak analisis, penanda status di ikon toolbar, penutup judul besar. Jangan dipakai di tempat lain. |
| DS-34 | Ikon garis 2 px, `stroke-linecap: round`, `stroke-linejoin: round`, kotak 24 px. |

### 3.2 Nilai token (`tokens.css`)

```css
:host, :root {
  /* netral — ink-900/ink-800 = nilai logo */
  --ink-900:#202020; --ink-800:#383838; --ink-600:#5C5C5C; --ink-400:#8A8A86;
  --ink-300:#D6D6D2; --ink-200:#E7E7E3; --ink-100:#F1F1EE;
  --paper:#FAFAF8; --surface:#FFFFFF; --text:#202020; --text-muted:#5C5C5C;

  /* status (satu-satunya warna kromatik) */
  --official-fg:#0B6B3A; --official-bg:#EAF6EF; --official-border:#BFE3CE; --official-strong:#11793F; --official-on:#FFFFFF;
  --neutral-fg:#3F4A5A;  --neutral-bg:#EEF1F5;  --neutral-border:#D5DBE3;  --neutral-strong:#4B5668;  --neutral-on:#FFFFFF;
  --caution-fg:#8A4B00;  --caution-bg:#FFF6E0;  --caution-border:#F3D68A;  --caution-strong:#F5B301;  --caution-on:#202020;
  --danger-fg:#7A1610;   --danger-bg:#FEF3F2;   --danger-border:#F9C9C4;   --danger-strong:#C0261B;   --danger-on:#FFFFFF;

  /* fungsional */
  --focus:#2F6FED; --link:#1F4FBF; --scrim:rgba(32,32,32,.45);

  /* bentuk */
  --r-sm:8px; --r-md:12px; --r-lg:16px; --r-xl:24px; --r-pill:999px; --r-dot:2px;
  --shadow-1:0 1px 2px rgba(32,32,32,.08);
  --shadow-2:0 8px 24px rgba(32,32,32,.16);
  --shadow-3:0 16px 48px rgba(32,32,32,.24);

  /* jarak (basis 4) */
  --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:20px; --s-6:24px; --s-8:32px; --s-10:40px; --s-12:48px; --s-16:64px;

  /* tipografi */
  --font-ui:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --font-mono:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace;
  --fs-caption:14px; --fs-body:16px; --fs-h2:17px; --fs-h1:20px;      /* overlay & popup */
  --lh-body:1.55; --lh-tight:1.25;

  /* gerak */
  --ease:cubic-bezier(.2,.8,.2,1); --t-fast:150ms; --t-base:220ms;

  /* ukuran sentuh */
  --hit-min:44px;
}

/* Web Cek dan Unduh menimpa skala saja (DS-23) */
[data-surface="web"] {
  --fs-caption:15px; --fs-body:18px; --fs-h2:20px; --fs-h1:26px; --fs-display:32px; --hit-min:48px;
}
@media (min-width:640px){ [data-surface="web"]{ --fs-h1:32px; --fs-display:44px; } }

@media (prefers-color-scheme: dark) {
  :host, :root {
    --paper:#151515; --surface:#1C1C1C; --text:#F2F2EF; --text-muted:#A3A3A0;
    --ink-300:#3A3A38; --ink-200:#2A2A28; --ink-100:#232321;
    --official-fg:#6FD39A; --official-bg:#0F2418; --official-border:#1F4A31; --official-strong:#6FD39A; --official-on:#0F2418;
    --neutral-fg:#AEB8C6;  --neutral-bg:#1A1F27;  --neutral-border:#2C3440;  --neutral-strong:#AEB8C6;  --neutral-on:#151515;
    --caution-fg:#FFC857;  --caution-bg:#2A2008;  --caution-border:#5A4410;  --caution-strong:#FFC857;  --caution-on:#202020;
    --danger-fg:#FF8A80;   --danger-bg:#2A1412;   --danger-border:#5C2A26;   --danger-strong:#FF8A80;   --danger-on:#2A1412;
    --focus:#7AA2FF; --link:#9DB8FF; --scrim:rgba(0,0,0,.6);
    --shadow-2:0 8px 24px rgba(0,0,0,.5); --shadow-3:0 16px 48px rgba(0,0,0,.6);
  }
}
@media (prefers-reduced-motion: reduce){ *{ animation:none !important; transition:none !important; } }
@media (forced-colors: active){ .ph-surface{ border:1px solid CanvasText; } }
```

### 3.3 Aturan token

| ID | Aturan |
| --- | --- |
| DS-40 | Komponen WAJIB hanya memakai `var(--…)`. Nilai hex/rgb/px mentah untuk warna, radius, bayangan, dan font **DILARANG** (kecuali `0`, `1px` untuk border, dan `100%`). |
| DS-41 | Warna status diambil lewat pola `var(--${status}-fg|bg|border|strong|on)`. Dilarang menebak warna status dari nama kelas Tailwind. |
| DS-42 | Pasangan teks/latar yang dipakai WAJIB dari tabel kontras 3.4. Pasangan lain harus dihitung ≥ 4,5:1 (teks) atau ≥ 3:1 (UI) sebelum dipakai. |
| DS-43 | Ukuran teks terkecil 14 px. Teks isi: 16 px (overlay/popup) dan 18 px (web). |
| DS-44 | Domain, URL, nomor telepon, dan nilai teknis WAJIB `font-family: var(--font-mono)`. |

### 3.4 Pasangan kontras yang sudah terverifikasi (WCAG 2.2)

| Teks di atas latar | Rasio | Pakai untuk |
| --- | --- | --- |
| `--ink-900` di `--paper` | 15,6:1 | Teks utama |
| `--ink-800` di `--paper` | 11,2:1 | Teks sekunder tegas |
| `--ink-600` di `--paper` | 6,4:1 | Teks pendukung |
| `--danger-fg` di `--danger-bg` | 9,9:1 | Isi banner Bahaya |
| `--danger-on` di `--danger-strong` | 5,9:1 | Tombol Batal Kirim (Bahaya) |
| `--caution-fg` di `--caution-bg` | 6,3:1 | Isi banner Hati-hati |
| `--caution-on` di `--caution-strong` | 8,8:1 | Tombol Batal Kirim (Hati-hati) |
| `--official-fg` di `--official-bg` | 5,9:1 | Badge Resmi |
| `--official-on` di `--official-strong` | 5,5:1 | Tombol/penanda Resmi |
| `--neutral-fg` di `--neutral-bg` | 7,9:1 | Badge Netral |
| Mode gelap: semua `*-fg` di `*-bg` | ≥ 7,6:1 | Idem |

Jangan pernah menaruh teks putih di atas `--caution-strong` (4,2:1, gagal).

---

## 4. Tipografi

| Peran | Font | Berat | Token ukuran |
| --- | --- | --- | --- |
| Display (hanya Web) | Inter | 700, tracking −0,02em | `--fs-display` |
| Judul status / h1 | Inter | 700 | `--fs-h1` |
| Subjudul / h2 | Inter | 600 | `--fs-h2` |
| Isi | Inter | 400 (tebal: 600) | `--fs-body` |
| Keterangan | Inter | 400 | `--fs-caption` |
| Teknis | JetBrains Mono | 500 | `--fs-body` |

| ID | Aturan |
| --- | --- |
| DS-50 | Font dimuat lewat `@font-face` dari berkas lokal (`web_accessible_resources` di ekstensi). Tanpa Google Fonts. |
| DS-51 | Panjang baris ≤ 65 karakter. Kalimat alasan ≤ 20 kata, maksimum 2 kalimat di banner. |
| DS-52 | Pada domain mencurigakan, bagian janggal (mis. `.my.id`, token merek di posisi salah) diberi `text-decoration: underline dotted var(--danger-fg)`. |
| DS-53 | Judul besar di Web Cek ditutup dengan titik persegi merek (`<span class="ph-dot">`), bukan tanda baca teks. |

---

## 5. Ikon dan Bentuk Status

| Status | Ikon (24 px, garis 2 px) | Kata judul | Kata pendek |
| --- | --- | --- | --- |
| `official` | lingkaran + centang | Situs resmi terverifikasi | Resmi |
| `neutral` | lingkaran + garis datar | Belum ada tanda bahaya | Netral |
| `caution` | segitiga + tanda seru | Hati-hati | Hati-hati |
| `danger` | segi delapan + tanda seru | Bahaya | Bahaya |

| ID | Aturan |
| --- | --- |
| DS-60 | Empat bentuk di atas **bentuk tetap**. Dilarang mengganti, menukar, atau memakai dua status dengan bentuk sama. |
| DS-61 | Ikon dibundel sebagai SVG inline, `aria-hidden="true"`. Makna disampaikan lewat teks di sebelahnya. |
| DS-62 | Ikon toolbar = lambang Phantom + **titik status persegi** di sudut kanan bawah, tepi putih 1 px. Keadaan: `checking`, `official`, `neutral`, `caution`, `danger`, `disabled`. |
| DS-63 | Ikon sistem lain dari satu set garis (disarankan Lucide, ISC) dengan stroke 2, bulat. Dilarang mencampur set ikon berisi/ber-stroke berbeda. |
| DS-64 | Ilustrasi hanya memakai motif logo (mata + kaca pembesar) garis tunggal `--ink-800` dengan satu aksen status. Dilarang ilustrasi orang, maskot, atau "peretas berhoodie". |

---

## 6. Kontrak Komponen

Setiap komponen: **tujuan**, **props**, **keadaan**, **ARIA**, **aturan perilaku**. Agen WAJIB menyalin kontrak ini, bukan menafsirkan ulang.

### 6.0 Tipe bersama

```ts
export type Status = 'official' | 'neutral' | 'caution' | 'danger';
export type Surface = 'overlay' | 'popup' | 'web';
export type Source = 'rules' | 'cache' | 'agent';
export type Stage = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export interface TraceStep {
  stage: Stage;
  finding: 'hard' | 'soft' | 'none' | 'skipped';
  summaryKey: string;        // kunci katalog salinan atau teks dari core (bahasa Indonesia sederhana)
  technical?: { signal?: string; tool?: string; value?: string };
  skipReasonKey?: string;    // wajib bila finding === 'skipped'
}

export interface Verdict {
  status: Status;
  reasons: string[];         // maks. 3, bahasa Indonesia sederhana (CORE-11)
  trace: TraceStep[];
  floor?: Status;            // status minimum dari bukti keras L2
  source: Source;
  claimedBrand?: { id: string; name: string; officialDomains: string[]; officialPhones: string[] };
  suspiciousHost?: string;   // untuk penandaan DS-52
}
```

### 6.1 `StatusBadge`

| Aspek | Spesifikasi |
| --- | --- |
| Tujuan | Penanda status ringkas (ikon + kata pendek). |
| Props | `status: Status`, `size?: 'sm'\|'md'` (28/36 px), `showLabel?: true` |
| Gaya | Pil (`--r-pill`), `bg: --${status}-bg`, `color: --${status}-fg`, border 1 px `--${status}-border`, ikon sesuai bagian 5. |
| ARIA | Teks kata pendek terbaca layar. Ikon `aria-hidden`. |
| Aturan | DILARANG tampil tanpa kata (DS-02). |

### 6.2 `Button`

| Varian | Gaya | Dipakai untuk |
| --- | --- | --- |
| `primary` | `bg: --ink-900`, teks `--surface`, radius `--r-md` | Periksa Sekarang, Izinkan |
| `status` | `bg: --${status}-strong`, teks `--${status}-on` | **Batal Kirim** di banner |
| `secondary` | transparan, border 1 px `--ink-300`, teks `--text` | Tetap Kirim, Tempel dari Papan Klip |
| `tertiary` | tanpa border, teks `--link`, garis bawah saat hover | Kenapa?, Lihat detail |

Tinggi min `--hit-min` (primary di web: 56 px). Keadaan wajib: default, hover (+4% gelap), active (+8%, geser 1 px), focus-visible (cincin 3 px `--focus`, offset 2 px), disabled (opasitas 45%, teks tetap terbaca), loading (spinner + teks "Memeriksa…", `aria-busy="true"`). Dilarang menyembunyikan label dengan ikon saja.

### 6.3 `VerdictBanner` (`EXT-03.1`, `EXT-04`, `EXT-05`)

Satu komponen, dua keadaan: `mode="info"` dan `mode="gate"`.

```ts
interface VerdictBannerProps {
  verdict: Verdict;                 // status harus 'caution' | 'danger'
  mode: 'info' | 'gate';
  surface: 'overlay' | 'web';       // web = inline card; overlay = menempel atas
  onCancelSubmit?: () => void;      // Batal Kirim (wajib pada mode gate)
  onContinueSubmit?: () => void;    // Tetap Kirim (wajib pada mode gate)
  onWhy: () => void;                // buka TransparencyPanel
  onDismiss?: () => void;           // hanya mode info
}
```

| Aspek | Spesifikasi |
| --- | --- |
| Tata letak | Bar aksen kiri 6 px `--${status}-strong`; ikon + judul status (`--fs-h1`, `--${status}-fg`); alasan (maks. 2 kalimat, `--fs-body`); baris aksi. Radius `--r-lg`, padding `--s-4 --s-5`, border 1 px `--${status}-border`, `--shadow-2`. |
| Posisi overlay | Atas viewport, tengah, lebar `min(720px, 100vw - 24px)`, jarak atas 12 px. Layar < 640 px: lebar penuh −12 px. |
| Posisi web | Kartu inline di atas hasil, tanpa scrim. |
| Scrim | Hanya `status==='danger'` **dan** `mode==='gate'` **dan** `surface==='overlay'`. `background: var(--scrim)`. |
| Mode info | Aksi: **Kenapa?** (tertiary), **Mengerti** (secondary), tombol tutup ✕ (area 44×44, `aria-label="Tutup peringatan"`). |
| Mode gate | Judul + "pengiriman ditahan". Aksi: **Batal Kirim** (`status`, fokus awal, min lebar 160 px, tinggi 48) lalu **Tetap Kirim** (`secondary`, tinggi 44). Baris privasi: `copy.privacy.noRead`. |
| Tetap Kirim di `danger` | Ketukan 1 → label menjadi `copy.gate.confirmContinue` selama 5 dtk; ketukan 2 memanggil `onContinueSubmit`. Setelah 5 dtk kembali normal. |
| Tetap Kirim di `caution` | Satu ketukan. |
| Tutup ✕ | Hanya pada mode info. Pada mode gate, tombol tutup tidak ada (keputusan harus dibuat). |
| ARIA | `info`+`danger`: `role="alert"`, `aria-live="assertive"`. `info`+`caution`: `role="status"`, `aria-live="polite"`. `gate`: `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby` (judul), `aria-describedby` (alasan), focus trap. |
| Keyboard | Tab: Batal Kirim → Tetap Kirim → Kenapa? → (Tutup). `Esc` = Batal Kirim. Setelah ditutup, fokus kembali ke elemen sebelumnya. |
| Animasi | Masuk: turun 8 px + fade `--t-base`. Tanpa pantulan. Reduced motion: tanpa animasi. |
| Larangan | Netral/Resmi DILARANG memakai komponen ini (DS-07). Dilarang audio, getar, atau flash. |

### 6.4 `HoldIndicator` (`EXT-04`, risiko "persepsi freeze")

```ts
interface HoldIndicatorProps {
  durationMs: 6000;                       // tetap 6000 (PRD)
  anchor: HTMLElement | null;             // tombol kirim; null → tengah bawah layar
  onCancel: () => void;
  onResolve: (v: Verdict) => void;        // dipanggil dari luar saat L4 selesai
}
```

| Aspek | Spesifikasi |
| --- | --- |
| Teks | `copy.hold.verifying` ("Phantom sedang memverifikasi keamanan laman (maks. 6 dtk)…"). |
| Posisi | Menempel di bawah/samping tombol kirim, lebar mengikuti form (min 280 px). Bila tidak muat: tengah bawah layar. |
| Progres | Bar linear 4 px, `--caution-strong` di atas `--ink-200`, 6 dtk, tidak mundur. Reduced motion: teks "Sisa N detik" diperbarui per detik. |
| Aksi | Hanya **Batal** (secondary). Tidak ada "lewati". |
| ARIA | `role="status"`, `aria-live="polite"`, diumumkan di awal dan di akhir. |
| Hasil | `neutral` → teks `copy.hold.releasing` 1 dtk lalu form dilanjutkan. `caution`/`danger` → ganti dengan `VerdictBanner mode="gate"`. Waktu habis/gagal → hasil aturan + `copy.mode.rulesOnly`, tanpa galat (DS-11). |

### 6.5 `FieldCallout` (`EXT-02`)

| Aspek | Spesifikasi |
| --- | --- |
| Tujuan | Peringatan singkat tepat di kolom sandi/OTP/PIN saat `focus` pada laman `caution`/`danger`. |
| Teks | `copy.callout.dontFill`. |
| Gaya | Gelembung kecil dengan panah ke kolom, `bg: --${status}-bg`, border `--${status}-border`, teks `--${status}-fg`. Diposisikan dari `getBoundingClientRect()` di dalam overlay, **tidak** menyentuh gaya situs. |
| Frekuensi | Maks. 1 per laman. Tidak muncul lagi setelah ditutup pada sesi itu. Tidak menutupi kolom. |
| ARIA | `role="status"`, `aria-live="polite"`. |

### 6.6 `TransparencyPanel` (`EXT-03.2`, `CORE-11`, `G4`)

```ts
interface TransparencyPanelProps {
  verdict: Verdict;
  surface: 'overlay' | 'popup' | 'web';
  onClose: () => void;
}
```

| Aspek | Spesifikasi |
| --- | --- |
| Tata letak | Overlay desktop (≥ 640 px): panel kanan 400 px, tinggi penuh, `--shadow-3`. Sempit/web mobile: *bottom sheet* 85% tinggi. |
| Urutan isi (tetap) | 1) Judul + `StatusBadge`. 2) Ringkasan (= `reasons`). 3) Daftar langkah L0→L4. 4) Kartu **Batas bawah vonis** bila `floor` ada. 5) Sumber (`source`). 6) Kalimat DS-09. |
| Baris langkah | `TraceStep`. Penanda: titik persegi (`--r-dot`) berwarna `danger-strong` (hard), `caution-strong` (soft), `ink-400` (none), kotak kosong outline (skipped). Label ramah (`copy.trace.L1` dst.) + kode tahap kecil mono. Rincian teknis dalam `<details>` tertutup (sinyal H1/H2/H3, alat, nilai dalam mono). |
| Langkah dilewati | Tetap ditampilkan + `skipReasonKey` (mis. `copy.trace.skippedNoConsent`). |
| Kartu batas bawah | Teks `copy.floor.explain`. Hanya bila `floor` aktif (`CORE-09`, S5). |
| Prompt injection | Bila temuan injeksi ada di L4, tampilkan `copy.trace.injectionIgnored` sebagai temuan `soft`. |
| ARIA/keyboard | `role="dialog"`, `aria-labelledby`. Fokus pindah ke judul saat dibuka, `Esc` menutup, fokus kembali ke pemicu. Tombol tutup berlabel "Tutup rincian". |
| Larangan | Tidak boleh menampilkan nilai yang diketik pengguna, HTML penuh, cookie, atau data pribadi (`AGT-07`). |

### 6.7 `ResultCard` (Web Cek, `WEB-01`)

```ts
interface ResultCardProps {
  verdict: Verdict;
  onCopy: () => void;
  onWhy: () => void;
  notices?: Array<'rulesOnly' | 'spaLimit' | 'budgetLimited'>;
}
```

| Aspek | Spesifikasi |
| --- | --- |
| Tata letak | Kartu `--r-xl`, bar aksen kiri 6 px. Isi tetap: ikon 56 px + judul status → **kalimat aksi** (`copy.action.${status}`) → alasan (1–3 kalimat) → **kanal resmi** bila `claimedBrand` ada → langkah selanjutnya (2–3 butir bernomor) → aksi → penutup DS-09. |
| Kanal resmi | Tampilkan `officialDomains` dan `officialPhones` sebagai **teks mono, bukan tautan aktif**. Domain berbahaya DILARANG dijadikan hyperlink. |
| Salin hasil | Menyalin teks ringkas (status, alasan, kanal resmi). Setelah ditekan: label "Tersalin ✓" 2 dtk, diumumkan lewat `aria-live="polite"`. |
| Notices | `rulesOnly` → label "Pemeriksaan cepat (tanpa AI)". `spaLimit` → `copy.web.spaLimit` di bawah kartu (`WEB-05`). `budgetLimited` → `copy.web.budgetLimited` (`WEB-06`). Nada informatif, bukan galat. |

### 6.8 `PasteBox` (Web Cek)

| Aspek | Spesifikasi |
| --- | --- |
| Struktur | Label tampak di atas, textarea min 140 px, font `--fs-body`, border 2 px `--ink-300`, fokus `--focus`. Di bawahnya **Tempel dari Papan Klip** (secondary, lebar penuh di mobile) dan **Periksa Sekarang** (primary 56 px, lebar penuh di mobile, disabled bila kosong). |
| Papan klip | Memakai Clipboard API. Bila izin ditolak: `copy.web.pasteHelp`. |
| Contoh | Chip contoh (merek fiktif, `NFR-07`) yang mengisi kolom. |
| Privasi | Baris `copy.privacy.noStore` dengan ikon gembok di bawah form. |

### 6.9 `MessageParserList` (`WEB-02`, S4)

| Aspek | Spesifikasi |
| --- | --- |
| Header | `copy.parser.found` dengan jumlah tautan dan nomor. |
| Urutan | Dari paling berbahaya ke teraman-relatif (`danger` → `caution` → `neutral` → `official`). |
| Baris | `StatusBadge` + domain/nomor (mono) + satu kalimat temuan. `.apk` → tambahkan `copy.parser.apkWarning`. |
| Batas | Tampilkan maks. 10 baris, sisanya di "Lihat semua". |
| Sorot | Pada salinan pesan hanya-baca, tautan/nomor diberi garis bawah sesuai warna status. |

### 6.10 `ConsentDialog` (`EXT-06`)

Muncul sekali. Teks dari `copy.consent.*`. Dua tombol **berukuran sama dan sama jelas**: **Izinkan** (primary) dan **Tidak, pakai pemeriksaan dasar saja** (secondary). Menolak DILARANG memunculkan galat atau mengurangi fitur selain L3/L4 (DS-11).

### 6.11 `ToolbarIcon`

Ikon + titik status (DS-62). Tooltip selalu berisi teks: `Phantom: ${label status}`. `caution` hasil L1 saja = titik kuning tanpa banner.

### 6.12 `InstallStepper` (`WEB-07`)

Enam langkah (unduh zip → ekstrak → buka `chrome://extensions` atau `edge://extensions` → aktifkan Mode pengembang → Muat yang belum dipak → sematkan ikon). Tiap langkah: nomor di atas **titik persegi**, satu kalimat, satu tangkapan layar ber-`alt` dengan sorotan pada elemen yang diklik. Sediakan tombol "Salin alamat" untuk `chrome://…` karena tautan itu tidak bisa dibuka dari web.

---

## 7. Peta Keputusan: Status × Momen → Tampilan

Agen WAJIB mengikuti tabel ini saat menentukan apa yang ditampilkan. Sel kosong = tidak ada UI.

| Status | Laman dibuka | Fokus kolom sensitif | Form dikirim | Menunggu L4 (hanya `caution`) | Ikon toolbar |
| --- | --- | --- | --- | --- | --- |
| `official` | — | — | — | — | titik hijau + centang |
| `neutral` | — | — | — | — | titik abu kebiruan |
| `caution` (L1 saja) | — | — | — | — | titik kuning (tanpa banner, `CORE-07`) |
| `caution` (L2+) | Banner info (polite) | FieldCallout | Bila L4 belum selesai: `HoldIndicator` ≤ 6 dtk, lalu Banner gate. Bila selesai: Banner gate | `HoldIndicator` | titik kuning |
| `danger` | Banner info (assertive) | FieldCallout | Banner gate + scrim, form ditahan | — | titik merah |

Aturan tambahan:
- Status dihitung ulang tiap perubahan laman (SPA via `MutationObserver`, `CORE-10`). Bila status berubah, **ganti** banner dengan transisi halus. Jangan menumpuk dua banner.
- `floor` tidak boleh diturunkan oleh UI maupun hasil L4/cache (`CORE-09`). Bila hasil baru lebih rendah dari `floor`, tampilkan status = `floor`.
- Web Cek tidak memakai FieldCallout, HoldIndicator, atau scrim. Hasilnya selalu `ResultCard`.

### 7.1 Peta skenario uji (S1–S6)

| Skenario | Harus tampil |
| --- | --- |
| S1 login merek fiktif `.my.id`, form ke domain lain | Ikon merah → Banner info (assertive) → FieldCallout saat fokus kolom sandi → Banner gate + scrim saat kirim |
| S2 startup sah baru, `/login`, tanpa klaim merek | Tidak ada banner, ikon netral, form tidak ditahan |
| S3 kasus abu-abu | HoldIndicator → hasil L4 → Banner gate atau lanjut; panel menunjukkan langkah L4 dan sumber `agent` |
| S4 lansia menempel pesan WhatsApp | PasteBox (tempel dari papan klip) → MessageParserList → ResultCard dengan kalimat aksi besar dan kanal resmi |
| S5 prompt injection | Status tidak turun di bawah `floor`; panel menampilkan kartu batas bawah dan `trace.injectionIgnored` |
| S6 domain resmi di basis merek | Ikon hijau, tanpa banner; popup: "Situs resmi terverifikasi: {merek}"; L1–L4 tidak ditampilkan |

---

## 8. Katalog Salinan (`copy.id.ts`)

Semua teks UI berasal dari sini. Menambah teks = menambah kunci di sini lebih dulu.

### 8.1 Aturan penulisan

| ID | Aturan |
| --- | --- |
| DS-70 | Bahasa Indonesia sehari-hari, kalimat ≤ 20 kata, bentuk aktif, menyapa "Anda". |
| DS-71 | **Perintah dulu, alasan kemudian.** "Jangan isi PIN di laman ini. Laman ini meniru BCA." |
| DS-72 | Tidak menyalahkan pengguna. Tidak huruf kapital semua kecuali kata status pada judul. Tidak ada emoji bernada menakutkan. |
| DS-73 | Selalu "peringatan", bukan "putusan", "terbukti", atau "pasti penipuan". |
| DS-74 | Pesan kegagalan selalu menyebut **apa yang terjadi + apa yang bisa dilakukan**, tanpa kode atau istilah teknis. |

### 8.2 Kata dilarang di layar pertama → ganti

| Dilarang | Ganti dengan |
| --- | --- |
| aman, terjamin, 100% asli, terbukti menipu | belum ditemukan tanda bahaya, terdaftar sebagai kanal resmi, peringatan |
| phishing | laman tiruan, penipuan |
| domain | alamat situs |
| typosquatting, homoglyph | nama dibuat mirip |
| form action, cross-domain | formulir dikirim ke situs lain |
| kredensial | kata sandi, PIN, kode OTP |
| LLM, agen L4, cache, DOM | pemeriksaan AI (di panel boleh: "agen L4") |

Istilah teknis hanya boleh di dalam `<details>` Rincian teknis atau di label kode tahap (`L1`).

### 8.3 Isi katalog

```ts
export const copy = {
  status: {
    official: { title: 'Situs resmi terverifikasi', short: 'Resmi' },
    neutral:  { title: 'Belum ada tanda bahaya',    short: 'Netral' },
    caution:  { title: 'Hati-hati',                 short: 'Hati-hati' },
    danger:   { title: 'Bahaya',                    short: 'Bahaya' },
  },
  action: {                         // kalimat aksi pertama di ResultCard / popup
    official: 'Alamat ini terdaftar sebagai kanal resmi {brand}.',
    neutral:  'Tetap waspada. Phantom tidak bisa menjamin sebuah situs bebas penipuan.',
    caution:  'Periksa dulu sebelum mengisi data penting.',
    danger:   'Jangan isi atau kirim data di laman ini.',
  },
  gate: {
    held: 'Pengiriman ditahan',
    cancel: 'Batal Kirim',
    continue: 'Tetap Kirim',
    confirmContinue: 'Yakin? Ketuk lagi untuk kirim',
    notSent: 'Data yang Anda ketik belum terkirim.',
    why: 'Kenapa?',
    understood: 'Mengerti',
    closeAlert: 'Tutup peringatan',
  },
  hold: {
    verifying: 'Phantom sedang memverifikasi keamanan laman (maks. 6 dtk)…',
    releasing: 'Belum ditemukan tanda bahaya. Mengirim formulir…',
    cancel: 'Batal',
    remaining: 'Sisa {n} detik',
  },
  callout: { dontFill: 'Jangan isi kolom ini di laman ini. Lihat peringatan di atas.' },
  privacy: {
    noRead: 'Phantom tidak membaca apa yang Anda ketik.',
    noStore: 'Phantom tidak menyimpan pesan Anda.',
  },
  panel: {
    title: 'Mengapa Phantom menilai begini',
    summary: 'Ringkasan',
    steps: 'Langkah pemeriksaan',
    technical: 'Rincian teknis',
    source: { rules: 'Aturan', cache: 'Cache', agent: 'Agen AI' },
    close: 'Tutup rincian',
    disclaimer: 'Ini peringatan, bukan putusan hukum.',
  },
  trace: {
    L0: 'Daftar kanal resmi',
    L1: 'Alamat situs',
    L2: 'Isi halaman',
    L3: 'Umur situs',
    L4: 'Investigasi AI',
    skippedNoConsent: 'Dilewati, izin pemeriksaan lanjutan belum diberikan.',
    injectionIgnored: 'Laman ini berisi tulisan yang mencoba memengaruhi penilaian AI. Diabaikan.',
  },
  floor: {
    title: 'Batas bawah vonis: {status}',
    explain: 'Bukti keras dari pemeriksaan isi halaman tidak bisa diturunkan oleh AI.',
  },
  mode: { rulesOnly: 'Pemeriksaan cepat (tanpa AI)', noConsent: 'Pemeriksaan lanjutan belum diaktifkan. Hasil memakai pemeriksaan dasar.' },
  consent: {
    title: 'Boleh Phantom memeriksa lebih dalam?',
    body: 'Untuk laman yang meragukan, Phantom bisa meminta bantuan AI dan mengecek umur situs lewat internet.',
    sent: 'Yang dikirim: alamat situs dan struktur formulir.',
    neverSent: 'Tidak pernah dikirim: apa yang Anda ketik, cookie, atau data pribadi.',
    allow: 'Izinkan',
    deny: 'Tidak, pakai pemeriksaan dasar saja',
  },
  popup: {
    officialOf: 'Situs ini terdaftar sebagai kanal resmi {brand}.',
    viewDetail: 'Lihat detail analisis',
    trustSite: 'Percayai situs ini',
    trustHelp: 'Peringatan untuk situs ini tidak akan ditampilkan lagi di perangkat ini.',
    openWeb: 'Buka Web Cek',
    toggleDeep: 'Izinkan pemeriksaan lanjutan lewat internet (AI dan umur situs)',
  },
  web: {
    headline: 'Dapat tautan atau pesan yang mencurigakan? Cek dulu sebelum diklik',
    label: 'Tempel tautan atau seluruh pesan WhatsApp/SMS di sini',
    paste: 'Tempel dari Papan Klip',
    pasteHelp: 'Tekan lama di kolom, lalu pilih Tempel.',
    check: 'Periksa Sekarang',
    checking: 'Memeriksa…',
    steps: ['Mengecek alamat situs', 'Mengecek isi laman', 'Menanyakan ke AI (bila perlu)'],
    slow: 'Sedikit lebih lama dari biasanya…',
    copyResult: 'Salin hasil',
    copied: 'Tersalin ✓',
    officialChannels: 'Kanal resmi {brand}',
    nextSteps: 'Apa yang sebaiknya Anda lakukan?',
    spaLimit: 'Untuk laman yang dibangun dengan JavaScript penuh, hasil paling lengkap diperoleh lewat ekstensi Phantom di komputer.',
    budgetLimited: 'Pemeriksaan AI sedang dibatasi hari ini. Anda tetap mendapat hasil pemeriksaan dasar.',
    empty: 'Tempel dulu tautan atau pesan yang ingin diperiksa.',
    invalidUrl: 'Ini belum terlihat seperti tautan. Coba tempel seluruh tautan, mulai dari "http".',
    blockedTarget: 'Alamat ini tidak bisa diperiksa dari Web Cek karena alasan keamanan.',
    offline: 'Anda sedang offline. Sambungkan internet lalu coba lagi.',
  },
  parser: {
    found: 'Ditemukan {links} tautan dan {phones} nomor telepon',
    apkWarning: 'Jangan pasang file ini. Undangan sungguhan tidak perlu aplikasi tambahan.',
    phoneUnknown: 'Tidak ada di daftar kanal resmi',
    showAll: 'Lihat semua',
  },
} as const;
```

Langkah selanjutnya di `ResultCard` (2–3 butir) per status:

| Status | Langkah |
| --- | --- |
| `danger` | 1. Jangan klik dan jangan unduh. 2. Jangan beri PIN, OTP, atau kata sandi. 3. Buka situs resmi: {kanal resmi} |
| `caution` | 1. Jangan isi data penting dulu. 2. Buka situs lewat alamat resmi: {kanal resmi}. 3. Tanyakan ke pengirim lewat kanal lain bila ragu. |
| `neutral` | 1. Periksa kembali alamat sebelum mengisi data. 2. Jangan beri PIN atau OTP kecuali Anda yakin. |
| `official` | (tidak ada langkah tambahan) |

---

## 9. Aksesibilitas (WCAG 2.2 AA, wajib)

| ID | Aturan |
| --- | --- |
| DS-80 | Kontras teks ≥ 4,5:1 dan elemen UI ≥ 3:1. Pakai hanya pasangan di 3.4. |
| DS-81 | Semua fungsi dapat dioperasikan keyboard; fokus selalu terlihat (cincin 3 px `--focus`); tidak ada jebakan fokus kecuali dialog modal (dengan `Esc`). |
| DS-82 | Target sentuh ≥ `--hit-min` (44/48 px), jarak antar target ≥ 8 px. |
| DS-83 | Layout utuh pada zoom 200%, tanpa gulir horizontal (kecuali blok mono). |
| DS-84 | `lang="id"` di semua dokumen. Tombol ikon berlabel. Domain dibacakan dengan label "alamat situs {host}". |
| DS-85 | Mendukung mode terang, gelap, dan `forced-colors`. Border tidak boleh dihilangkan pada `forced-colors`. |
| DS-86 | Tidak ada konten bermakna hanya lewat gambar. Tangkapan layar punya `alt` deskriptif. |

---

## 10. Daftar Periksa Sebelum Menyatakan Selesai

Jawab ya/tidak untuk setiap butir dan perbaiki yang "tidak".

**Konsistensi gaya (web dan ekstensi)**
- [ ] Tidak ada hex/rgb/px mentah di komponen; semua lewat `var(--…)` (DS-40).
- [ ] Komponen berasal dari `packages/ui`, bukan salinan lokal (DS-21).
- [ ] Teks UI berasal dari `copy.id.ts` (DS-24).
- [ ] Overlay dan Web Cek menampilkan komponen yang sama untuk status yang sama.
- [ ] Hanya status yang memakai warna kromatik (DS-30); logo tidak diwarnai (DS-31).

**UX**
- [ ] Layar pertama = satu keputusan; alasan ≤ 2 kalimat; bebas istilah teknis (8.2).
- [ ] Batal Kirim paling menonjol dan terfokus awal; Tetap Kirim tenang; di Bahaya butuh dua ketukan (DS-03, DS-04).
- [ ] Netral/Resmi tanpa banner; L1-saja = ikon kuning tanpa banner (DS-07).
- [ ] Penantian ≤ 6 dtk punya HoldIndicator dengan teks PRD dan tombol Batal.
- [ ] Kegagalan LLM/jaringan tidak memunculkan galat (DS-11).
- [ ] Transparency Panel memuat L0–L4 (termasuk langkah dilewati), kartu batas bawah bila ada `floor`, dan kalimat DS-09.
- [ ] Status selalu warna + ikon berbentuk + kata (DS-02); tidak ada kata "aman" sebagai vonis (DS-01).

**Keselamatan dan privasi**
- [ ] Tidak ada pembacaan nilai input situs (DS-05) dan tidak ada permintaan jaringan dari UI (DS-08).
- [ ] Tidak ada tombol lapor, tidak ada pemblokiran keras (DS-06).
- [ ] Domain berbahaya tidak dijadikan hyperlink.

**Aksesibilitas**
- [ ] Peran ARIA sesuai 6.3; urutan Tab dan `Esc` sesuai kontrak.
- [ ] Reduced motion dan mode gelap sudah diuji.

---

## 11. Pemeriksaan Otomatis (jalankan sebelum commit)

Tambahkan sebagai skrip `npm run ds:check`. Tiap pemeriksaan harus **gagal** bila ada temuan.

```bash
# 1. Warna hex mentah di luar tokens.css (DS-40)
grep -RInE '#[0-9a-fA-F]{3,8}\b' packages/ui apps --include=*.tsx --include=*.ts --include=*.css \
  --exclude=tokens.css --exclude-dir=node_modules | grep -v 'icons/'

# 2. Kata terlarang di teks UI (DS-01, 8.2)
grep -RInEi '\b(aman|terjamin|100% asli|terbukti menipu)\b' packages/ui/copy.id.ts apps --include=*.tsx

# 3. Sumber daya jarak jauh (DS-08)
grep -RInE 'fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg|jsdelivr|https?://[^"'"'"' )]+\.(woff2?|css|js)' packages apps --include=*.tsx --include=*.ts --include=*.css --include=*.html

# 4. Bentuk status tunggal (DS-60): ikon status hanya dari packages/ui/icons/status-*.svg
# 5. Pembacaan nilai input situs (DS-05): tidak boleh ada .value dari elemen situs di packages/ui atau overlay
grep -RInE "(querySelector|getElementById)\([^)]*\)\.value|event\.target\.value" apps/extension --include=*.ts --include=*.tsx
```

Uji unit yang disarankan:
- `statusUi` memetakan 4 status ke ikon, `live`, `scrim`, `banner` sesuai bagian 7 (tabel keputusan).
- Pada `VerdictBanner mode="gate" status="danger"`: fokus awal pada Batal Kirim; Tetap Kirim butuh dua klik; `Esc` memanggil `onCancelSubmit`.
- Verdict dengan `floor='danger'` tidak pernah dirender sebagai status di bawah `danger`.
- Render `ResultCard` dengan domain berbahaya: tidak ada elemen `<a href>` ke domain itu.
- Uji kontras otomatis atas pasangan di 3.4 (mis. lewat `culori`/`wcag-contrast`).

---

## 12. Mengubah atau Memperluas Sistem

| ID | Aturan |
| --- | --- |
| DS-90 | Butuh komponen baru? Cek bagian 6 dulu. Bila benar-benar baru, buat di `packages/ui/components`, tulis kontrak (props, keadaan, ARIA, perilaku) di dokumen ini, lalu pakai di kedua platform. |
| DS-91 | Butuh warna baru? **Tidak diizinkan** (DS-30). Gunakan token yang ada. Warna status baru memerlukan perubahan PRD (status terkunci). |
| DS-92 | Butuh teks baru? Tambahkan ke `copy.id.ts` (dan patuhi 8.1, 8.2) lebih dulu. |
| DS-93 | Menyimpang dari aturan **SEBAIKNYA**? Tulis alasan di komentar PR. Menyimpang dari aturan 🔒 tidak diizinkan. |
| DS-94 | Setiap perubahan token dilakukan di `tokens.css` lebih dulu, kemudian dicek kontrasnya (3.4), baru dipakai. |
| DS-95 | Bila PRD berubah (status, aturan vonis, batas waktu), perbarui bagian 1.2, 6, dan 7 dalam PR yang sama. |

---

## 13. Pola Anti (contoh yang salah)

| Salah | Benar |
| --- | --- |
| `style={{ background:'#C0261B' }}` | `background: var(--danger-strong)` |
| Banner merah menyala memenuhi layar dengan teks kapital dan tanda seru | Banner `--r-lg`, bar aksen 6 px, judul "BAHAYA", 2 kalimat tenang |
| Status Bahaya hanya titik merah tanpa kata | `StatusBadge` ikon segi delapan + kata "Bahaya" |
| Tombol "Tetap Kirim" besar berwarna, "Batal" teks kecil | Batal Kirim `status` 48 px terfokus; Tetap Kirim `secondary` 44 px |
| Hasil Netral ditulis "Situs ini aman" | "Belum ada tanda bahaya. Tetap waspada." |
| Banner muncul di situs sah tanpa bukti (L1 saja) | Hanya ikon kuning, tanpa banner |
| Panel teknis langsung terbuka di layar pertama | Layar pertama ringkas; teknis di balik **Kenapa?** dan `<details>` |
| Pesan galat "Error 503 Gemini" ke pengguna | Hasil mode aturan + label "Pemeriksaan cepat (tanpa AI)" |
| Domain berbahaya jadi tautan klik | Teks mono tanpa `<a>`, dengan bagian janggal digarisbawahi |
| Google Fonts / CDN ikon | Font dan SVG lokal |
| Mengubah warna logo sesuai status | Logo tetap netral; status lewat badge terpisah |
| Membuat halaman Web Cek dengan palet atau radius berbeda dari ekstensi | Impor `tokens.css` yang sama; hanya skala teks/sentuh yang berbeda via `[data-surface="web"]` |

---

## 14. Preamble Singkat untuk Prompt Agen

Tempel di awal tugas UI bila agen belum membaca dokumen ini:

```
Kamu mengerjakan UI Phantom. Ikuti Design.md (v2) tanpa menyimpang dari aturan bertanda 🔒.
- Pakai komponen dari packages/ui dan token di tokens.css; jangan tulis hex/px/ms mentah.
- Teks UI hanya dari copy.id.ts; bahasa Indonesia sederhana; jangan pernah menyebut "aman" sebagai vonis.
- Status = warna + ikon berbentuk + kata. Hanya 4 status: official, neutral, caution, danger.
- Netral/Resmi tanpa banner. Gerbang: Batal Kirim paling menonjol & terfokus; Tetap Kirim tenang, 2 ketukan di Bahaya.
- Overlay di Shadow DOM, tanpa CDN/telemetri, tidak membaca nilai input situs.
- Ekstensi dan Web Cek memakai komponen yang sama; beda hanya skala teks/sentuh.
- Sebelum selesai: jalankan bagian 10 (daftar periksa) dan bagian 11 (ds:check).
```

---

*Sumber kebenaran: `tokens.css` (gaya), `copy.id.ts` (teks), bagian 6 (perilaku komponen), bagian 7 (kapan apa tampil). Narasi dan alasan desain ada di `Design.referensi-manusia.md`.*
