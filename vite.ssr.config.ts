import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// SSR-only build config — intentionally excludes @cloudflare/vite-plugin
// to keep the prerender bundle simple and avoid asset-pipeline conflicts.
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    ssr: 'src/entry-server.tsx',
    outDir: 'dist/server',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      output: {
        format: 'esm',
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
