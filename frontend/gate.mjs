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

// The shell makes <body> the scroll container (html and body at height 100% with overflow-x hidden),
// so the document never reports a sideways overflow: content past the right edge is clipped, not
// scrolled. Measure the boxes instead: any visible element outside the viewport, unless it sits inside a
// deliberate scroll area (overflow-x auto or scroll), whose own box must then fit.
const OVERFLOW_PROBE = () => {
  const offenders = [];
  const scrollsX = el => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
    if (el.closest('.sr-only, .of-sr-only, .katex-mathml')) continue;
    if ((r.right > innerWidth + 1 || r.left < -1) && !scrollsX(el)) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.left)}..${Math.round(r.right)}`);
    if (offenders.length >= 5) break;
  }
  return offenders;
};

// Inside a sized view, content past the view's own box is clipped out of reach unless a scroll area
// inside the view owns it (ADR-0071 rule 1). Charts' own overlays are part of their plot box.
const CLIP_PROBE = selector => {
  const host = document.querySelector(selector);
  if (!host) return [];
  const hb = host.getBoundingClientRect();
  const scrolls = el => { for (let a = el.parentElement; a && a !== host; a = a.parentElement) { const cs = getComputedStyle(a); if (['auto', 'scroll'].includes(cs.overflowY) || ['auto', 'scroll'].includes(cs.overflowX)) return true; } return false; };
  const out = [];
  for (const el of host.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
    if (el.closest('.sr-only, .of-sr-only, .katex-mathml, .u-cursor-pt, .u-cursor-x, .u-cursor-y, .u-select')) continue;
    if ((r.bottom > hb.bottom + 1 || r.right > hb.right + 1) && !scrolls(el)) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} bottom ${Math.round(r.bottom)} of ${Math.round(hb.bottom)}, right ${Math.round(r.right)} of ${Math.round(hb.right)}`);
    if (out.length >= 5) break;
  }
  return out;
};

// A schematic's text must stay inside the box that holds it and inside its figure: a translation that
// runs longer than its box is the commonest way a figure breaks without anyone touching the drawing.
const FIGURE_PROBE = () => {
  const out = [];
  for (const svg of document.querySelectorAll('svg.fig-svg')) {
    const fr = svg.getBoundingClientRect();
    if (fr.width === 0) continue;
    const boxes = [...svg.querySelectorAll('rect.dg-box')].map(r => r.getBoundingClientRect());
    for (const t of svg.querySelectorAll('text')) {
      const b = t.getBoundingClientRect();
      if (b.width === 0) continue;
      const name = (t.textContent || '').slice(0, 40);
      if (b.left < fr.left - 1 || b.right > fr.right + 1 || b.top < fr.top - 1 || b.bottom > fr.bottom + 1) out.push(`outside its figure: ${name}`);
      // a text that touches a box must lie wholly inside it: a label running past its box's side or
      // hanging below its bottom edge is cut by the box outline
      const inside = r => b.left >= r.left - 1 && b.right <= r.right + 1 && b.top >= r.top - 1 && b.bottom <= r.bottom + 1;
      const touches = r => Math.min(b.right, r.right) - Math.max(b.left, r.left) > 1 && Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top) > 1;
      if (boxes.some(r => touches(r) && !inside(r)) && !boxes.some(r => touches(r) && inside(r) && boxes.every(o => o === r || !touches(o) || inside(o)))) out.push(`crosses a box: ${name}`);
      if (out.length >= 5) return out;
    }
  }
  return out;
};

// The architecture modal (ADR-0058): each tab must inline its diagram, show exactly the interface
// language's text (a gate that measured English twice once reported a clean bilingual pass), keep every
// text inside the diagram, and let no text touch a box it does not fit inside.
const ARCH_PROBE = () => {
  const svg = document.querySelector('.caos-architecture-diagram svg');
  if (!svg) return { svg: false };
  const fr = svg.getBoundingClientRect();
  const visible = t => { const b = t.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const texts = [...svg.querySelectorAll('text')].filter(visible);
  const boxes = [...svg.querySelectorAll('rect.bx')].map(r => r.getBoundingClientRect());
  const out = [];
  for (const t of texts) {
    const b = t.getBoundingClientRect();
    const name = (t.textContent || '').slice(0, 50);
    if (b.left < fr.left - 1 || b.right > fr.right + 1 || b.top < fr.top - 1 || b.bottom > fr.bottom + 1) out.push(`outside the diagram: ${name}`);
    const inside = r => b.left >= r.left - 1 && b.right <= r.right + 1 && b.top >= r.top - 1 && b.bottom <= r.bottom + 1;
    const touches = r => Math.min(b.right, r.right) - Math.max(b.left, r.left) > 1 && Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top) > 1;
    if (boxes.some(r => touches(r) && !inside(r))) out.push(`crosses a box: ${name}`);
    if (out.length >= 6) break;
  }
  return { svg: true, en: texts.filter(t => t.classList.contains('l-en')).length, es: texts.filter(t => t.classList.contains('l-es')).length,
    neutral: texts.filter(t => t.classList.contains('l-neutral')).length, untagged: texts.filter(t => !/\bl-(en|es|neutral)\b/.test(t.getAttribute('class') || '')).length, out };
};

