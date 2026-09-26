/**
 * OreFlow's browser gate (design §12.3; ADR-0070, ADR-0071), run against a served build:
 *
 *   npm run build && npm run preview        (serves on 127.0.0.1:4914)
 *   OF_MATRIX=full node gate.mjs            (smoke: two viewport, theme and language combinations)
 *
 * For every combination it opens the App route, visits every view and every Methods record, runs the
 * Response and learned-lane sweeps, and measures what ADR-0071 binds: no document scroll either way, a
 * rail that shows its own controls, one tab row, the instrument (the active view) at least half the
 * viewport, `<html lang>` equal to the interface language, and no console error. Then it enters the
 * focus route by clicking, measures the stage (at least 80%), and returns by clicking to the same
 * state. A screenshot of every view lands in OF_QA (default `qa-output/`, ignored by git); the
 * measurements are written to `gate.json` there. Exit 1 on any failure.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.OF_BASE || 'http://127.0.0.1:4914';
const OUT = process.env.OF_QA || 'qa-output';
const CASE = process.env.OF_CASE || 'copper_porphyry_soft';
const FULL = process.env.OF_MATRIX === 'full';
const VIEWPORTS = [[1280, 800], [1600, 900], [2560, 1440]];
const COMBOS = FULL
  ? VIEWPORTS.flatMap(v => ['dark', 'light'].flatMap(theme => ['en', 'es'].map(lang => ({ v, theme, lang }))))
  : [{ v: [1280, 800], theme: 'dark', lang: 'en' }, { v: [1600, 900], theme: 'light', lang: 'es' }];
const VIEWS = ['circuit', 'grinding', 'separation', 'response', 'methods', 'case'];
const PAGES = (process.env.OF_PAGES ?? 'introduction,methodology,implementation,experiments,benchmark').split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });

const results = [];
let failures = 0;
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` ${JSON.stringify(detail)}` : ''}`);
};

async function measure(page, stageSelector) {
  return page.evaluate(selector => {
    const de = document.documentElement;
    const area = el => { if (!el) return 0; const r = el.getBoundingClientRect(); return r.width * r.height; };
    const viewport = innerWidth * innerHeight;
    const rail = document.querySelector('.of-rail');
    const tabs = [...document.querySelectorAll('.of-viewbar [role=tab]')].map(b => Math.round(b.getBoundingClientRect().top));
    const scope = selector ? document.querySelector(selector) : document;
    const viz = scope ? Math.max(0, ...[...scope.querySelectorAll('canvas, svg.of-flowmap')].map(area)) : 0;
    return {
      overX: de.scrollWidth > innerWidth + 1, overY: de.scrollHeight > innerHeight + 2,
      railScrolls: rail ? rail.scrollHeight > rail.clientHeight + 2 : null,
      tabRows: new Set(tabs).size,
      instrument: +(area(document.querySelector('.of-view-host')) / viewport).toFixed(3),
      stage: selector ? +(area(document.querySelector(selector)) / viewport).toFixed(3) : null,
      largestViz: +(viz / viewport).toFixed(3),
      lang: de.lang,
    };
  }, stageSelector ?? null);
}

async function settleCharts(page, minimum = 1) {
  await page.waitForFunction(n => document.querySelectorAll('.of-view-host canvas, .of-view-host svg.of-flowmap').length >= n, minimum, { timeout: 60000 });
  await page.waitForTimeout(250);
}

const browser = await chromium.launch();
for (const { v: [w, h], theme, lang } of COMBOS) {
  const tag = `${w}x${h}-${theme}-${lang}`;
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  await context.addInitScript(([t, l]) => { localStorage.setItem('caos.theme', t); localStorage.setItem('caos.lang', l); }, [theme, lang]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto(`${BASE}/?case=${CASE}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForSelector('.of-readout-item strong', { timeout: 90000 });
  for (const [index, view] of VIEWS.entries()) {
    await page.locator('.of-viewbar [role=tab]').nth(index).click();
    if (view === 'response') {
      await page.locator('.of-view-response .of-cta').click();
      await page.waitForFunction(() => { const p = document.querySelector('.of-progress'); if (!p) return false; const [a, b] = p.textContent.split('/').map(s => parseInt(s, 10)); return a === b; }, null, { timeout: 120000 });
    }
    if (view === 'case') {
      const subtabs = page.locator('.of-view-case .subtablist [role=tab]');
      for (let k = 0; k < await subtabs.count(); k += 1) {
        await subtabs.nth(k).click();
        const name = (await subtabs.nth(k).textContent()).trim();
        if (k === 0) await page.waitForSelector('.of-context .katex', { timeout: 60000 });
        else await settleCharts(page, 2);
        const m = await measure(page);
        const ok = !m.overX && !m.overY && m.railScrolls === false && m.tabRows === 1 && m.instrument >= 0.5 && m.lang === lang;
        record(`${tag} case/${name}`, ok, m);
        await page.screenshot({ path: join(OUT, `case-${k + 1}-${tag}.png`) });
      }
      continue;
    }
    if (view === 'methods') {
      const subtabs = page.locator('.of-view-methods .subtablist [role=tab]');
      const count = await subtabs.count();
      for (let k = 0; k < count; k += 1) {
        await subtabs.nth(k).click();
        const name = (await subtabs.nth(k).textContent()).trim();
        if (k === count - 1) {
          await page.waitForFunction(() => !document.querySelector('.of-view-methods .of-run')?.disabled, null, { timeout: 60000 });
          await page.locator('.of-view-methods .of-run').click();
          await settleCharts(page, 2);
        } else {
          await settleCharts(page, 1);
        }
        const m = await measure(page);
        const ok = !m.overX && !m.overY && m.railScrolls === false && m.tabRows === 1 && m.instrument >= 0.5 && m.lang === lang;
        record(`${tag} methods/${name}`, ok, m);
        await page.screenshot({ path: join(OUT, `methods-${k + 1}-${tag}.png`) });
      }
      continue;
    }
    await settleCharts(page, 1);
    const m = await measure(page);
    const ok = !m.overX && !m.overY && m.railScrolls === false && m.tabRows === 1 && m.instrument >= 0.5 && m.lang === lang;
    record(`${tag} ${view}`, ok, m);
    await page.screenshot({ path: join(OUT, `${view}-${tag}.png`) });
  }

  // the focus round trip, by clicking; the state (case, variant and changed controls) must survive it
  await page.locator('.of-viewbar [role=tab]').nth(0).click();
  const before = new URL(page.url()).searchParams;
  await page.locator('.of-focus-open').click();
  await page.waitForSelector('.caos-focus-shell', { timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('.caos-focus-stage canvas, .caos-focus-stage svg.of-flowmap').length > 0, null, { timeout: 60000 });
  await page.waitForTimeout(300);
  const focus = await measure(page, '.caos-focus-stage');
  record(`${tag} focus`, focus.stage >= 0.8 && focus.largestViz >= 0.8 && !focus.overX && !focus.overY && focus.lang === lang, focus);
  await page.screenshot({ path: join(OUT, `focus-${tag}.png`) });
  await page.locator('.caos-focus-actions button').last().click();
  await page.waitForSelector('.of-bench .of-readout-item strong', { timeout: 60000 });
  const after = new URL(page.url()).searchParams;
  const same = ['case', 'variant', 'set'].every(key => (before.get(key) ?? '') === (after.get(key) ?? ''));
  record(`${tag} focus round trip`, same, { before: before.toString(), after: after.toString() });

  // the content pages keep the document scroll (ADR-0071 rule 1 binds the App route); they must not
  // scroll sideways, must carry the interface language, and every Methodology topic is screenshotted
  for (const route of PAGES) {
    await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForSelector('.page-body, .of-page', { timeout: 60000 });
    await page.waitForTimeout(300);
    const shots = [];
    const topTabs = page.locator('.page-body .tablist [role=tab]');
    const groups = route === 'methodology' ? await topTabs.count() : 0;
    if (groups === 0) shots.push(route);
    for (let g = 0; g < groups; g += 1) {
      await topTabs.nth(g).click();
      const subTabs = page.locator('.page-body .tabpanel:not([hidden]) .subtablist [role=tab]');
      const count = Math.max(1, await subTabs.count());
      for (let k = 0; k < count; k += 1) {
        if (await subTabs.count()) await subTabs.nth(k).click();
        await page.waitForTimeout(150);
        const doc = await page.evaluate(() => ({ overX: document.documentElement.scrollWidth > innerWidth + 1, lang: document.documentElement.lang,
          katexErrors: document.querySelectorAll('.katex-error').length }));
        record(`${tag} ${route} ${g + 1}.${k + 1}`, !doc.overX && doc.lang === lang && doc.katexErrors === 0, doc);
        await page.screenshot({ path: join(OUT, `${route}-${g + 1}-${k + 1}-${tag}.png`) });
      }
    }
    for (const shot of shots) {
      const doc = await page.evaluate(() => ({ overX: document.documentElement.scrollWidth > innerWidth + 1, lang: document.documentElement.lang,
        katexErrors: document.querySelectorAll('.katex-error').length }));
      record(`${tag} ${shot}`, !doc.overX && doc.lang === lang && doc.katexErrors === 0, doc);
      await page.screenshot({ path: join(OUT, `${shot}-${tag}.png`), fullPage: true });
    }
  }

  record(`${tag} console`, errors.length === 0, errors.slice(0, 5));
  await context.close();
}
await browser.close();
writeFileSync(join(OUT, 'gate.json'), JSON.stringify({ base: BASE, case: CASE, full: FULL, results }, null, 1));
console.log(failures ? `\nGATE FAILED: ${failures} check(s)` : `\nGATE PASSED: ${results.length} checks`);
process.exit(failures ? 1 : 0);
