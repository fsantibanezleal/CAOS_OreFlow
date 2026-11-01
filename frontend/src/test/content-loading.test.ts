import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import react from '@vitejs/plugin-react';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';

const frontend = fileURLToPath(new URL('../..', import.meta.url));
type Request = { response?: ServerResponse; requested: Promise<void>; arrived: () => void };
const requests = new Map<string, Request>();
let scratch: string;
let server: ViteDevServer;
let browser: Browser;
let base: string;
let run = 0;

function pending(path: string) {
  let arrived!: () => void;
  const requested = new Promise<void>(resolve => { arrived = resolve; });
  const request = { requested, arrived };
  requests.set(path, request);
  return request;
}

function answer(path: string, status = 200) {
  const request = requests.get(path);
  if (!request?.response) throw new Error(`No real artifact request: ${path}`);
  request.response.writeHead(status, { 'Content-Type': 'application/json' });
  request.response.end(JSON.stringify({ name: path.endsWith('/first.json') ? 'first' : 'second', value: 17 }));
  requests.delete(path);
}

beforeAll(async () => {
  const external = process.env.CAOS_TEMP_ROOT || process.env.RUNNER_TEMP;
  if (!external) throw new Error('Set CAOS_TEMP_ROOT to an external fixture root.');
  scratch = await mkdtemp(join(resolve(external), 'oreflow-content-loading-'));
  await mkdir(join(scratch, 'cache'));
  await writeFile(join(scratch, 'fixture.tsx'), `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { Loaded, useArtifact } from '/src/content/data.tsx';
    const query = new URLSearchParams(location.search);
    const lang = query.get('lang'), run = query.get('run');
    const load = name => async () => {
      const response = await fetch('/controlled/' + run + '/' + name + '.json');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    };
    const first = load('first'), second = load('second');
    function Panel({name, loader}) {
      const artifact = useArtifact(loader);
      return <Loaded lang={lang} errors={[artifact.error]} ready={Boolean(artifact.value)}>
        {() => <p data-testid={name + '-record'}>{artifact.value.name}: {artifact.value.value}</p>}
      </Loaded>;
    }
    createRoot(document.getElementById('root')).render(<main data-brand="OreFlow">
      <Panel name="first" loader={first}/><Panel name="second" loader={second}/>
    </main>);
  `);
  server = await createServer({
    root: frontend, configFile: false, publicDir: false, cacheDir: join(scratch, 'cache'), logLevel: 'silent',
    plugins: [react(), { name: 'controlled-loading-fixture', configureServer(vite) {
      vite.middlewares.use(async (request, response, next) => {
        const path = new URL(request.url!, 'http://localhost').pathname;
        const held = requests.get(path);
        if (held) { held.response = response; held.arrived(); return; }
        if (path !== '/loading-fixture') { next(); return; }
        response.setHeader('Content-Type', 'text/html');
        try {
          response.end(await vite.transformIndexHtml('/loading-fixture', '<!doctype html><html><body><div id="root"></div><script type="module" src="/@fs/'
            + join(scratch, 'fixture.tsx').replaceAll('\\', '/') + '"></script></body></html>'));
        } catch (error) { next(error); }
      });
    } }],
    resolve: { dedupe: ['react', 'react-dom'], alias: [
      { find: /^react$/, replacement: join(frontend, 'node_modules/react/index.js') },
      { find: /^react\/jsx-runtime$/, replacement: join(frontend, 'node_modules/react/jsx-runtime.js') },
      { find: /^react-dom\/client$/, replacement: join(frontend, 'node_modules/react-dom/client.js') },
    ] },
    optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-runtime'] },
    server: { host: '127.0.0.1', port: 0, strictPort: true, fs: { allow: [frontend, scratch] } },
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('No fixture TCP address.');
  base = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch();
}, 30_000);

afterAll(async () => {
  for (const path of requests.keys()) if (requests.get(path)?.response) answer(path, 503);
  await browser?.close();
  await server?.close();
  if (scratch) await rm(scratch, { recursive: true, force: true });
});

async function open(lang: 'en' | 'es', check: (page: Page, first: string, second: string) => Promise<void>) {
  const prefix = `/controlled/${++run}`, first = `${prefix}/first.json`, second = `${prefix}/second.json`;
  const initial = [pending(first), pending(second)];
  const page = await browser.newPage();
  const { installLib } = await import(pathToFileURL(join(frontend, 'node_modules/@fasl-work/caos-app-shell/gate/inpage.mjs')).href);
  await page.addInitScript(installLib);
  try {
    await page.goto(`${base}/loading-fixture?lang=${lang}&run=${run}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('status').first().waitFor({ timeout: 5000 });
    await Promise.all(initial.map(request => request.requested));
    await check(page, first, second);
  } finally {
    for (const path of [first, second]) if (requests.get(path)?.response) answer(path, 503);
    await page.close();
  }
}

const ready = (page: Page) => page.evaluate(() => (window as unknown as { __caosGate: { ready: () => string } }).__caosGate.ready());

it('adversarial: pending document artifacts keep shared readiness busy in English and Spanish', async () => {
  for (const lang of ['en', 'es'] as const) await open(lang, async (page, first, second) => {
    expect(await page.getByRole('status').allTextContents()).toEqual(Array(2).fill(lang === 'en'
      ? 'Loading the precomputed results...' : 'Cargando los resultados precalculados...'));
    expect(await ready(page)).toMatch(/2 element\(s\).*loading/);
    expect(await page.locator('[data-testid]').count()).toBe(0);
    answer(first);
    await page.getByTestId('first-record').waitFor();
    expect(await ready(page)).toMatch(/1 element\(s\).*loading/);
    expect(await page.getByTestId('second-record').count()).toBe(0);
    answer(second);
    await page.getByTestId('second-record').waitFor();
    expect(await page.getByTestId('second-record').textContent()).toBe('second: 17');
    expect(await page.getByRole('status').count()).toBe(0);
    expect(await ready(page)).toBe('');
  });
}, 30_000);

it('adversarial: failed artifacts retain bilingual alerts and independent pending state', async () => {
  for (const lang of ['en', 'es'] as const) await open(lang, async (page, first, second) => {
    answer(first, 503);
    await page.getByRole('alert').waitFor();
    expect(await page.getByRole('alert').textContent()).toBe((lang === 'en'
      ? 'The precomputed results could not be loaded' : 'No se pudieron cargar los resultados precalculados') + ': Error: HTTP 503');
    expect(await page.getByTestId('first-record').count()).toBe(0);
    expect(await ready(page)).toMatch(/1 element\(s\).*loading/);
    answer(second);
    await page.getByTestId('second-record').waitFor();
    expect(await page.getByRole('alert').count()).toBe(1);
    expect(await page.getByRole('status').count()).toBe(0);
    expect(await ready(page)).toBe('');
  });
}, 30_000);
