import { defineConfig } from 'wxt';
import { loadEnv } from 'vite';

const icons = {
  16: '/icon/16.png',
  32: '/icon/32.png',
  48: '/icon/48.png',
  96: '/icon/96.png',
  128: '/icon/128.png',
};

const env = loadEnv(process.env.NODE_ENV === 'production' ? 'production' : 'development', process.cwd(), 'VITE_');

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Phantom',
    description: 'Penjaga Laman - verifikasi kanal resmi sebelum Anda mengirim data.',
    permissions: ['storage'],
    // Background fetch uses the same build-time proxy origin as proxyClient.
    host_permissions: [`${new URL(env.VITE_PROXY_API_URL ?? 'http://localhost:8787').origin}/*`],
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
