# Spesifikasi `@phantom/core`

Spesifikasi teknis paket `packages/core` (hanya paket ini). Dokumen ini turunan dari PRD MVP Phantom v1.4 (CORE, ARC, BRD, CCH, AGT-05) dan ditulis agar dapat dikerjakan oleh agen pengembang tanpa menebak. Aplikasi lain (`extension`, `web-cek`, `proxy`) dikerjakan bertahap setelah paket ini lolos tes.

Versi: 0.2, 1 November 2026.

## 1. Ruang Lingkup

### 1.1 Termasuk (Fase 1)

1. Skema dan tipe (Zod): `Brand`, `PageFeatures`, `AnalysisResult`, `AgentVerdict`.
2. Pemuatan dan validasi basis merek (`brands.json`).
3. Penguraian URL dan domain terdaftar (PSL), termasuk punycode.
4. L0: pencocokan domain resmi.
5. L1: sinyal struktur URL tanpa jaringan.
6. Deteksi klaim merek dari teks laman.
7. L2: sinyal dari `PageFeatures` (kolom kredensial, tujuan form, aset luar).
8. Penilaian (scoring), lantai skor, dan penentuan `needsAgent`.
9. Penyusun alasan berbahasa Indonesia dan jejak langkah (trace).
10. Kunci cache (normalisasi URL dan hash SHA-256).
11. `mergeVerdict`: penggabungan lantai aturan dengan vonis agen (AGT-05).
12. Antarmuka (hanya tipe) untuk efek samping: `LlmProvider`, `CacheStore`, `PageFetcher`, `DomainAgeLookup`.

### 1.2 Ditunda (bukan bagian spesifikasi ini)

- Loop agen dan implementasi alat agen (`brand_lookup`, `get_form_target`, dan sebagainya).
- Implementasi penyedia LLM (Gemini, Groq), `CacheStore` (KV), `PageFetcher`, RDAP.
- Adapter ekstraksi `PageFeatures` (dari DOM di ekstensi, dari HTML statis di backend).
- Parser pesan (ekstraksi URL dan nomor telepon dari teks).
- Segala UI.

## 2. Batasan (dari PRD ARC-01 sampai ARC-08)

- **Runtime-agnostic.** Kode berjalan di Node (Vitest), peramban (service worker MV3, halaman web), dan Cloudflare Workers. Dilarang: impor `node:*`, `fs`, `path`, `crypto` Node, `Buffer`, `process`, `window`, `document`, `chrome`, `browser`. Diizinkan: `URL`, `TextEncoder`, `crypto.subtle`, `fetch` (tidak dipakai di Fase 1).
- **Tanpa DOM.** Masukan laman berupa `PageFeatures` (JSON murni).
- **Fungsi murni dan deterministik.** Masukan sama menghasilkan keluaran sama. Satu-satunya fungsi `async` adalah `cacheKey` (karena `crypto.subtle`).
- **Tanpa jaringan.** Tidak ada `fetch` di Fase 1.
- **Dependensi runtime hanya dua:** `tldts` dan `zod`. Tambahan apa pun harus diuji dapat dibundel untuk Workers dan MV3, dan dicatat di dokumen ini.
- **Tanpa `any`.** Tipe diturunkan dari skema Zod (`z.infer`).
- **Parameter yang dapat disetel** (daftar, ambang) ada di `config.ts`, bukan tersebar di kode.

## 3. Struktur Berkas

```
packages/core/
├── package.json            # "test": "vitest run", "typecheck": "tsc --noEmit", "sideEffects": false
├── tsconfig.json
├── vitest.config.ts        # environment: "node"
└── src/
    ├── index.ts            # ekspor publik (lihat bagian 4)
    ├── schemas.ts          # Zod: Brand, PageFeatures, AnalysisResult, AgentVerdict, SignalId, dst.
    ├── config.ts           # konstanta dan daftar yang dapat disetel
    ├── interfaces.ts       # LlmProvider, CacheStore, PageFetcher, DomainAgeLookup (tipe saja)
    ├── punycode.ts         # decoder punycode kecil (RFC 3492), tanpa dependensi
    ├── text.ts             # normalizeText, tokenize, splitSegments
    ├── confusables.ts      # peta homoglyph dan fungsi skeleton
    ├── similarity.ts       # damerauLevenshtein
    ├── url.ts              # parseUrl
    ├── brands.ts           # loadBrands, validateBrandDb, buildBrandIndex
    ├── l0.ts               # matchOfficial
    ├── l1.ts               # analyzeUrlSignals
    ├── claims.ts           # detectBrandClaims
    ├── l2.ts               # analyzePageSignals, isCredentialField, resolveFormTarget
    ├── scoring.ts          # scoreSignals
    ├── reasons.ts          # buildReasons, templat alasan
    ├── cache-key.ts        # normalizeUrlForCache, cacheKey
    ├── verdict.ts          # mergeVerdict
    ├── engine.ts           # createEngine, analyze
    ├── data/brands.json
    └── __tests__/          # *.test.ts dan fixtures/
```

## 4. API Publik (`index.ts`)

```ts
// Tipe (dari schemas.ts)
export type Brand, PageFeatures, FormFeature, FieldFeature, SignalId, SignalHit,
  TraceStep, Status, AnalysisResult, AgentVerdict;

// Skema
export { BrandSchema, PageFeaturesSchema, AnalysisResultSchema, AgentVerdictSchema };

// Basis merek
export const BRANDS: Brand[];
export function loadBrands(raw: unknown): Brand[];            // validasi Zod, throw bila tidak valid
export function validateBrandDb(brands: Brand[]): string[];   // daftar masalah (kosong = sehat)

// Mesin
export function createEngine(brands: Brand[], config?: Partial<Config>): Engine;
export const engine: Engine;                                   // createEngine(BRANDS)
export function analyze(input: AnalyzeInput): AnalysisResult;  // engine.analyze

// Cache
export function normalizeUrlForCache(url: string): string;
export function cacheKey(url: string): Promise<string>;

// Agen (hanya penggabungan)
export function mergeVerdict(rule: AnalysisResult, agent: AgentVerdict | null): MergedVerdict;

// Antarmuka efek samping (tipe saja)
export type { LlmProvider, CacheStore, PageFetcher, DomainAgeLookup };
```

