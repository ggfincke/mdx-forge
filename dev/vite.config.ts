// dev/vite.config.ts
// Vite config for the component showcase dev server

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(import.meta.dirname),
  plugins: [react()],
  resolve: {
    alias: {
      '@forge': resolve(import.meta.dirname, '../src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
