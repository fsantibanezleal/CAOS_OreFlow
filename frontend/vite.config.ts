import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), {
    name: 'spa-pages-fallback',
    closeBundle() {
      const root = join(here, 'dist');
      const index = join(root, 'index.html');
      copyFileSync(index, join(root, '404.html'));
      for (const route of ['introduction', 'methodology', 'implementation', 'experiments', 'benchmark']) {
        const destination = join(root, route);
        mkdirSync(destination, { recursive: true });
        copyFileSync(index, join(destination, 'index.html'));
      }
    },
  }],
  test: { environment: 'node', globals: true },
});
