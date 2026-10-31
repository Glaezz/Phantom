// DS-50: daftarkan @font-face dengan URL absolut ekstensi (browser.runtime.getURL).
// Dipakai overlay (shadow DOM) dan popup. Tidak lewat CSS karena PostCSS tidak
// bisa resolve chrome-extension:// sebagai path file.
export function fontFaceCss(): string {
  const getURL = (path: string) =>
    (browser.runtime.getURL as (p: string) => string)(path);
  const faces: Array<{ family: string; file: string; weight: number }> = [
    { family: 'Inter', file: '/fonts/Inter-400.woff2', weight: 400 },
    { family: 'Inter', file: '/fonts/Inter-600.woff2', weight: 600 },
    { family: 'Inter', file: '/fonts/Inter-700.woff2', weight: 700 },
    { family: 'JetBrains Mono', file: '/fonts/JetBrainsMono-500.woff2', weight: 500 },
  ];
  return faces
    .map(
      (f) => `@font-face {
  font-family: "${f.family}";
  src: url("${getURL(f.file)}") format("woff2");
  font-weight: ${f.weight};
  font-style: normal;
  font-display: swap;
}`,
    )
    .join('\n');
}
