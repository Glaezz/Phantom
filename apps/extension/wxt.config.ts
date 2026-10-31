import { defineConfig } from 'wxt';

const icons = {
  16: '/icon/16.png',
  32: '/icon/32.png',
  48: '/icon/48.png',
  96: '/icon/96.png',
  128: '/icon/128.png',
};

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Phantom',
    description: 'Penjaga Laman - verifikasi kanal resmi sebelum Anda mengirim data.',
    permissions: ['storage'],
    // Dev proxy (L3/L4). Tanpa ini fetch content script ke localhost diblokir browser.
    host_permissions: ['http://localhost:8787/*'],
    icons,
    action: { default_icon: icons },
    web_accessible_resources: [
      {
        resources: ['fonts/*.woff2', 'content-scripts/overlay.css'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
