import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['@react-pdf/renderer'],
  },
  server: {
    port: 5173,
    fs: {
      allow: [rootDir, path.resolve(rootDir, '..')],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        // Insight SSE can stay open for the full Gemini stream.
        timeout: 180_000,
        proxyTimeout: 180_000,
      },
    },
  },
});