```ts
interface Engine {
  analyze(input: AnalyzeInput): AnalysisResult;
  matchOfficial(url: string): OfficialMatch;       // L0 saja
}

interface AnalyzeInput {
  url: string;                                     // URL halaman (http/https)
  features?: PageFeatures;                         // tidak ada = berhenti di L1
  context?: { domainAgeDays?: number | null };     // hasil L3, opsional
}
```

Fungsi pembantu (`parseUrl`, `isCredentialField`, `resolveFormTarget`, `detectBrandClaims`, `damerauLevenshtein`, `skeleton`) diekspor dari modulnya masing-masing untuk pengujian, dan tidak wajib diekspor dari `index.ts`.

## 5. Skema Data

### 5.1 `Brand` (BRD-01, BRD-04 sampai BRD-08)

```ts
Brand = {
  id: string,                    // slug unik, huruf kecil/angka/underscore
  name: string,
  category: string,              // banking, ewallet, ecommerce, courier, government, telecom, paylater_crypto, oauth_payment
  officialDomains: string[],     // domain terdaftar; seluruh subdomain dianggap resmi
  exactHosts: string[],          // default []; hanya host persis ini yang dianggap resmi
  sharedContentPaths?: string[], // mis. ['/forms/', '/site/']; halaman pengguna di domain resmi
  officialPhones: string[],      // default []
  keywords: string[],            // huruf kecil; nama yang dipakai untuk klaim dan token host
  ambiguousToken: boolean,
  sources: string[],             // URL situs resmi, minimal 1
  verifiedAt: string,            // YYYY-MM-DD
  verifiedBy: string,
  demo: boolean
}
```

`brands.json` menambah bidang `exactHosts` (nilai awal `[]`) dan `sharedContentPaths` opsional. Entri `google_oauth` memakai `officialDomains: ['google.com', 'google.co.id']`, `exactHosts: ['accounts.google.com']`, dan `sharedContentPaths: ['/forms/', '/site/', '/view/']` sehingga Google Forms/Sites bukan halaman resmi, sedangkan Google Search, Gemini, dan Accounts tetap resmi.

### 5.2 `PageFeatures`

```ts
PageFeatures = {
  url: string,                          // URL halaman tanpa fragment
  title: string,                        // maks 200 karakter
  headings: string[],                   // teks h1; maks 5 item, tiap item maks 200 karakter
  siteName: string | null,              // og:site_name
  formLabels?: string[],                // label/legend/[role=heading]/aria-label; maks 30, bukan nilai input
  forms: FormFeature[],                 // maks 10
  externalResources: { kind: 'script' | 'img' | 'link' | 'iframe', url: string }[]  // maks 50
}

FormFeature = {
  action: string | null,                // atribut action apa adanya (boleh relatif); null/kosong = halaman ini
  method: 'get' | 'post',
  fields: FieldFeature[]                // maks 30
}

FieldFeature = {
  type: string,                         // atribut type (huruf kecil)
  name: string | null,
  id: string | null,
  autocomplete: string | null,
  placeholder: string | null
}
```

Kontrak untuk adapter (di luar paket ini): kolom kredensial di luar `<form>` dimasukkan ke form semu dengan `action: null`. Nilai yang diketik pengguna tidak pernah menjadi bagian skema.

### 5.3 `AnalysisResult`

```ts
Status = 'official' | 'neutral' | 'caution' | 'danger'

AnalysisResult = {
  status: Status,
  floor: 'neutral' | 'caution' | 'danger',   // status minimum dari bukti keras
  stage: 'L0' | 'L1' | 'L2',                 // tahap terakhir yang dijalankan
  needsAgent: boolean,
  source: 'rules',
  flags: {
    hasCredentialField: boolean,
    claimedBrandIds: string[],
    matchedOfficialBrandIds: string[]
  },
  signals: SignalHit[],
  reasons: string[],                         // maks 3, Bahasa Indonesia sederhana
  trace: TraceStep[],
  page: { url: string, hostname: string, registeredDomain: string | null },
  rulesVersion: string                       // dari config.RULES_VERSION
}

SignalHit  = { id: SignalId, severity: 'hard' | 'soft', stage: 'L0' | 'L1' | 'L2' | 'L3', brandId?: string, detail?: string }
TraceStep  = { stage: 'L0' | 'L1' | 'L2' | 'L3' | 'SCORE', signal?: SignalId, message: string, data?: Record<string, string | number | boolean> }
```

### 5.4 `AgentVerdict`

```ts
AgentVerdict = {
  verdict: 'neutral' | 'caution' | 'danger',   // 'official' tidak boleh dari agen
  confidence: number,                          // 0..1
  reasons: string[],                           // maks 3, tiap item maks 160 karakter
  evidenceRefs: string[]                       // maks 10, tiap item maks 64 karakter
}
```

## 6. Spesifikasi Modul

### 6.1 `text.ts`

- `normalizeText(s)`: NFKC, huruf kecil, hapus tanda diakritik (NFD lalu buang `\p{M}`), ganti rangkaian spasi dengan satu spasi, `trim`.
- `tokenize(s)`: `normalizeText`, lalu pisah pada karakter non-alfanumerik, buang token kosong.
- `splitSegments(s)`: pisah teks pada pemisah judul (`-`, `–`, `—`, `|`, `:`, `·`, `•`), kembalikan segmen yang sudah `trim` dan tidak kosong.

### 6.2 `punycode.ts`

`punycodeToUnicode(label)`: decoder RFC 3492. Label tanpa awalan `xn--` dikembalikan apa adanya. Vektor uji: `xn--bcher-kva` menjadi `bücher`; `xn--80ak6aa92e` menjadi `аррӏе`.

