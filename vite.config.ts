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
        // Match on a full package-directory boundary. A bare `includes('node_modules/react')`
        // also matches `node_modules/react-chartjs-2`, which dragged chart.js into the
        // eagerly-preloaded react-vendor chunk.
        //
        // chart.js / react-chartjs-2 are deliberately absent: naming a manual chunk for them
        // makes Vite emit a <link rel="modulepreload"> for it in the entry HTML, so every
        // page — including /about and /privacy, which never draw a chart — downloaded and
        // compiled ~198 kB of chart code up front, defeating the React.lazy boundary in
        // MainPage. Left unlisted, they land in the async Charts chunk instead.
        manualChunks(id) {
          if (!id.includes('node_modules/')) return;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react-vendor';
          if (/node_modules\/@tanstack\//.test(id)) return 'virtual-vendor';
          if (/node_modules\/idb\//.test(id)) return 'idb-vendor';
          if (/node_modules\/(react-markdown|remark|rehype|unified|micromark|mdast|hast)[^/]*\//.test(id)) return 'markdown-vendor';
        },
      },
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['import', 'if-function', 'mixed-decls', 'color-functions', 'global-builtin', 'legacy-js-api'],
      },
    },
  },
});