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
  plugins: [react(), {
    name: 'oreflow-local-onnx-module',
    apply: 'serve',
    configureServer(server) {
      // ONNX imports this copied ESM module by URL. Delegate its bytes to Vite's public middleware.
      const modulePath = '/ort/ort-wasm-simd-threaded.mjs';
      server.middlewares.use((request, _response, next) => {
        if (request.url?.startsWith(`${modulePath}?`)) {
          const query = new URLSearchParams(request.url.slice(modulePath.length + 1));
          if (query.has('import')) {
            query.delete('import');
            const remaining = query.toString();
            request.url = modulePath + (remaining ? `?${remaining}` : '');
          }
        }
        next();
      });
    },
  }],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20, includeDependenciesRecursively: false },
            { name: 'math-vendor', test: /node_modules[\\/]katex[\\/]/, priority: 10, includeDependenciesRecursively: false },
          ],
        },
      },
    },
  },
  test: { environment: 'node', globals: true },
});