async function checkArchitecture(page, tag, lang) {
  await page.locator('header button[aria-label^="Architecture"], header button[aria-label^="Arquitectura"]').first().click();
  await page.waitForSelector('[role=dialog] [role=tab]', { timeout: 30000 });
  const tabs = page.locator('[role=dialog] [role=tab]');
  const count = await tabs.count();
  record(`${tag} architecture tabs`, count >= 5, { count });
  for (let k = 0; k < count; k += 1) {
    await tabs.nth(k).click();
    await page.waitForFunction(() => document.querySelector('.caos-architecture-diagram svg'), null, { timeout: 30000 });
    await page.waitForTimeout(250);
    const a = await page.evaluate(ARCH_PROBE);
    const own = lang === 'es' ? a.es : a.en, other = lang === 'es' ? a.en : a.es;
    record(`${tag} architecture ${k + 1}`, a.svg && own > 5 && other === 0 && a.untagged === 0 && a.out.length === 0, a);
    await page.screenshot({ path: join(OUT, `architecture-${k + 1}-${tag}.png`) });
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[role=dialog]'), null, { timeout: 10000 });
}

async function measure(page, stageSelector) {
  const outside = await page.evaluate(OVERFLOW_PROBE);
  const clipped = await page.evaluate(CLIP_PROBE, stageSelector ?? '.of-view-host');
  // an equation wider than its box (the Case view's context shows the family's formulas in a side column)
  const cut = await page.evaluate(() => [...document.querySelectorAll('.katex-display')].filter(e => e.getBoundingClientRect().width > 0 && e.scrollWidth > e.clientWidth + 1).length);
  const m = await page.evaluate(selector => {
    const de = document.documentElement;
    const area = el => { if (!el) return 0; const r = el.getBoundingClientRect(); return r.width * r.height; };
    const viewport = innerWidth * innerHeight;
    const rail = document.querySelector('.of-rail');
    const tabs = [...document.querySelectorAll('.of-viewbar [role=tab]')].map(b => Math.round(b.getBoundingClientRect().top));
    const scope = selector ? document.querySelector(selector) : document;
    const viz = scope ? Math.max(0, ...[...scope.querySelectorAll('canvas, svg.of-flowmap')].map(area)) : 0;
    return {
      overX: de.scrollWidth > innerWidth + 1 || document.body.scrollWidth > document.body.clientWidth + 1, overY: de.scrollHeight > innerHeight + 2,
      railScrolls: rail ? rail.scrollHeight > rail.clientHeight + 2 : null,
      tabRows: new Set(tabs).size,
      instrument: +(area(document.querySelector('.of-view-host')) / viewport).toFixed(3),
      stage: selector ? +(area(document.querySelector(selector)) / viewport).toFixed(3) : null,
      largestViz: +(viz / viewport).toFixed(3),
      lang: de.lang,
    };
  }, stageSelector ?? null);
  return { ...m, outside, clipped, cut, fits: outside.length === 0 && clipped.length === 0 && cut === 0 };
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
        const ok = !m.overX && m.fits && !m.overY && m.railScrolls === false && m.tabRows === 1 && m.instrument >= 0.5 && m.lang === lang;
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
        const ok = !m.overX && m.fits && !m.overY && m.railScrolls === false && m.tabRows === 1 && m.instrument >= 0.5 && m.lang === lang;
        record(`${tag} methods/${name}`, ok, m);
        await page.screenshot({ path: join(OUT, `methods-${k + 1}-${tag}.png`) });
      }
      continue;
    }
    await settleCharts(page, 1);
    const m = await measure(page);
    const ok = !m.overX && m.fits && !m.overY && m.railScrolls === false && m.tabRows === 1 && m.instrument >= 0.5 && m.lang === lang;
    record(`${tag} ${view}`, ok, m);
    await page.screenshot({ path: join(OUT, `${view}-${tag}.png`) });
  }

  await checkArchitecture(page, tag, lang);

  // the focus round trip, by clicking; the state (case, variant and changed controls) must survive it
  await page.locator('.of-viewbar [role=tab]').nth(0).click();
  const before = new URL(page.url()).searchParams;
  await page.locator('.of-focus-open').click();
  await page.waitForSelector('.caos-focus-shell', { timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('.caos-focus-stage canvas, .caos-focus-stage svg.of-flowmap').length > 0, null, { timeout: 60000 });
  await page.waitForTimeout(300);
  const focus = await measure(page, '.caos-focus-stage');
  record(`${tag} focus`, focus.stage >= 0.8 && focus.largestViz >= 0.8 && !focus.overX && focus.fits && !focus.overY && focus.lang === lang, focus);
  await page.screenshot({ path: join(OUT, `focus-${tag}.png`) });
  await page.locator('.caos-focus-actions button').last().click();
  await page.waitForSelector('.of-bench .of-readout-item strong', { timeout: 60000 });
  const after = new URL(page.url()).searchParams;
  const same = ['case', 'variant', 'set'].every(key => (before.get(key) ?? '') === (after.get(key) ?? ''));
  record(`${tag} focus round trip`, same, { before: before.toString(), after: after.toString() });

  // the content pages keep the document scroll (ADR-0071 rule 1 binds the App route); every tab and
  // sub-tab of every page must not scroll sideways, must carry the interface language, must render its
  // equations, and must have loaded the baked results it reads (a failed load renders an alert)
  for (const route of PAGES) {
    await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForSelector('.page-body, .of-page', { timeout: 60000 });
    const topTabs = page.locator('.page-body .tablist [role=tab]');
    const groups = await topTabs.count();
    for (let g = 0; g < Math.max(1, groups); g += 1) {
      if (groups) await topTabs.nth(g).click();
      const subTabs = page.locator('.page-body .tabpanel:not([hidden]) .subtablist [role=tab]');
      const count = Math.max(1, await subTabs.count());
      for (let k = 0; k < count; k += 1) {
        if (await subTabs.count()) await subTabs.nth(k).click();
        await page.waitForFunction(() => !document.querySelector('.of-doc-state[role=status]'), null, { timeout: 60000 });
        // a page that runs a network in the browser on request is exercised: the result must be drawn
        const run = page.locator('.page-body .tabpanel:not([hidden]) .of-doc-run');
        if (await run.count() && await run.first().isVisible()) {
          await run.first().click();
          await page.waitForSelector('.of-doc-inference canvas', { timeout: 60000 });
        }
        await page.waitForTimeout(200);
        const outside = await page.evaluate(OVERFLOW_PROBE);
        const figures = await page.evaluate(FIGURE_PROBE);
        const doc = await page.evaluate(() => ({ overX: document.body.scrollWidth > document.body.clientWidth + 1, lang: document.documentElement.lang,
          katexErrors: document.querySelectorAll('.katex-error').length, loadErrors: document.querySelectorAll('.of-doc-state[role=alert]').length,
          // an equation wider than its box can only be read by scrolling inside it
          cutEquations: [...document.querySelectorAll('.katex-display')].filter(e => e.getBoundingClientRect().width > 0 && e.scrollWidth > e.clientWidth + 1).length }));
        record(`${tag} ${route} ${g + 1}.${k + 1}`, !doc.overX && outside.length === 0 && figures.length === 0 && doc.lang === lang && doc.katexErrors === 0 && doc.loadErrors === 0 && doc.cutEquations === 0, { ...doc, outside, figures });
        // a full-page capture stops at the body's scroll box; release it for the capture only
        const unclip = await page.addStyleTag({ content: 'html, body, #root { height: auto !important; overflow: visible !important; }' });
        await page.screenshot({ path: join(OUT, `${route}-${g + 1}-${k + 1}-${tag}.png`), fullPage: true });
        await unclip.evaluate(el => el.remove());
      }
    }
  }

  record(`${tag} console`, errors.length === 0, errors.slice(0, 5));
  await context.close();
}
await browser.close();
writeFileSync(join(OUT, 'gate.json'), JSON.stringify({ base: BASE, case: CASE, full: FULL, results }, null, 1));
console.log(failures ? `\nGATE FAILED: ${failures} check(s)` : `\nGATE PASSED: ${results.length} checks`);
process.exit(failures ? 1 : 0);
