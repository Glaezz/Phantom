# 🛡️ Phantom (Penjaga Laman)

> **Verifikasi Kanal Resmi dan Mitigasi Phishing Proaktif Berbasis Agentic AI**  
> *Hackathon INCEPTION 2026 — Subtema 5: Smart Public Services and Digital Trust*

Phantom adalah sistem verifikasi kanal resmi cerdas yang secara aktif memeriksa keaslian sebuah laman web **sebelum** pengguna menyerahkan data sensitif (sandi, OTP, atau PIN). Mengusung pendekatan hibrida *privacy-first* dengan arsitektur verifikasi berjenjang L0–L4, Phantom memastikan penipuan dihentikan sebelum data meninggalkan peramban.

---

## 📸 Fitur Utama

1. **Ekstensi Desktop Proaktif (Chrome & Edge MV3):**
   - **3-Point Pre-Execution Warning:** Peringatan proaktif saat halaman dimuat, saat kursor menyentuh kolom sensitif, dan penahanan aksi (*soft gate*) saat formulir dikirim.
   - **Progressive Disclosure UI (Explainable AI):** Banner interaktif 1-kalimat untuk pengguna awam, dilengkapi *Transparency Panel* yang dapat dibuka untuk melihat jejak investigasi AI (L0–L4).
   - **Shadow DOM Isolation:** Tampilan UI ekstensi terisolasi total tanpa merusak CSS/layout web yang sedang dibuka.
2. **Web Cek (PWA / Web App):**
   - **Message Parser:** Ekstraksi otomatis tautan dan nomor CS dari salinan pesan teks utuh (WhatsApp/SMS).
   - **Fitur Unduh Ekstensi:** Unduhan paket `.zip` beserta panduan visual pasang ekstensi (*Load unpacked*).
3. **100% Deterministic Score Floor:** Mencegah manipulasi AI (*prompt injection*) dari menurunkan tingkat risiko yang sudah terbukti oleh bukti keras DOM (L2).

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
git clone https://github.com/username/phantom-monorepo.git
cd phantom-monorepo
```

### 2. Atur Konfigurasi npm (Penting)

Untuk mengabaikan potensi konflik *peer dependencies* pada pustaka pendukung Vite/TypeScript, atur flag berikut:

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

Cukup jalankan satu perintah ini di folder utama (*root*) untuk meng-install seluruh dependencies aplikasi dan menghubungkan paket internal `@phantom/core`:

```bash
npm install
```

---

## 💻 Menjalankan Server Pengembangan (Development)

Kamu dapat menjalankan tiap aplikasi secara terpisah dari folder *root*:

* **Menjalankan Ekstensi (Watch Mode):**
  ```bash
  npm run dev:ext
  ```
* **Menjalankan Web Cek (PWA App):**
  ```bash
  npm run dev:web
  ```
* **Menjalankan Backend Proxy (Serverless API Lokal):**
  ```bash
  npm run dev:proxy
  ```

---

## 🧪 Menguji Mesin Inti (@phantom/core)

Untuk memastikan logika L0–L2, pencocokan Public Suffix List (PSL), dan *brands.json* berjalan akurat:

```bash
npm run test --workspace=packages/core
```

---

## 📦 Kompilasi & Pengujian di Peramban (Production Build)

### 1. Build Seluruh Proyek

```bash
npm run build
```

### 2. Memasang Ekstensi ke Google Chrome / Edge (*Load Unpacked*)

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

## 📄 Deklarasi AI & Pihak Ketiga

- **Model AI Utama:** Google Gemini 3.1 Flash Lite via Google AI Studio API (Function Calling & Structured JSON Mode).
- **Model AI Cadangan:** Groq Cloud `qwen/qwen3-32b`.
- **Dataset Domain Publik:** Public Suffix List (`publicsuffix.org`).
- **Basis Data Merek:** Dikurasi mandiri sebanyak 54 entri resmi terverifikasi entitas perbankan, e-wallet, kurir, e-commerce, dan instansi publik Indonesia.

---

## 📜 Lisensi

Proyek ini dibuat untuk keikutsertaan dalam **Hackathon INCEPTION 2026**. Hak cipta dilindungi undang-undang.