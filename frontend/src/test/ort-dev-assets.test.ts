import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { expect, it } from 'vitest';

it('adversarial: the development server serves the copied ONNX module unchanged', async () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const external = process.env.CAOS_TEMP_ROOT || process.env.RUNNER_TEMP;
  if (!external) throw new Error('Set CAOS_TEMP_ROOT to an external test-data directory.');
  const scratch = await mkdtemp(join(resolve(external), 'oreflow-ort-assets-'));
  const moduleName = 'ort-wasm-simd-threaded.mjs';
  const copied = await readFile(join(root, 'public/data/ort', moduleName));
  const installed = await readFile(join(root, 'node_modules/onnxruntime-web/dist', moduleName));
  const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  expect(sha(copied)).toBe(sha(installed));
  const publicDir = join(scratch, 'public');
  await mkdir(join(publicDir, 'data/ort'), { recursive: true });
  await writeFile(join(publicDir, 'data/ort', moduleName), copied);
  await writeFile(join(publicDir, 'data/ort/unrelated.mjs'), 'export default "unrelated public module";');
  const server = await createServer({
    root, publicDir, cacheDir: join(scratch, 'cache'), logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: true },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    await server.listen();
    const address = server.httpServer!.address();
    if (!address || typeof address === 'string') throw new Error('No development-server TCP address.');
    const base = `http://127.0.0.1:${address.port}`;
    for (const suffix of ['', '?import']) {
      const response = await fetch(`${base}/data/ort/${moduleName}${suffix}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toMatch(/(?:text|application)\/javascript/);
      expect(sha(new Uint8Array(await response.arrayBuffer()))).toBe(sha(copied));
    }
    expect((await fetch(`${base}/data/ort/unrelated.mjs?import`)).status).toBe(500);
  } finally {
    await server.close();
    await rm(scratch, { recursive: true, force: true });
  }
}, 30_000);
