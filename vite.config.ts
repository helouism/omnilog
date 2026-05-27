import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],

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