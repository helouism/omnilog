import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['favicon.svg'],
    manifest: {
      name: 'OmniLog Analytics Engine',
      short_name: 'OmniLog',
      description: 'High-performance, privacy-first, client-side log intelligence platform',
      theme_color: '#0d1117',
      background_color: '#0d1117',
      display: 'standalone',
      icons: [
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      runtimeCaching: [],
      // Zero-egress: no external caching
      navigateFallback: 'index.html',
    },
    devOptions: {
      enabled: false,
    },
  }), cloudflare()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  worker: {
    format: 'es',
  },

  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react-vendor';
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) return 'chart-vendor';
          if (id.includes('node_modules/@tanstack')) return 'virtual-vendor';
          if (id.includes('node_modules/idb')) return 'idb-vendor';
        },
      },
    },
  },

  optimizeDeps: {
    exclude: ['bootstrap-icons'],
  },

  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['import', 'if-function', 'mixed-decls', 'color-functions', 'global-builtin', 'legacy-js-api'],
      },
    },
  },
});