### 6.3 `url.ts`: `parseUrl(input): ParsedUrl`

Menggunakan `new URL()` dan `tldts.parse(hostname, { allowPrivateDomains: true })`.

```ts
ParsedUrl = {
  ok: boolean,                       // false bila bukan http/https atau tidak dapat diuraikan
  href: string,
  protocol: 'http:' | 'https:',
  hostname: string,                  // ASCII (punycode), huruf kecil
  hostnameUnicode: string,           // tiap label xn-- didekode
  registeredDomain: string | null,   // null bila IP atau tanpa domain terdaftar
  publicSuffix: string | null,
  isPrivateSuffix: boolean,          // true untuk platform hosting di bagian PRIVATE PSL (mis. vercel.app)
  label: string | null,              // registeredDomain tanpa publicSuffix
  subdomain: string,
  isIp: boolean,
  hasUserinfo: boolean,              // ada username@ di URL
  path: string,                      // tanpa query dan fragment
  hasPunycode: boolean               // ada label yang diawali xn--
}
```

Aturan: `ok: false` untuk skema selain http/https. `registeredDomain` pada host di bawah suffix PRIVATE adalah domain pemakai (mis. `bca.vercel.app` untuk `x.bca.vercel.app`).

### 6.4 `brands.ts`

- `loadBrands(raw)`: validasi dengan `z.array(BrandSchema)`. Menormalkan huruf kecil pada domain, host, keyword.
- `validateBrandDb(brands): string[]` mengembalikan masalah berikut (bila ada):
  - `id` ganda.
  - Domain atau host tidak huruf kecil, mengandung skema atau path.
  - `officialDomains` berisi public suffix atau domain di bagian PRIVATE PSL.
  - `officialDomains` berisi domain milik platform konten pihak ketiga (daftar `config.SHARED_CONTENT_DOMAINS`, awal: `google.com`, `googleusercontent.com`, `github.com`, `facebook.com`, `youtube.com`, `tiktok.com`, `wordpress.com`, `blogspot.com`), kecuali merek juga mendefinisikan `sharedContentPaths` tidak kosong.
  - `sharedContentPaths` berisi nilai yang tidak diawali `/` atau lebih dari 200 karakter.
  - Keyword kosong, bukan huruf kecil, atau duplikat dalam satu merek.
  - `sources` kosong atau bukan URL.
  - `verifiedAt` bukan `YYYY-MM-DD`.
  - Merek `demo: true` memakai domain yang juga milik merek nyata.
- `buildBrandIndex(brands)`: membangun `Map` registeredDomain ke merek, `Map` exactHost ke merek, daftar keyword. Dibangun sekali per `createEngine`.
- Definisi **keyword lemah**: keyword dengan panjang 3 karakter atau kurang, atau milik merek dengan `ambiguousToken: true`.

### 6.5 L0: `matchOfficial(url): OfficialMatch`

```ts
OfficialMatch = { matched: boolean, brandIds: string[], via: 'registered' | 'exact' | null }
```

- Diuraikan dengan `parseUrl`. `ok: false` menghasilkan `matched: false`.
- Cocok bila `registeredDomain` ada di `officialDomains` suatu merek (`via: 'registered'`), atau `hostname` sama persis dengan `exactHosts` (`via: 'exact'`). Satu domain boleh dimiliki beberapa merek; kembalikan semuanya.
- Pengecualian konten bersama: merek dengan `sharedContentPaths` tidak dianggap cocok bila `parsed.path` diawali salah satu path tersebut. Jadi `docs.google.com/forms/...` bukan official, tetapi `google.com/search` official.
- Dilarang memakai `endsWith` mentah pada hostname.
- Bila cocok: `analyze` mengembalikan `status: 'official'`, `stage: 'L0'`, `floor: 'neutral'`, `needsAgent: false`, dan pemeriksaan berhenti.

### 6.6 L1: `analyzeUrlSignals(parsed, index, config): SignalHit[]`

Tidak dijalankan bila L0 cocok. Sinyal (semua `soft`, `stage: 'L1'`):

| Sinyal | Kondisi |
|---|---|
| `CHEAP_TLD` | `publicSuffix` ada di `config.CHEAP_SUFFIXES` |
| `FREE_SUBDOMAIN_PLATFORM` | `isPrivateSuffix` benar |
| `URL_SHORTENER` | `registeredDomain` ada di `config.SHORTENER_DOMAINS` |
| `SHARED_CONTENT_FORM` | `parsed.path` berada di `sharedContentPaths` merek, atau `registeredDomain` ada di `config.SHARED_FORM_DOMAINS` (awal: `forms.gle`) |
| `IP_HOST` | `isIp` benar |
| `USERINFO_IN_URL` | `hasUserinfo` benar |
| `PUNYCODE` | `hasPunycode` benar |
| `HOMOGLYPH` | `skeleton(label)` sama dengan label resmi suatu merek, padahal `label` asli berbeda (termasuk karakter non-ASCII) |
| `TYPOSQUAT` | jarak Damerau-Levenshtein antara `skeleton(label)` dan `skeleton(labelResmi)` memenuhi ambang (lihat di bawah), dan `label` tidak sama dengan label resmi |
| `SAME_LABEL_DIFFERENT_SUFFIX` | `label` sama persis dengan label resmi suatu merek, tetapi `registeredDomain` bukan miliknya |
| `BRAND_TOKEN_IN_HOST` | token host (lihat di bawah) cocok dengan keyword merek, dan host bukan milik merek itu |

**Label resmi** adalah `domainWithoutSuffix` dari tiap `officialDomains` (mis. `bca` dari `bca.co.id`) dan `exactHosts`.

**Ambang typosquat** berdasarkan panjang label resmi: 3 karakter atau kurang = tidak dihitung; 4 sampai 7 = jarak maksimum 1; 8 atau lebih = jarak maksimum 2. Kandidat yang `registeredDomain`-nya milik merek mana pun dilewati.

