import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PUB = join(HERE, 'public');
const derived = join(ROOT, 'data', 'derived');
if (existsSync(derived)) { mkdirSync(join(PUB, 'data'), { recursive: true }); cpSync(derived, join(PUB, 'data'), { recursive: true }); }
const models = join(ROOT, 'models');
if (existsSync(models)) { mkdirSync(join(PUB, 'models'), { recursive: true }); for (const file of readdirSync(models)) if (file.endsWith('.onnx') || file === 'registry.json') cpSync(join(models, file), join(PUB, 'models', file)); }
const ort = join(HERE, 'node_modules', 'onnxruntime-web', 'dist');
if (existsSync(ort)) {
  mkdirSync(join(PUB, 'ort'), { recursive: true });
  for (const file of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) cpSync(join(ort, file), join(PUB, 'ort', file));
}
const pkg = join(ROOT, 'data-pipeline', 'pipeline');
if (existsSync(pkg)) {
  const sources = {};
  const walk = (dir, rel = '') => { for (const e of readdirSync(dir, { withFileTypes: true })) { if (e.name === '__pycache__') continue; const abs = join(dir, e.name); const r = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) walk(abs, r); else if (e.name.endsWith('.py')) sources[`pipeline/${r}`] = readFileSync(abs, 'utf8'); } };
  walk(pkg); mkdirSync(join(PUB, 'pyodide'), { recursive: true }); writeFileSync(join(PUB, 'pyodide', 'sources.json'), JSON.stringify(sources));
}
