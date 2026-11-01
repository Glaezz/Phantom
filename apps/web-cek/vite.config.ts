import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

// Proxy /api di dev/preview agar Web Cek memanggil worker secara same-origin.
// Jalankan worker lebih dulu: npm run dev:proxy (default http://127.0.0.1:8787).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8787'
  const proxy: Record<string, string | ProxyOptions> = {
    '/api': {
      target,
      changeOrigin: true,
      // Worker menolak Origin yang tidak ada di ALLOWED_ORIGINS. Untuk dev/preview,
      // permintaan ini memang same-origin lewat server Vite, jadi Origin dibuang.
      configure(proxyServer) {
        proxyServer.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
      },
    },
  }

  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  }
})
