// Product assets beyond manifests and case artifacts. Keep every exported asset inside the base copier's rebuilt public/data overlay.
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const MODEL_FILES = [
  'process_surrogate.onnx',
  'process_guard.onnx',
  'process_surrogate.json',
  'process_screen.json',
  'process_gp_cholesky.bin',
  'particle_mlp.onnx',
];
const ORT_FILES = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs'];
const EXTRA_DATA = [
  'benchmark.json', 'learning.json', 'validation.json', 'real_samples.json', 'studies.json',
  'contract/operating_contract.json', 'source/hzdr_particle_benchmark.json', 'source/geomet_lct_benchmark.json',
  'source/iron_plant_soft_sensor.json',
];

export default function copyProductAssets({ derived, out, repo, readiness }) {
  const copied = [];
  const problems = [];
  const absent = [];
  // Retire the former public/models and public/ort layout after moving those assets into the declared data overlay.
  const publicRoot = join(repo, 'frontend', 'public');
  for (const stale of ['models', 'ort', 'pyodide']) {
    const target = join(publicRoot, stale);
    if (dirname(target) !== publicRoot) problems.push(`${target} is outside the public asset root`);
    else rmSync(target, { recursive: true, force: true });
  }
  const declaredMissing = new Set((readiness?.contracts ?? []).flatMap(row => row?.state === 'partial' && Array.isArray(row.missing) ? row.missing : []));
  for (const relative of EXTRA_DATA) {
    const source = join(derived, relative);
    if (!existsSync(source)) {
      if (declaredMissing.has(relative)) absent.push(relative);
      else problems.push(`${source} is missing and is not declared absent by readiness`);
      continue;
    }
    const destination = join(out, relative);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    copied.push(relative.replaceAll('\\', '/'));
  }
  const modelRoot = process.env.OF_MODELS?.trim() || join(repo, 'models');
  const ortRoot = join(repo, 'frontend', 'node_modules', 'onnxruntime-web', 'dist');
  for (const [sourceRoot, files, targetRoot] of [
    [modelRoot, MODEL_FILES, 'models'],
    [ortRoot, ORT_FILES, 'ort'],
  ]) {
    for (const file of files) {
      const source = join(sourceRoot, file);
      const relative = join(targetRoot, file).replaceAll('\\', '/');
      if (!existsSync(source)) {
        problems.push(`${source} is missing`);
        continue;
      }
      const destination = join(out, targetRoot, file);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(source, destination);
      copied.push(relative);
    }
  }
  return { copied, absent, problems };
}