**Token host:** label host (tanpa public suffix) dipecah pada `-`, `.`, dan `_`. Kecocokan dengan keyword: token sama persis, atau (hanya bila keyword 5 karakter atau lebih) token diawali atau diakhiri keyword.

**Aturan keyword lemah** (mengurangi positif palsu): untuk merek dengan keyword lemah, sinyal `TYPOSQUAT`, `SAME_LABEL_DIFFERENT_SUFFIX`, dan `BRAND_TOKEN_IN_HOST` baru dihasilkan bila host juga memuat salah satu token konteks (`config.CONTEXT_TOKENS`: `login`, `masuk`, `verifikasi`, `verif`, `secure`, `aman`, `akun`, `account`, `update`, `bantuan`, `cs`, `promo`, `hadiah`, `klaim`). `HOMOGLYPH` tidak memerlukan token konteks.

Keluarga peniruan: `TYPOSQUAT`, `HOMOGLYPH`, `BRAND_TOKEN_IN_HOST`, `SAME_LABEL_DIFFERENT_SUFFIX`, `UNVERIFIED_BRAND_CLAIM`.

`config.CHEAP_SUFFIXES` awal: `my.id`, `biz.id`, `web.id`, `xyz`, `top`, `click`, `icu`, `buzz`, `cfd`, `sbs`, `cyou`, `rest`, `lol`. `config.SHORTENER_DOMAINS` awal: `s.id`, `bit.ly`, `tinyurl.com`, `cutt.ly`, `rebrand.ly`, `is.gd`, `shorturl.at`, `t.ly`, `rb.gy`, `bitly.com`, `forms.gle`. Ketiga daftar (`CHEAP_SUFFIXES`, `SHORTENER_DOMAINS`, `SHARED_FORM_DOMAINS`) dapat disetel. `COMMON_PUBLIC_SUFFIXES` berisi suffix umum (mis. `com`, `io`, `co.id`, `co.uk`) untuk menekan klaim merek generik; daftar ini bukan pengganti PSL lengkap dan tidak memuat `com.kz`.

### 6.7 `confusables.ts` dan `similarity.ts`

- `skeleton(label)`: NFKC dan huruf kecil; petakan huruf non-Latin yang serupa ke ASCII (minimal Cyrillic `а е о р с х у і ј ѕ ԁ` dan Yunani `ο ν ρ`); petakan `rn` ke `m` dan `vv` ke `w`; petakan digit `0` ke `o`, `1` ke `l`, `5` ke `s`; hapus `-`.
- `damerauLevenshtein(a, b)`: jarak edit dengan transposisi bersebelahan; kasus kosong dan sama harus benar.

### 6.8 `claims.ts`: `detectBrandClaims(input, index, config): BrandClaim[]`

```ts
input = { title: string, headings: string[], siteName: string | null }
BrandClaim = { brandId: string, strength: 'strong' | 'weak', sources: ('title' | 'h1' | 'siteName')[] }
```

Sumber teks: `title`, tiap item `headings` (h1), dan `siteName`. Tiap teks dipecah jadi segmen (`splitSegments`) dan di-`tokenize`.

- **Kecocokan keyword:** keyword (atau `name` merek) cocok sebagai urutan token utuh, bukan substring.
- **Klaim kuat (`strong`):** `siteName` sama dengan keyword/nama, atau suatu segmen judul/h1 diawali keyword setelah token awal pada `config.LEADING_STOPWORDS` dibuang (awal: `login`, `log`, `masuk`, `sign`, `signin`, `in`, `ke`, `di`, `selamat`, `datang`, `portal`, `halaman`, `akun`, `internet`, `mobile`, `klik`, `official`, `resmi`).
- **Klaim lemah (`weak`):** keyword muncul di tempat lain pada judul atau h1.
- **Merek ambigu** (`ambiguousToken: true`): klaim hanya dihitung bila `siteName` sama dengan keyword/nama, atau suatu segmen, setelah membuang token awal pada `LEADING_STOPWORDS` dan token akhir pada `config.TRAILING_STOPWORDS` (awal: `indonesia`, `id`, `official`, `resmi`, `dompet`, `digital`, `login`, `masuk`, `aplikasi`, `app`, `web`, `website`), sama persis dengan keyword/nama. Klaim seperti ini selalu `strong`.
- Satu merek menghasilkan satu `BrandClaim` dengan kekuatan tertinggi dan gabungan sumbernya.

### 6.9 L2: `l2.ts`

**`isCredentialField(field): boolean`.** Benar bila salah satu:
1. `type === 'password'`.
2. `autocomplete` (token, tidak peka huruf besar) mengandung `one-time-code`, `current-password`, atau `new-password`.
3. `type` ada di `{text, tel, number, password}` dan salah satu token dari `name`, `id`, `placeholder` (hasil `tokenize`, termasuk pemecahan camelCase pada `name`/`id`) ada di `config.CREDENTIAL_TOKENS`: `otp`, `pin`, `mpin`, `passcode`, `password`, `passwd`, `pwd`, `sandi`, `katasandi`. Frasa `kata sandi` dan `kode otp` dicocokkan sebagai dua token berurutan. Kecocokan hanya token utuh (jadi `shipping` tidak cocok dengan `pin`).

**`isCredentialText(text): boolean`.** Tokenisasi identifier (termasuk camelCase) dan cocokkan token utuh `CREDENTIAL_TOKENS`, frasa `kata sandi`, atau `kode otp`/`kode verifikasi`. Dipakai pada `title`, `headings`, dan `formLabels`; tidak membaca teks halaman penuh.

**`resolveFormTarget(action, pageUrl): ResolvedTarget`**, dengan `ResolvedTarget = { kind: 'same' | 'external' | 'ignored', url?: string, registeredDomain?: string | null, host?: string }`:
- `action` null, kosong, `#...`, atau relatif yang terselesaikan ke domain terdaftar yang sama = `same`.
- Skema selain http/https (`javascript:`, `mailto:`, dan sebagainya) = `ignored`.
- Selebihnya diselesaikan terhadap `pageUrl`; domain terdaftar berbeda = `external`.

