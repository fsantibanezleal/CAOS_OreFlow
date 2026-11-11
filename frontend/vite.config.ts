import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { defaultClientConditions } from 'vite';
import { defineConfig } from 'vitest/config';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEME_BOOT_SCRIPT } from '@fasl-work/caos-app-shell/keys';

const here = dirname(fileURLToPath(import.meta.url));
const root = new URL('..', import.meta.url);
const VERSION = readFileSync(new URL('VERSION', root), 'utf8').trim();
function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try { return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return 'unknown'; }
}
const SHA = commit();

export default defineConfig({
  // OreFlow is served from one place, its VPS, at the site root (the plan's vps-service): no base path
  base: '/',
  // the port imports the Python engine's data files and the release VERSION from outside frontend/: the
  // dev server may serve the repository, and nothing wider, whatever Vite's default search finds
  server: { fs: { allow: [join(here, '..')] } },
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router', 'zustand'],
    // onnxruntime-web's build without an embedded WebAssembly URL: the runtime is served once, from
    // public/data/ort (copy-data.product.mjs, `wasmPaths`), instead of a second 14 MB hashed copy in the bundle
    conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions],
  },
  plugins: [react(), {
    name: 'caos-prepaint-theme',
    transformIndexHtml: (html) => html.replace('<!--caos-boot-->', `<script>${THEME_BOOT_SCRIPT}</script>`),
  }, {
    name: 'caos-build-json',
    apply: 'build',
    writeBundle() {
      writeFileSync(new URL('frontend/dist/build.json', root), `${JSON.stringify({ version: VERSION, sha: SHA, built: new Date().toISOString() }, null, 2)}\n`);
    },
  }, {
    name: 'oreflow-local-onnx-module',
    apply: 'serve',
    configureServer(server) {
      // ONNX imports this copied ESM module by URL. Delegate its bytes to Vite's public middleware.
      const modulePath = '/data/ort/ort-wasm-simd-threaded.mjs';
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
  define: {
    __APP_VERSION__: JSON.stringify(VERSION),
    __BUILD_ID__: JSON.stringify(SHA.slice(0, 7)),
  },
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
