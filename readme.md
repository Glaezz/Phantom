# 🛡️ Phantom

> **Verifikasi Kanal Resmi dan Mitigasi Phishing Proaktif Berbasis Agentic AI**  
> _Hackathon INCEPTION 2026 — Subtema 5: Smart Public Services and Digital Trust_

Phantom adalah sistem verifikasi kanal resmi cerdas yang secara aktif memeriksa keaslian sebuah laman web **sebelum** pengguna menyerahkan data sensitif (sandi, OTP, atau PIN). Mengusung pendekatan hibrida _privacy-first_ dengan arsitektur verifikasi berjenjang L0–L4, Phantom memastikan penipuan dihentikan sebelum data meninggalkan peramban.

---

## 📸 Fitur Utama

1. **Ekstensi Desktop Proaktif (Chrome & Edge MV3):**
   - **3-Point Pre-Execution Warning:** Peringatan proaktif saat halaman dimuat, saat kursor menyentuh kolom sensitif, dan penahanan aksi (_soft gate_) saat formulir dikirim.
   - **Progressive Disclosure UI (Explainable AI):** Banner interaktif 1-kalimat untuk pengguna awam, dilengkapi _Transparency Panel_ yang dapat dibuka untuk melihat jejak investigasi AI (L0–L4).
   - **Shadow DOM Isolation:** Tampilan UI ekstensi terisolasi total tanpa merusak CSS/layout web yang sedang dibuka.
2. **Web Cek (PWA / Web App):**
   - **Message Parser:** Ekstraksi otomatis tautan dan nomor CS dari salinan pesan teks utuh (WhatsApp/SMS).
   - **Fitur Unduh Ekstensi:** Unduhan paket `.zip` beserta panduan visual pasang ekstensi (_Load unpacked_).
3. **100% Deterministic Score Floor:** Mencegah manipulasi AI (_prompt injection_) dari menurunkan tingkat risiko yang sudah terbukti oleh bukti keras DOM (L2).

---

## 📂 Struktur Monorepo

```text
phantom-monorepo/
├── packages/
│   └── core/            # Library shared (@phantom/core) berisi L0-L2 & brands.json
└── apps/
    ├── extension/       # Ekstensi Chrome/Edge MV3 (Vite + React + Tailwind + Shadow DOM)
    ├── web-cek/         # PWA Web Cek (Vite + React + Message Parser)
    └── proxy/           # Cloudflare Worker / Serverless API (/analyze L3-L4 Gemini Agent)
```

---

## 🚀 Persyaratan Sistem (Prerequisites)

Sebelum memulai, pastikan perangkat kamu telah terpasang:

- **Node.js**: v18.0.0 atau lebih baru (Disarankan LTS v20+)
- **npm**: v9.0.0 atau lebih baru (Menggunakan fitur bawaan **npm Workspaces**)
- **Peramban**: Google Chrome atau Microsoft Edge (untuk pengujian ekstensi)

---

## 🛠️ Panduan Instalasi Langkah Demi Langkah

### 1. Clone Repositori

```bash
git clone https://github.com/glaezz/phantom.git
cd phantom
```

### 2. Atur Konfigurasi npm (Penting)

Untuk mengabaikan potensi konflik _peer dependencies_ pada pustaka pendukung Vite/TypeScript, atur flag berikut:

```bash
npm config set legacy-peer-deps true
```

### 3. Konfigurasi Variable Lingkungan (.env)

Salin template file `.env.example` ke `.env` pada aplikasi yang membutuhkan kunci API:

#### A. Backend Proxy (`apps/proxy`)

Buat file `apps/proxy/.env`:

```env
GEMINI_API_KEY=AIzaSy_Kunci_API_Gemini_Kamu_Di_Sini
GROQ_API_KEY=gsk_Kunci_API_Groq_Kamu_Di_Sini
ENVIRONMENT=development
```

#### B. Ekstensi (`apps/extension`) & Web Cek (`apps/web-cek`)

Buat file `apps/extension/.env` dan `apps/web-cek/.env`:

```env
VITE_PROXY_API_URL=http://localhost:8787
```

### 4. Install Seluruh Dependencies

Cukup jalankan satu perintah ini di folder utama (_root_) untuk meng-install seluruh dependencies aplikasi dan menghubungkan paket internal `@phantom/core`:

```bash
npm install
```

---

## 💻 Menjalankan Server Pengembangan (Development)

Kamu dapat menjalankan tiap aplikasi secara terpisah dari folder _root_:

- **Menjalankan Ekstensi (Watch Mode):**
  ```bash
  npm run dev:ext
  ```
- **Menjalankan Web Cek (PWA App):**
  ```bash
  npm run dev:web
  ```
