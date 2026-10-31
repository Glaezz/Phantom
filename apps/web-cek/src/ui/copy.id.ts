// Katalog salinan (Design.md 8.3). Semua teks UI berasal dari sini.
// Tambah teks = tambah kunci di sini lebih dulu (DS-92).
// Patuhi 8.1 (bahasa sehari-hari, kalimat <= 20 kata, sapa "Anda") dan
// 8.2 (kata terlarang di layar pertama) sebelum menambah kunci baru.
export const copy = {
  status: {
    official: { title: 'Situs resmi terverifikasi', short: 'Resmi' },
    neutral: { title: 'Belum ada tanda bahaya', short: 'Netral' },
    caution: { title: 'Hati-hati', short: 'Hati-hati' },
    danger: { title: 'Bahaya', short: 'Bahaya' },
  },
  action: {
    official: 'Alamat ini terdaftar sebagai kanal resmi {brand}.',
    neutral: 'Tetap waspada. Phantom tidak bisa menjamin sebuah situs bebas penipuan.',
    caution: 'Periksa dulu sebelum mengisi data penting.',
    danger: 'Jangan isi atau kirim data di laman ini.',
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
  mode: {
    rulesOnly: 'Pemeriksaan cepat (tanpa AI)',
    noConsent: 'Pemeriksaan lanjutan belum diaktifkan. Hasil memakai pemeriksaan dasar.',
  },
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
    officialDomainsLabel: 'Alamat situs resmi',
    officialPhonesLabel: 'Nomor telepon resmi',
    officialChannelDefault: 'Kanal resmi terdaftar',
    nextSteps: 'Apa yang sebaiknya Anda lakukan?',
    nextStepsDanger: [
      'Jangan klik dan jangan unduh berkas dari tautan ini.',
      'Jangan berikan PIN, kode OTP, atau kata sandi.',
      'Buka situs resmi bila Anda butuh layanan: {channel}',
    ],
    nextStepsCaution: [
      'Jangan isi data penting sebelum memastikan keaslian alamat.',
      'Buka situs lewat kanal resmi yang terdaftar: {channel}',
      'Tanyakan langsung ke pengirim lewat kanal lain bila ragu.',
    ],
    nextStepsNeutral: [
      'Periksa kembali alamat sebelum Anda mengisi data.',
      'Jangan berikan PIN atau kode OTP kecuali Anda sudah yakin.',
    ],
    spaLimit:
      'Untuk laman yang dibangun dengan JavaScript penuh, hasil paling lengkap diperoleh lewat ekstensi Phantom di komputer.',
    budgetLimited:
      'Pemeriksaan AI sedang dibatasi hari ini. Anda tetap mendapat hasil pemeriksaan dasar.',
    empty: 'Tempel dulu tautan atau pesan yang ingin diperiksa.',
    invalidUrl: 'Ini belum terlihat seperti tautan. Coba tempel seluruh tautan, mulai dari "http".',
    blockedTarget: 'Alamat ini tidak bisa diperiksa dari Web Cek karena alasan keamanan.',
    offline: 'Anda sedang offline. Sambungkan internet lalu coba lagi.',
  },
  error: {
    connectionFailed:
      'Gagal terhubung ke server pemeriksaan. Periksa koneksi internet Anda lalu coba lagi.',
    timeout: 'Pemeriksaan membutuhkan waktu terlalu lama. Coba ulangi pemeriksaan.',
    rulesFallback: 'Layanan internet tidak merespons. Menampilkan hasil pemeriksaan dasar.',
  },
  parser: {
    found: 'Ditemukan {links} tautan dan {phones} nomor telepon',
    apkWarning: 'Jangan pasang file ini. Undangan sungguhan tidak perlu aplikasi tambahan.',
    phoneUnknown: 'Tidak ada di daftar kanal resmi',
    showAll: 'Lihat semua',
    showLess: 'Tampilkan lebih sedikit',
    readOnlyLabel: 'Salinan pesan yang diperiksa',
  },
  pasteBox: {
    examplesLabel: 'Contoh:',
  },

  /* Navigasi dan footer bersama (landing, Cek, Unduh) */
  nav: {
    brand: 'Phantom',
    home: 'Beranda',
    check: 'Cek',
    download: 'Unduh',
    skipToContent: 'Lewati ke konten utama',
  },
  footer: {
    tagline: 'Periksa kanal resmi sebelum Anda menyerahkan data penting.',
    disclaimer: 'Hasil Phantom adalah peringatan, bukan putusan hukum.',
    copyright: 'Dibuat untuk Hackathon INCEPTION 2026.',
  },

  /* Landing (WEB-01) */
  landing: {
    title: 'Kenali kanal resmi sebelum Anda mengisi data',
    subtitle:
      'Phantom memeriksa tautan dan pesan yang mencurigakan sebelum Anda menyerahkan kata sandi, PIN, atau kode OTP.',
    cta: 'Periksa Sekarang',
    secondaryCta: 'Pasang Ekstensi',
    heroExampleLabel: 'Contoh hasil pemeriksaan',
    heroExampleAddress: 'promo-hadiah-murah.example',
    heroExampleBrand: 'Bank Contoh',
    howTitle: 'Cara kerja',
    howStepTitles: ['Tempel', 'Periksa', 'Lihat peringatan'],
    howSteps: [
      'Tempel tautan atau seluruh pesan yang Anda terima.',
      'Phantom memeriksa alamat situs, isi laman, dan bila perlu meminta bantuan AI.',
      'Anda melihat peringatan sebelum mengisi kata sandi, PIN, atau kode OTP.',
    ],
    statusPhantomTitle: 'Empat status Phantom',
    statusTitle: 'Arti empat status',
    statusIntro: 'Setiap hasil memakai warna, ikon, dan kata yang sama.',
    statusNotes: {
      official: 'Alamat situs ini terdaftar sebagai kanal resmi.',
      neutral: 'Belum ditemukan tanda bahaya, tetapi tetap waspada.',
      caution: 'Ada tanda yang perlu Anda periksa sebelum mengisi data.',
      danger: 'Jangan isi atau kirim data di laman ini.',
    },
    privacyTitle: 'Privasi Anda',
    privacyBody:
      'Phantom tidak menyimpan pesan Anda dan tidak membaca apa yang Anda ketik di kolom situs.',
    downloadTitle: 'Butuh pemeriksaan otomatis saat menjelajah?',
    downloadBody: 'Pasang ekstensi Phantom untuk peringatan sebelum data Anda terkirim.',
    downloadCta: 'Buka halaman Unduh',
  },

  /* Placeholder halaman yang belum diimplementasi (8.1, 8.2) */
  placeholder: {
    comingSoon: 'Segera hadir',
  },

  /* Unduh (WEB-07) */
  download: {
    title: 'Pasang Phantom di peramban Anda',
    subtitle: 'Ikuti enam langkah berikut untuk memasang ekstensi Phantom di Chrome atau Edge.',
    button: 'Unduh Ekstensi (.zip)',
    zipNote: 'Berkas zip berisi ekstensi yang siap dipasang tanpa toko aplikasi.',
    notInStore: 'Phantom belum tersedia di toko ekstensi resmi.',
    requirements: 'Phantom berjalan di Chrome dan Edge versi terbaru.',
    stepsTitle: 'Langkah pemasangan',
    steps: [
      'Unduh berkas zip ekstensi Phantom.',
      'Ekstrak berkas zip ke folder yang mudah Anda temukan.',
      'Buka chrome://extensions atau edge://extensions di peramban.',
      'Aktifkan Mode pengembang.',
      'Klik Muat yang belum dipak, lalu pilih folder hasil ekstrak.',
      'Sematkan ikon Phantom di bilah alat peramban.',
    ],
    stepAlts: [
      'Langkah 1: Mengunduh berkas zip ekstensi Phantom',
      'Langkah 2: Mengekstrak berkas zip ke folder komputer',
      'Langkah 3: Membuka alamat ekstensi di peramban',
      'Langkah 4: Mengaktifkan sakelar Mode pengembang',
      'Langkah 5: Menekan tombol Muat yang belum dipak',
      'Langkah 6: Menyematkan ikon Phantom di bilah alat',
    ],
    chromeAddress: 'chrome://extensions',
    edgeAddress: 'edge://extensions',
    browserChrome: 'Google Chrome',
    browserEdge: 'Microsoft Edge',
    stepAddress: 'Salin alamat',
    stepAddressCopied: 'Tersalin ✓',
    helpTitle: 'Butuh bantuan?',
    helpBody:
      'Bila tombol Muat yang belum dipak tidak terlihat, pastikan Mode pengembang sudah aktif lalu muat ulang halaman.',
    backHome: 'Kembali ke Beranda',
  },
} as const;

export type Copy = typeof copy;
