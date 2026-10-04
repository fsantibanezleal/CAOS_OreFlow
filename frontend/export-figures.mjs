// Writes the Methodology page's figures to docs/svg/ as standalone, theme-aware SVG files (review of 0.07.000,
// W-29). It loads the figure modules through Vite, as the app does, and never runs in a test or in CI:
// src/test/doc-figures.test.ts renders the same files and fails if a committed one differs.
//   node export-figures.mjs        (from frontend/)
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'docs', 'svg');
const server = await createServer({ root: here, configFile: false, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
try {
  const { figureFiles } = await server.ssrLoadModule('/src/content/figure-export.tsx');
  const shellCss = readFileSync(join(here, 'node_modules', '@fasl-work', 'caos-app-shell', 'styles.css'), 'utf-8');
  const productCss = readFileSync(join(here, 'src', 'content', 'content.css'), 'utf-8');
  const files = figureFiles(shellCss, productCss);
  mkdirSync(out, { recursive: true });
  for (const name of readdirSync(out)) if (name.endsWith('.svg') && !(name in files)) rmSync(join(out, name));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(out, name), text, 'utf-8');
  console.log(`docs/svg: ${Object.keys(files).length} figures`);
} finally {
  await server.close();
}