**Sinyal** (`stage: 'L2'`):

| Sinyal | Tingkat | Kondisi |
|---|---|---|
| `CREDENTIAL_FIELD` | hard (H2) | ada minimal satu `FieldFeature` yang lolos `isCredentialField` |
| `CREDENTIAL_TEXT` | soft | label/judul memuat kredensial dan ada form atau `SHARED_CONTENT_FORM`; menangkap form teks seperti Google Form |
| `UNVERIFIED_BRAND_CLAIM` | soft | token merek pada `title`/`headings`/`siteName` sama dengan token host, host tidak dimiliki merek mana pun, suffix bukan `COMMON_PUBLIC_SUFFIXES`, dan bukan private suffix |
| `BRAND_CLAIM_UNOFFICIAL_DOMAIN` | hard (H1) | lihat di bawah |
| `FORM_CROSS_DOMAIN` | hard (H3) | form yang memuat kolom kredensial punya target `external`, dan host target tidak ada di `config.TRUSTED_AUTH_HOSTS` (awal: `accounts.google.com`, `appleid.apple.com`, `login.microsoftonline.com`, `login.live.com`) |
| `HOTLINKS_OFFICIAL_ASSETS` | soft | sumber daya (`img`, `script`, `link`) dimuat dari domain resmi suatu merek, sedangkan laman bukan milik merek itu |
| `INSECURE_CREDENTIAL_FORM` | soft | ada kolom kredensial dan protokol laman `http:` |
| `NEW_DOMAIN` | soft (`stage: 'L3'`) | `context.domainAgeDays` ada dan kurang dari `config.NEW_DOMAIN_DAYS` (awal: 30) |

**H1 (`BRAND_CLAIM_UNOFFICIAL_DOMAIN`)** dihasilkan per merek yang diklaim bila laman bukan milik merek itu dan salah satu benar: klaim `strong`, atau klaim `weak` dan jumlah sinyal lunak yang berbeda (dari L1 dan L2) minimal 1. Satu sinyal per merek, dengan `brandId`.

### 6.10 `scoring.ts`: `scoreSignals(...)`

Urutan status: `neutral` < `caution` < `danger`. `official` hanya berasal dari L0.

1. **Danger:** ada H1 dan H2 (`CREDENTIAL_FIELD`). `floor = danger`.
2. **Caution** (bila bukan danger) bila salah satu:
   - C1: H2 dan H3.
   - C2: H2 dan sinyal lunak kuat (`CHEAP_TLD`, `FREE_SUBDOMAIN_PLATFORM`, `SHARED_CONTENT_FORM`, `CREDENTIAL_TEXT`, `UNVERIFIED_BRAND_CLAIM`), atau H2 dan minimal 2 sinyal lunak berbeda.
   - C3: ada sinyal keluarga peniruan (dengan atau tanpa fitur laman).
   - C4: H1 + `FREE_SUBDOMAIN_PLATFORM` + `HOTLINKS_OFFICIAL_ASSETS`.
   - C5: H1 tanpa H2.
   - C6: `CREDENTIAL_TEXT` tanpa H2.
3. Selain itu `neutral`. H2 sendirian, atau H2 + `NEW_DOMAIN` saja, tetap `neutral`.
4. `floor = danger` hanya pada aturan 1. Selain itu `floor = neutral`. Bukti H3 saja tidak menjadi lantai, karena alur masuk lewat penyedia identitas pihak ketiga yang sah dapat memicunya.
5. `needsAgent = (status === 'caution') && (hasCredentialField || hasCredentialText || hasC4)`.
6. Sinyal lunak dihitung berdasarkan `id` yang berbeda, dan `NEW_DOMAIN` termasuk.

Tiap keputusan penilaian ditambahkan ke `trace` dengan `stage: 'SCORE'`.

### 6.11 `reasons.ts`

`buildReasons(result): string[]` memilih maksimal 3 alasan berurutan prioritas: H1, H3, H2/`CREDENTIAL_TEXT`, keluarga peniruan, lalu sinyal lunak lainnya. Alasan duplikat dibuang. Templat (kurung kurawal = isian):

| Sinyal | Templat |
|---|---|
| (official) | `Alamat ini terdaftar sebagai alamat resmi {brand}.` |
| `BRAND_CLAIM_UNOFFICIAL_DOMAIN` | `Laman ini mengaku sebagai {brand}, tetapi alamatnya ({domain}) bukan alamat resmi {brand}.` |
| `CREDENTIAL_FIELD` / `CREDENTIAL_TEXT` | `Laman ini meminta sandi, PIN, atau kode OTP.` |
| `SHARED_CONTENT_FORM` | `Laman ini memakai formulir atau konten dari platform bersama, bukan halaman resmi merek.` |
| `UNVERIFIED_BRAND_CLAIM` | `Laman ini mengaku sebagai {token}, tetapi alamatnya tidak membuktikan kepemilikan merek itu.` |
| `FORM_CROSS_DOMAIN` | `Data yang Anda isi akan dikirim ke situs lain ({target}).` |
| `TYPOSQUAT` | `Alamat ini mirip alamat resmi {brand} ({official}), tetapi tidak sama.` |
| `HOMOGLYPH` | `Alamat ini memakai huruf yang menyerupai huruf lain untuk meniru {brand}.` |
| `BRAND_TOKEN_IN_HOST` | `Alamat ini memuat nama {brand}, tetapi bukan milik {brand}.` |
| `SAME_LABEL_DIFFERENT_SUFFIX` | `Nama alamat ini sama dengan {brand}, tetapi akhirannya berbeda ({domain}).` |
| `CHEAP_TLD` | `Alamat ini memakai akhiran murah yang sering disalahgunakan ({suffix}).` |
| `FREE_SUBDOMAIN_PLATFORM` | `Laman ini dibuat di layanan hosting gratis ({suffix}).` |
| `URL_SHORTENER` | `Tautan ini adalah tautan pendek yang menyembunyikan tujuan sebenarnya.` |
| `IP_HOST` | `Alamat ini berupa angka (IP), bukan nama situs.` |
| `USERINFO_IN_URL` | `Alamat ini memakai tanda @ untuk menyamarkan tujuan sebenarnya.` |
| `PUNYCODE` | `Alamat ini memuat karakter khusus yang dapat menyerupai huruf biasa.` |
| `HOTLINKS_OFFICIAL_ASSETS` | `Laman ini memuat gambar atau berkas dari situs resmi {brand} untuk meniru tampilannya.` |
| `INSECURE_CREDENTIAL_FORM` | `Laman ini meminta data sensitif lewat koneksi tidak aman (http).` |
| `NEW_DOMAIN` | `Alamat ini baru terdaftar ({days} hari lalu).` |

