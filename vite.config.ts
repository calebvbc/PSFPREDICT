import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const buildVersion = process.env.VITE_APP_VERSION ?? process.env.VITE_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? 'local';

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(buildVersion),
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(buildVersion),
  },
  plugins: [react()],
  root: 'web',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
