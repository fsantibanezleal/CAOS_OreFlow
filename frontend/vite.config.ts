import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), {
    name: 'spa-pages-fallback',
    closeBundle() { copyFileSync(join(here, 'dist', 'index.html'), join(here, 'dist', '404.html')); },
  }],
  test: { environment: 'node', globals: true },
});