Hasil `neutral` tanpa sinyal menghasilkan `reasons: []`.

### 6.12 `engine.ts`: urutan `analyze`

1. `parseUrl(input.url)`. Bila `ok: false`, kembalikan `neutral` dengan satu langkah trace `L1` "URL tidak dapat diperiksa".
2. L0 `matchOfficial`. Cocok: kembalikan hasil `official` (bagian 6.5).
3. L1 `analyzeUrlSignals`. `stage = 'L1'`.
4. Bila `features` ada: L2 (klaim, kredensial, form, aset) dan sinyal `NEW_DOMAIN` bila `context.domainAgeDays` ada. `stage = 'L2'`.
5. `scoreSignals`, `buildReasons`, rakit `AnalysisResult`, validasi dengan `AnalysisResultSchema` (hanya pada mode pengujian).

Perilaku wajib: `analyze` tidak melempar galat untuk masukan jelek (URL kosong, fitur tidak lengkap). Fitur yang tidak lolos `PageFeaturesSchema` ditolak dengan hasil L1 dan satu langkah trace `L2` "fitur laman tidak valid". Ini perilaku aman, bukan galat.

### 6.13 `cache-key.ts`

`normalizeUrlForCache(url): string`:
1. Uraikan; hostname huruf kecil (ASCII); buang awalan `www.`.
2. Path huruf kecil; buang query dan fragment; ambil maksimal dua segmen pertama.
3. Segmen yang seluruhnya angka, atau berupa 16 karakter atau lebih dari `[A-Za-z0-9_-]`, diganti `*`.
4. Path kosong menjadi `/`; gabungkan sebagai `host + path` tanpa garis miring penutup (kecuali path `/`).
5. URL tidak valid: kembalikan string kosong.

`cacheKey(url)`: `SHA-256("v1|" + normalizeUrlForCache(url))` dalam heksadesimal huruf kecil (64 karakter), memakai `crypto.subtle`. URL tidak valid menghasilkan `Promise` yang ditolak dengan `Error('invalid-url')`.

### 6.14 `verdict.ts`: `mergeVerdict(rule, agent): MergedVerdict`

```ts
MergedVerdict = { status: 'neutral' | 'caution' | 'danger' | 'official', source: 'rules' | 'agent', capped: boolean }
```

1. `rule.status === 'official'`: kembalikan `official`, `source: 'rules'` (agen tidak dipanggil).
2. `agent === null`: kembalikan `rule.status`, `source: 'rules'`.
3. `agentStatus = agent.verdict`. Bila `agent.verdict === 'danger'` dan `evidenceRefs` kosong: turunkan menjadi `caution` dan `capped: true`.
4. `status = max(rule.floor, agentStatus)` menurut urutan `neutral < caution < danger`. Agen dapat menurunkan `caution` menjadi `neutral` hanya bila `rule.floor` adalah `neutral`.
5. `source = 'agent'` bila hasil berbeda dari `rule.status`, selain itu `'rules'`.

### 6.15 `interfaces.ts` (tipe saja)

```ts
interface LlmProvider {
  readonly name: string;
  generate(req: LlmRequest, opts: { signal: AbortSignal }): Promise<LlmResponse>;
}
LlmRequest  = { system: string; messages: LlmMessage[]; tools: LlmToolDef[]; temperature: number; maxTokens: number }
LlmResponse = { toolCalls: { id: string; name: string; args: unknown }[]; text: string | null; usage: { inputTokens: number; outputTokens: number } }

interface CacheStore {
  get(key: string): Promise<CacheRecord | null>;
  set(key: string, record: CacheRecord, ttlSeconds: number): Promise<void>;
}
CacheRecord = { status: 'neutral' | 'caution' | 'danger'; reasons: string[]; createdAt: number; expiresAt: number; rulesVersion: string }

interface PageFetcher     { fetchHtml(url: string, opts: { signal: AbortSignal }): Promise<{ finalUrl: string; html: string }> }
interface DomainAgeLookup { ageDays(registeredDomain: string, opts: { signal: AbortSignal }): Promise<number | null> }
```

## 7. Rencana Pengujian (Vitest)

Fixture: `__tests__/fixtures/brands.fixture.ts` berisi merek kecil untuk pengujian: `bca` (`bca.co.id`, `klikbca.com`; keyword `bca`, `klikbca`), `mandiri` (`bankmandiri.co.id`; keyword `mandiri`), `dana` (`dana.id`; ambigu), `shopee` dan `shopeepay` (keduanya `shopee.co.id`), `google_oauth` (`officialDomains: ['google.com', 'google.co.id']`, `exactHosts: ['accounts.google.com']`, `sharedContentPaths: ['/forms/', '/site/', '/view/']`), `fiktif` (`demo: true`, `bank-nusantara-contoh.id`). Selain itu satu tes memvalidasi `src/data/brands.json` dengan `loadBrands` dan `validateBrandDb` (hasil kosong).

