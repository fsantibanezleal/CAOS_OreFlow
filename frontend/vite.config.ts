import react from '@vitejs/plugin-react';
import { defaultClientConditions } from 'vite';
import { defineConfig } from 'vitest/config';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Every case of the bake, for the focus route's deep links. */
function caseIds(): string[] {
  const index = join(here, '..', 'data', 'derived', 'manifests', 'index.json');
  if (!existsSync(index)) return [];
  return (JSON.parse(readFileSync(index, 'utf-8')) as { cases: Array<{ case_id: string }> }).cases.map(c => c.case_id);
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router', 'zustand'],
    // onnxruntime-web's build without an embedded WebAssembly URL: the runtime is served once, from
    // public/ort (copy-data.mjs, `wasmPaths`), instead of a second 14 MB hashed copy in the bundle
    conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions],
  },
  plugins: [react(), {
    // GitHub Pages answers a deep link with the SPA only where a file exists: every route, and the
    // focus route of every case, gets its own copy of index.html (a 404.html fallback would mount the
    // SPA with a 404 status)
    name: 'spa-pages-fallback',
    closeBundle() {
      const root = join(here, 'dist');
      const index = join(root, 'index.html');
      copyFileSync(index, join(root, '404.html'));
      const routes = ['introduction', 'methodology', 'implementation', 'experiments', 'benchmark', ...caseIds().map(id => `focus/${id}`)];
      for (const route of routes) {
        const destination = join(root, route);
        mkdirSync(destination, { recursive: true });
        copyFileSync(index, join(destination, 'index.html'));
      }
    },
  }],
  test: { environment: 'node', globals: true },
});
