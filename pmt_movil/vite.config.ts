import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/pmt-movil/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PMT Móvil',
        short_name: 'PMT',
        description: 'Sistema de Control Vehicular',
        start_url: './',
        scope: './',
        theme_color: '#1e1b4b',
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 8080,
    host: '0.0.0.0', // Expose to all network interfaces
    proxy: {
      '^/(api|api/method|assets|files|graphql)': {
        target: 'http://127.0.0.1:8000', // Frappe backend is on the same server
        changeOrigin: true,
        secure: false,
        ws: true,
        // Rewrite the host header to match the target so Frappe doesn't complain
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Keep the original host header so Frappe knows which site to serve
            if (req.headers.host) {
              proxyReq.setHeader('Host', req.headers.host);
            }
          });
        }
      }
    }
  },
  build: {
    outDir: '../sam/public/pmt-movil',
    emptyOutDir: true,
    target: 'es2015',
  }
})