### 7.1 Kasus wajib per modul

| Modul | Masukan | Hasil yang diharapkan |
|---|---|---|
| `parseUrl` | `https://www.klikbca.com/login` | `registeredDomain: 'klikbca.com'`, `hostname: 'www.klikbca.com'` |
| `parseUrl` | `https://bca.login.my.id/x` | `registeredDomain: 'login.my.id'`, `publicSuffix: 'my.id'`, `isPrivateSuffix: false` |
| `parseUrl` | `https://foo.vercel.app` | `registeredDomain: 'foo.vercel.app'`, `isPrivateSuffix: true` |
| `parseUrl` | `http://192.168.1.1/login` | `isIp: true`, `registeredDomain: null` |
| `parseUrl` | `https://bca.co.id@evil.example/` | `hostname: 'evil.example'`, `hasUserinfo: true` |
| `parseUrl` | `ftp://x.com`, string kosong | `ok: false` |
| `punycodeToUnicode` | `xn--bcher-kva`, `xn--80ak6aa92e` | `bücher`, `аррӏе` |
| `matchOfficial` | `https://www.bca.co.id/id` | cocok, `bca`, `via: 'registered'` |
| `matchOfficial` | `https://bca.co.id.evil.com` | tidak cocok |
| `matchOfficial` | `https://accounts.google.com/x` | cocok, `via: 'registered'` |
| `matchOfficial` | `https://sites.google.com/site/x` | tidak cocok |
| `matchOfficial` | `https://docs.google.com/forms/d/e/x/viewform` | tidak cocok |
| `matchOfficial` | `https://www.google.com/search?q=x` | cocok, `via: 'registered'` |
| `matchOfficial` | `https://shopee.co.id` | `brandIds` memuat `shopee` dan `shopeepay` |
| L1 | `https://bca-login.my.id` | `BRAND_TOKEN_IN_HOST` (merek `bca`), `CHEAP_TLD`; status `caution` |
| L1 | `https://klikbca.co` | `SAME_LABEL_DIFFERENT_SUFFIX` |
| L1 | `https://bankmandirl.co.id` | `TYPOSQUAT` (merek `mandiri`) |
| L1 | `https://bca.com` (tanpa token konteks, keyword lemah) | tanpa sinyal peniruan |
| L1 | host dengan huruf Cyrillic `с` (`\u0441`) menggantikan `c` pada `bca` | `HOMOGLYPH`, `PUNYCODE` |
| L1 | `https://dana.example.com` | tanpa sinyal (merek ambigu, tanpa token konteks) |
| L1 | `https://dana-login.xyz` | `BRAND_TOKEN_IN_HOST` (merek `dana`), `CHEAP_TLD` |
| L1 | `https://bit.ly/abc` | `URL_SHORTENER` |
| L1 | `http://203.0.113.5/bca` | `IP_HOST` |
| L1 | `https://newstartup.io/login` | tanpa sinyal; `neutral` |
| L1 | `https://docs.google.com/forms/d/e/x/viewform` | `SHARED_CONTENT_FORM`; bukan official |
| L1 | `https://forms.gle/abc` | `URL_SHORTENER`, `SHARED_CONTENT_FORM` |
| `isCredentialField` | `{type:'password'}` | benar |
| `isCredentialField` | `{type:'text', name:'otpCode'}` | benar |
| `isCredentialField` | `{type:'text', name:'shipping'}` | salah |
| `isCredentialField` | `{type:'text', autocomplete:'one-time-code'}` | benar |
| `resolveFormTarget` | `null`, `''`, `'#'` | `same` |
| `resolveFormTarget` | `'/login'` pada halaman yang sama | `same` |
| `resolveFormTarget` | `javascript:void(0)` | `ignored` |
| `resolveFormTarget` | `https://collector.biz.id/post` dari `login-xyz.top` | `external` |
| Klaim | title `Login BCA` | `bca`, `strong` |
| Klaim | title `Cara Login KlikBCA di HP – Blogku` | `bca`, `weak` |
| Klaim | title `DANA - Dompet Digital Indonesia` | `dana`, `strong` (merek ambigu, segmen sama persis) |
| Klaim | title `Dana Pensiun Lembaga Keuangan` | tidak ada klaim |
| Klaim | `siteName: 'Bank Mandiri'` | `mandiri`, `strong` |
| Klaim | token `pay with bca` (title `Pay with BCA`) | `bca`, `weak` |
| `analyze` (E2E) | `bca-secure.my.id`, title `Login BCA`, form password | `danger`, `floor: 'danger'`, `needsAgent: false`, alasan memuat nama BCA |
| `analyze` (E2E) | blog `blog.example`, title `Cara Login KlikBCA...`, tanpa kolom kredensial | `neutral` |
| `analyze` (E2E) | blog yang sama dengan kolom password | `neutral` (klaim lemah, tanpa sinyal lunak) |
| `analyze` (E2E) | `newstartup.io/login`, title `Masuk – NewStartup`, password | `neutral`, `needsAgent: false` |
| `analyze` (E2E) | `roblox.com.kz/login?returnUrl=137614935`, title `Roblox`, password | `caution`, `UNVERIFIED_BRAND_CLAIM`, `needsAgent: true` |
| `analyze` (E2E) | Google Form resmi dengan label `Password` | `caution`, `SHARED_CONTENT_FORM`, `CREDENTIAL_TEXT`, `needsAgent: true` |
| `analyze` (E2E) | Google Form tanpa label kredensial | `neutral`, bukan `official` |
| `analyze` (E2E) | `login-xyz.top`, password, form ke `collector.biz.id`, tanpa klaim | `caution` (C1), `needsAgent: true` |
| `analyze` (E2E) | `shop.example`, password, form ke `accounts.google.com` | `neutral` |
| `analyze` (E2E) | `danapensiun.example`, title `Dana Pensiun...`, password | `neutral` |
| `analyze` (E2E) | `dana-verif.xyz`, title `DANA - Dompet Digital Indonesia`, password | `danger` |
| `analyze` (E2E) | laman tak resmi memuat `https://www.bca.co.id/logo.png` | `HOTLINKS_OFFICIAL_ASSETS` |
| `analyze` (E2E) | `bca-login.my.id` tanpa `features` | `caution`, `stage: 'L1'`, `needsAgent: false` |
| `analyze` (E2E) | `https://www.bca.co.id` | `official`, `stage: 'L0'` |
| `analyze` (E2E) | `domainAgeDays: 5` pada kasus `caution` C2 | `NEW_DOMAIN` ada |
| `analyze` (E2E) | `features` tidak valid | tidak melempar; `neutral`, trace memuat "fitur laman tidak valid" |
| `normalizeUrlForCache` | `https://Bank-X.my.id/Login/verify/abc?token=1#x` | `bank-x.my.id/Login/verify/abc?token=1` |
| `normalizeUrlForCache` | `https://www.example.com/a/b/c/d` | `example.com/a/b/c/d` |
| `normalizeUrlForCache` | `https://example.com/reset/1234567890abcdef1234` | `example.com/reset/1234567890abcdef1234` |
| `normalizeUrlForCache` | `https://example.com?a=1&b=2` dan `?b=2&a=1` | query diurutkan; hasil sama |
| `normalizeUrlForCache` | `https://example.com` dan `https://example.com/` | hasil sama (`example.com/`) |
| `cacheKey` | dua URL dengan query berbeda | kunci berbeda; panjang 64 heksadesimal |
| `cacheKey` | `not a url` | ditolak (`invalid-url`) |
| `mergeVerdict` | floor `danger`, agen `neutral` | `danger` |
| `mergeVerdict` | rule `caution` (floor `neutral`), agen `neutral` | `neutral`, `source: 'agent'` |
| `mergeVerdict` | agen `danger`, `evidenceRefs: []` | `caution`, `capped: true` |
| `mergeVerdict` | agen `danger`, `evidenceRefs: ['form_target']` | `danger` |
| `mergeVerdict` | `rule.status === 'official'` | `official` |
| `mergeVerdict` | agen `null` | status aturan |
| `damerauLevenshtein` | `ab`/`ba`, `kitten`/`sitting`, `''`/`abc` | 1, 3, 3 |
| `validateBrandDb` | merek dengan `officialDomains: ['google.com']` tanpa `sharedContentPaths` | masalah dilaporkan |
| `validateBrandDb` | merek yang sama dengan `sharedContentPaths: ['/forms/']` | tidak ada masalah |
| `validateBrandDb` | dua merek ber-`id` sama | masalah dilaporkan |

