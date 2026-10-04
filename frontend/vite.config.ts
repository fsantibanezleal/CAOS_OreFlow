import react from '@vitejs/plugin-react';
import { defaultClientConditions } from 'vite';
import { defineConfig } from 'vitest/config';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // OreFlow is served from one place, its VPS, at the site root (the plan's vps-service): no base path
  base: '/',
  // the port imports the Python engine's data files and the release VERSION from outside frontend/: the
  // dev server may serve the repository, and nothing wider, whatever Vite's default search finds
  server: { fs: { allow: [join(here, '..')] } },
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router', 'zustand'],
    // onnxruntime-web's build without an embedded WebAssembly URL: the runtime is served once, from
    // public/ort (copy-data.mjs, `wasmPaths`), instead of a second 14 MB hashed copy in the bundle
    conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions],
  },
  plugins: [react()],
  test: { environment: 'node', globals: true },
});