- **Menjalankan Backend Proxy (Serverless API Lokal):**
  ```bash
  npm run dev:proxy
  ```

---

## 🧪 Menguji Mesin Inti (@phantom/core)

Untuk memastikan logika L0–L2, pencocokan Public Suffix List (PSL), dan _brands.json_ berjalan akurat:

```bash
npm run test --workspace=packages/core
```

---

## 📦 Kompilasi & Pengujian di Peramban (Production Build)

### 1. Build Seluruh Proyek

```bash
npm run build
```

### 2. Memasang Ekstensi ke Google Chrome / Edge (_Load Unpacked_)

1. Buka peramban Chrome/Edge dan ketik `chrome://extensions` di bilah alamat.
2. Aktifkan sakelar **Developer mode** (Mode Pengembang) di pojok kanan atas.
3. Klik tombol **Load unpacked** (Muat yang dibuka rincinya).
4. Pilih folder hasil kompilasi ekstensi: `phantom-monorepo/apps/extension/dist`.
5. Ekstensi **Phantom** siap digunakan secara proaktif!

---

## 🌐 Panduan Deployment (100% Free Tier)

1. **Web Cek PWA (Vercel / Cloudflare Pages):**
   - Sambungkan repositori GitHub ke **Vercel**.
   - Atur Root Directory ke `apps/web-cek`.
   - Build command: `npm run build`, Output directory: `dist`.
2. **Backend Proxy (Cloudflare Workers):**
   - Buka folder `apps/proxy`.
   - Jalankan `npx wrangler deploy`.
   - Tambahkan Secret Key di dashboard Cloudflare: `npx wrangler secret put GEMINI_API_KEY`.

---

## 👥 Tim & Kontribusi

| Anggota                        | Kontribusi utama                                                      |
| ------------------------------ | --------------------------------------------------------------------- |
| Fieza Rausyan Al Ghifari       | Core engine dan proxy: aturan L0–L2, scoring, agent L3–L4, deployment |
| Radityarma Naufal Fazani       | Web Cek: UI/UX, message parser, halaman unduh, integrasi API          |
| Reyvan Andycka Farrel Alinskie | Ekstensi: MV3, content script, overlay, alur peringatan               |

---

## 🤖 AI Use Declaration

### AI dalam produk

- **Model utama:** Google Gemini 3.5 Flash Lite via Google AI Studio API.
- **Fallback:** Gemini 3.1 Flash Lite, lalu Groq Cloud `qwen/qwen3.8-27b`.
- **Peran AI:** investigasi agentic setelah aturan deterministik L0–L2 menemukan indikasi risiko dan pengguna menyetujui analisis cloud.
- **Data yang dikirim:** URL/domain, fitur halaman, label formulir, dan hasil tool agent.
- **Data yang tidak dikirim:** HTML mentah, teks halaman penuh, nilai input, sandi, OTP, atau PIN.
- **Fallback:** bila LLM gagal, sistem kembali ke mode aturan (`rules-only`).
- **Pengaman:** deterministic score floor, validasi keluaran dengan Zod, `evidenceRefs`, dan proteksi prompt injection.
- **Cache:** hasil analisis disimpan di Cloudflare KV, bukan isi halaman.
- **Catatan free tier:** data yang dikirim ke Google/Groq tunduk pada kebijakan penyedia masing-masing.

### AI dalam pengembangan

- **OpenCode** digunakan sebagai AI coding assistant untuk eksplorasi kode, implementasi, debugging, dan review.
- Seluruh keluaran AI ditinjau, diuji, dan dipertanggungjawabkan oleh tim.

---

## 📦 Third-Party Declaration

| Kategori   | Komponen                                                    | Lisensi/Fungsi             |
| ---------- | ----------------------------------------------------------- | -------------------------- |
| Runtime    | Hono, Zod, tldts                                            | MIT                        |
| Frontend   | React, React DOM, React Router                              | MIT                        |
| UI/aset    | Lucide React                                                | ISC                        |
| Font       | Inter, JetBrains Mono via Fontsource                        | OFL-1.1                    |
| Build/test | Vite, WXT, Vitest, ESLint                                   | MIT                        |
| Bahasa     | TypeScript                                                  | Apache-2.0                 |
| Deploy     | Wrangler                                                    | MIT OR Apache-2.0          |
| Layanan    | Cloudflare Workers/KV, Vercel, Google AI Studio, Groq Cloud | Layanan pihak ketiga       |
| Data       | Public Suffix List, `brands.json` 61 entri                  | MPL-2.0 dan kurasi mandiri |

---

## 📜 Lisensi

Proyek ini dibuat untuk keikutsertaan dalam **Hackathon INCEPTION 2026**. Hak cipta dilindungi undang-undang.
