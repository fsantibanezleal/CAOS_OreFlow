/**
 * Copies the baked artifacts into public/ for the dev server and the build: data/derived as data/, the
 * exported ONNX models with their scaler documents as models/, and the onnxruntime-web WebAssembly
 * runtime as ort/. Every target is emptied first, so a file the bake no longer writes can never ship
 * from an older copy.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PUB = join(HERE, 'public');

function fresh(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

const derived = join(ROOT, 'data', 'derived');
if (!existsSync(join(derived, 'manifests', 'index.json'))) throw new Error('data/derived has no manifests/index.json: run the bake first');
cpSync(derived, fresh(join(PUB, 'data')), { recursive: true });

const models = join(ROOT, 'models');
const modelsOut = fresh(join(PUB, 'models'));
for (const file of readdirSync(models)) {
  if (file.endsWith('.onnx') || file.endsWith('.json')) cpSync(join(models, file), join(modelsOut, file));
}

const ort = join(HERE, 'node_modules', 'onnxruntime-web', 'dist');
const ortOut = fresh(join(PUB, 'ort'));
for (const file of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) cpSync(join(ort, file), join(ortOut, file));

rmSync(join(PUB, 'pyodide'), { recursive: true, force: true });
