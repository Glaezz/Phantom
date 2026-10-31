import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Phantom',
    description: 'Penjaga Laman — verifikasi kanal resmi sebelum Anda mengirim data.',
    permissions: ['storage'],
    web_accessible_resources: [
      {
        resources: ['fonts/*.woff2'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