### 7.2 Pengujian lintas-batasan

- **Portabilitas (ARC-01):** satu tes membaca semua berkas di `src/` (kecuali `__tests__/`) dan gagal bila ada: `from 'node:`, `require(`, `from 'fs'`, `from 'path'`, `Buffer`, `process.`, `window.`, `document.`, `chrome.`.
- **Determinisme:** `analyze` dipanggil dua kali dengan masukan sama menghasilkan objek yang sama (`toEqual`).
- **Tanpa jaringan:** tes mengganti `globalThis.fetch` dengan fungsi yang melempar, lalu menjalankan seluruh kasus E2E tanpa galat.
- **Keluaran valid:** hasil `analyze` pada semua kasus E2E lolos `AnalysisResultSchema`.
- **Kinerja informal:** satu tes mengukur 1.000 pemanggilan `analyze` L0 sampai L2 pada fixture; waktu rata-rata dilaporkan (target di bawah 5 ms per pemanggilan, sebagai target yang diukur, bukan jaminan).

## 8. Kriteria Selesai (Definition of Done)

- `npm run test --workspace=packages/core` lulus, `npm run typecheck --workspace=packages/core` lulus.
- Semua kasus pada bagian 7.1 ada sebagai tes, dan tes lintas-batasan pada 7.2 lulus.
- `src/data/brands.json` lolos `loadBrands` dan `validateBrandDb` tanpa masalah. Untuk merek yang belum diverifikasi manual, `verifiedBy` dan `verifiedAt` mencerminkan kenyataan.
- Dependensi runtime hanya `tldts` dan `zod`.
- Bundel `core` dapat diimpor tanpa galat oleh satu aplikasi WXT kecil dan satu Worker uji (dicatat hasilnya; boleh dikerjakan pada tahap aplikasi).
- Semua daftar dan ambang berada di `config.ts` dan diekspor, sehingga tim dapat menyetelnya setelah evaluasi.

## 9. Asumsi dan Hal yang Perlu Dikonfirmasi

1. Perilaku `tldts` terhadap `allowPrivateDomains` (kasus `foo.vercel.app`) diverifikasi dengan tes pada 7.1 sebelum bagian lain dibangun. Bila berbeda, sesuaikan `parseUrl`, bukan spesifikasinya.
2. Berkas `public_suffix_list.dat` di `src/data` tidak dipakai selama tes `parseUrl` lulus dengan data bawaan `tldts`, dan boleh dihapus.
3. Daftar `CHEAP_SUFFIXES`, `SHORTENER_DOMAINS`, `CONTEXT_TOKENS`, `LEADING_STOPWORDS`, ambang typosquat, dan `NEW_DOMAIN_DAYS` adalah nilai awal. Penyetelan dilakukan dari hasil evaluasi, bukan dari tebakan.
4. Aturan C3 (peniruan URL saja menghasilkan `caution`) adalah titik risiko positif palsu. Bila evaluasi pada himpunan lookalike sah menunjukkan terlalu banyak peringatan, turunkan C3 menjadi sinyal informasi dan hanya naikkan status bila ada kolom kredensial.
5. `mergeVerdict` mengikuti AGT-05 pada PRD v1.4 dengan satu penegasan: agen dapat menurunkan `caution` ke `neutral` hanya bila `floor` adalah `neutral`.