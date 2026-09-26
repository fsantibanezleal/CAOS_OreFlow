/**
 * OreFlow's browser gate (design §12.3; ADR-0058, ADR-0070, ADR-0071), run against a served build:
 *
 *   npm run build && npm run preview        (serves on 127.0.0.1:4914)
 *   node gate.mjs                           (smoke: two viewport, theme and language combinations)
 *   OF_MATRIX=full node gate.mjs            (three viewports, both themes, both languages)
 *   OF_MATRIX=none node gate.mjs            (the phone and tablet pass alone)
 *
 * OF_BASE points it at another host (a public deployment), OF_ONLY names combinations of the full matrix
 * (1280x800-dark-es,...) to re-check after a fix, OF_CASE picks the case, OF_PAGES the content
 * pages (default all five; empty for none). For every combination it:
 *
 * - opens the App route, visits every view, every Case sub-tab and every Methods record, runs the
 *   Response sweep and the learned lane, and measures what ADR-0071 binds: no document scroll either
 *   way, no element outside the viewport and none clipped out of reach inside the view, no equation
 *   wider than its box, a rail that shows its own controls, one tab row, the instrument (the active
 *   view) at least half the viewport, and `<html lang>` equal to the interface language; where the
 *   flowsheet is on the stage, what it drew (units, streams and labels) must span at least 90% of its
 *   frame on the limiting axis and stay inside it, since the svg element always fills its host and its
 *   own box says nothing about the drawing; and every text panel beside the charts filled at least 30%
 *   by its content;
 * - opens the architecture modal and checks every tab (ADR-0058): the diagram inlined, only the
 *   interface language's text shown, every text inside the diagram and inside any box it touches;
 * - enters the focus route by clicking, measures the stage and its largest chart (at least 80%) and the
 *   drawn flowsheet as above, and returns by clicking to the same case, variant and changed controls;
 * - opens every tab and sub-tab of every content page: no sideways overflow, the interface language,
 *   no KaTeX error, no cut equation, no table that needs its scroll box, no failed record load, no
 *   figure text outside its box or across a box it does not fit, and the in-browser network run where a
 *   page offers it;
 * - at 390x844 and 768x1024 in both themes and languages (OF_SMALL), where the rail stacks and the page body scrolls, visits every
 *   view: the rail whole and clear of the readout, no sideways document scroll, and no flowsheet unit
 *   box over another;
 * - fails on any console error.
 *
 * A screenshot of every state lands in OF_QA (default `qa-output/`, ignored by git); the measurements
 * are written to `gate.json` there. Exit 1 on any failure.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.OF_BASE || 'http://127.0.0.1:4914';
const OUT = process.env.OF_QA || 'qa-output';
const CASE = process.env.OF_CASE || 'copper_porphyry_soft';
const FULL = process.env.OF_MATRIX === 'full';
const VIEWPORTS = [[1280, 800], [1600, 900], [2560, 1440]];
const ALL = VIEWPORTS.flatMap(v => ['dark', 'light'].flatMap(theme => ['en', 'es'].map(lang => ({ v, theme, lang }))));
const tagOf = ({ v: [w, h], theme, lang }) => `${w}x${h}-${theme}-${lang}`;
// OF_ONLY names combinations of the full matrix (1280x800-dark-es,...), to re-check one after a fix
const ONLY = (process.env.OF_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const COMBOS = ONLY.length ? ALL.filter(c => ONLY.includes(tagOf(c)))
  : FULL ? ALL : process.env.OF_MATRIX === 'none' ? []
  : [{ v: [1280, 800], theme: 'dark', lang: 'en' }, { v: [1600, 900], theme: 'light', lang: 'es' }];
if (ONLY.length && COMBOS.length !== ONLY.length) throw new Error(`OF_ONLY names a combination outside the matrix: ${ONLY.join(', ')}`);
const VIEWS = ['circuit', 'grinding', 'separation', 'response', 'methods', 'case'];
// the phone and tablet pass (after the matrix); OF_SMALL names its combinations, empty for none
// (both themes and both languages at each size: PE-37 names phone, tablet and desktop in both)
const SMALL = (process.env.OF_SMALL ?? (ONLY.length ? '' : '390x844-light-en,390x844-dark-es,768x1024-light-en,768x1024-dark-es')).split(',').map(s => s.trim()).filter(Boolean);
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

// A rail's content inside the rail's content box: in Spanish at 1280x800 the longest control row
// ("Abertura de descarga del chancador" and its value) widened the whole controls column, and the rail's
// overflow cut every value at its edge ("720 t,", "8,0 r") while every other check passed (0.05.000)
const RAIL_PROBE = () => {
  const cut = [];
  for (const rail of document.querySelectorAll('.of-rail, .of-focus-rail')) {
    const b = rail.getBoundingClientRect();
    if (b.width === 0) continue;
    const s = getComputedStyle(rail);
    const x0 = b.left + rail.clientLeft + parseFloat(s.paddingLeft) - 1;
    const x1 = b.left + rail.clientLeft + rail.clientWidth - parseFloat(s.paddingRight) + 1;
    for (const el of rail.querySelectorAll('*')) {
      if (el.closest('.of-sr-only')) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.left < x0 || r.right > x1)) cut.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.left)}..${Math.round(r.right)} of ${Math.round(x0)}..${Math.round(x1)}`);
      if (cut.length >= 5) return cut;
    }
  }
  return cut;
};

// Text an ellipsis cuts must be named in full in its title: in Spanish at 1280x800 the readout's status
// ("Dentro de todas las verificaciones del motor") was cut with nothing to read it by (0.05.000)
const ELLIPSIS_PROBE = () => {
  const cut = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('.sr-only, .of-sr-only, .katex-mathml')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || getComputedStyle(el).textOverflow !== 'ellipsis' || el.scrollWidth <= el.clientWidth + 1) continue;
    if (!(el.getAttribute('title') ?? '').trim()) cut.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}: ${(el.textContent ?? '').slice(0, 48)}`);
    if (cut.length >= 5) break;
  }
  return cut;
};

// Category labels are drawn on the canvas, out of every page probe's reach, so the chart declares how
// many of them still do not fit their category once wrapped (`data-ticks-cut`); in Spanish at 1280x800
// the four Sobol factor names ran into each other (0.05.000)
// (how many charts declared is recorded, so a view whose categorical chart stopped declaring shows it)
const TICKS_PROBE = () => {
  const declared = [...document.querySelectorAll('.of-plot-area[data-ticks-cut]')].filter(e => e.getBoundingClientRect().width > 0);
  return { declared: declared.length, cut: declared.filter(e => e.dataset.ticksCut !== '0').map(e => `${e.getAttribute('aria-label')?.slice(0, 48) ?? 'chart'}: ${e.dataset.ticksCut}`) };
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
// Nor may a curve, a marker or an edge run through a label: each stroke is sampled every two pixels in
// screen space, and a sample inside the core of a text's box (a pixel in from the sides, a quarter of
// its height in from the top and the bottom, so a line passing under the descenders is not counted)
// is a crossing. Axes and grid lines are left out: tick labels sit on them by design.
const FIGURE_PROBE = () => {
  const out = [];
  for (const svg of document.querySelectorAll('svg.fig-svg')) {
    const fr = svg.getBoundingClientRect();
    if (fr.width === 0) continue;
    const boxes = [...svg.querySelectorAll('rect.dg-box')].map(r => r.getBoundingClientRect());
    const samples = [];
    for (const stroke of svg.querySelectorAll('.dg-edge, .dg-marker, .dg-curve, .dg-curve-2, .dg-curve-faint, .dg-asymptote')) {
      if (typeof stroke.getTotalLength !== 'function') continue;
      const total = stroke.getTotalLength();
      const m = stroke.getScreenCTM();
      if (!m || !(total > 0)) continue;
      const steps = Math.max(8, Math.ceil(total / 2));
      for (let i = 0; i <= steps; i += 1) {
        const q = stroke.getPointAtLength((total * i) / steps);
        samples.push([m.a * q.x + m.c * q.y + m.e, m.b * q.x + m.d * q.y + m.f]);
      }
    }
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
      const inset = b.height / 4;
      if (samples.some(([x, y]) => x > b.left + 1 && x < b.right - 1 && y > b.top + inset && y < b.bottom - inset)) out.push(`a line runs through: ${name}`);
      if (out.length >= 5) return out;
    }
  }
  return out;
};

// Spanish sets the decimal comma (PE-35). A visible number with a decimal point on a Spanish page is an
// English string that escaped the formatter: point grouping of thousands (1.800) is the only point a
// Spanish number carries, and inside an equation none at all. Licence names (CC BY 4.0) and the
// reference lists keep their own spelling. The page's own language is read from <html lang>, which the
// gate checks separately against the interface language.
const LOCALE_PROBE = () => {
  if (document.documentElement.lang !== 'es') return [];
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || el.closest('.katex-mathml, .sr-only, .of-sr-only, .site-footer, footer, code, pre, .references, .reference-list, .th-refs, [lang="en"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const text = (node.textContent || '').replace(/CC BY \d\.\d/g, '');
    const math = !!el.closest('.katex');
    for (const m of text.matchAll(/(?<![\w./])\d+(?:\.\d+)+(?![\w./])/g)) {
      if (!math && /^[1-9]\d{0,2}(?:\.\d{3})+$/.test(m[0])) continue;
      // a decimal has one point: two or more that are not grouping make a version (0.05.000)
      if (!math && m[0].split('.').length > 2) continue;
      out.push(`${math ? 'equation' : el.closest('svg') ? 'figure' : el.tagName.toLowerCase()}: ${m[0]} in ${text.trim().slice(0, 50)}`);
      break;
    }
    if (out.length >= 6) break;
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
    // the tab's own diagram, not the previous one still in place: on a public host the next svg arrives
    // after the click, and a probe taken in between found none (tabs 2 to 5 against the VPS, 0.05.000)
    const before = k === 0 ? '' : await page.evaluate(() => document.querySelector('.caos-architecture-diagram svg')?.outerHTML ?? '');
    await tabs.nth(k).click();
    await page.waitForFunction(prev => { const s = document.querySelector('.caos-architecture-diagram svg'); return Boolean(s) && s.outerHTML !== prev; }, before, { timeout: 30000 });
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
  const decimals = await page.evaluate(LOCALE_PROBE);
  const railCut = await page.evaluate(RAIL_PROBE);
  const ellipsis = await page.evaluate(ELLIPSIS_PROBE);
  const ticks = await page.evaluate(TICKS_PROBE);
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
    // the flowsheet's drawing against its frame: the svg's box less the inset its overlays cover
    // (declared by the diagram, bounded here to a quarter of each axis so it cannot hollow the frame)
    const flow = scope ? [...scope.querySelectorAll('svg.of-flowmap')].find(s => area(s) > 0) : undefined;
    let drawn = null;
    if (flow) {
      const s = flow.getBoundingClientRect();
      const [t, r, b, l] = (flow.dataset.inset ?? '0 0 0 0').split(' ').map(Number);
      const parts = [...flow.querySelectorAll('.of-flow-unit rect, .of-flow-edge polyline, .of-flow-label')]
        .map(e => e.getBoundingClientRect()).filter(q => q.width > 0 || q.height > 0);
      const x0 = Math.min(...parts.map(q => q.left)), x1 = Math.max(...parts.map(q => q.right));
      const y0 = Math.min(...parts.map(q => q.top)), y1 = Math.max(...parts.map(q => q.bottom));
      const fw = s.width - l - r, fh = s.height - t - b;
      const fill = parts.length ? Math.max((x1 - x0) / fw, (y1 - y0) / fh) : 0;
      const inside = parts.length > 0 && x0 >= s.left + l - 2 && x1 <= s.right - r + 2 && y0 >= s.top + t - 2 && y1 <= s.bottom - b + 2;
      const insetOk = l + r <= 0.25 * s.width && t + b <= 0.25 * s.height;
      drawn = { fill: +fill.toFixed(3), width: +((x1 - x0) / fw).toFixed(3), height: +((y1 - y0) / fh).toFixed(3), inside, inset: [t, r, b, l], zoom: +(flow.dataset.zoom ?? 1), ok: fill >= 0.9 && inside && insetOk };
    }
    // a text panel beside the charts must not stand mostly empty: its children's extent against its own
    // height (at 2560x1440 the Grinding facts filled a fifth of their cell, the Sobol table a fifth of
    // its column); a panel whose content is taller scrolls inside and reads above 1
    const panels = [...document.querySelectorAll('.of-view-host .of-panel, .of-view-host .of-aside, .of-view-host .of-grid-facts')]
      .filter(p => p.getBoundingClientRect().height > 0)
      .map(p => {
        const box = p.getBoundingClientRect();
        const kids = [...p.children].map(c => c.getBoundingClientRect()).filter(q => q.height > 0);
        return kids.length ? +((Math.max(...kids.map(q => q.bottom)) - Math.min(...kids.map(q => q.top))) / box.height).toFixed(2) : 0;
      });
    return {
      // shell known defect 1 pins documentElement.scrollHeight to the viewport, so the height is read
      // through <body> as well: either one taller than the viewport is a document scroll
      overX: de.scrollWidth > innerWidth + 1 || document.body.scrollWidth > document.body.clientWidth + 1,
      overY: Math.max(de.scrollHeight, document.body.scrollHeight) > innerHeight + 2,
      railScrolls: rail ? rail.scrollHeight > rail.clientHeight + 2 : null,
      tabRows: new Set(tabs).size,
      instrument: +(area(document.querySelector('.of-view-host')) / viewport).toFixed(3),
      stage: selector ? +(area(document.querySelector(selector)) / viewport).toFixed(3) : null,
      largestViz: +(viz / viewport).toFixed(3),
      drawn,
      panels,
      lang: de.lang,
    };
  }, stageSelector ?? null);
  return { ...m, outside, clipped, cut, decimals, railCut, ellipsis, ticks, fits: outside.length === 0 && clipped.length === 0 && cut === 0 && decimals.length === 0 && railCut.length === 0 && ellipsis.length === 0 && ticks.cut.length === 0,
    filled: (m.drawn === null || m.drawn.ok) && m.panels.every(f => f >= 0.3) };
}

// what every workbench view must hold (ADR-0071), in the interface language
const viewOk = (m, lang) => !m.overX && m.fits && m.filled && !m.overY && m.railScrolls === false && m.tabRows === 1 && m.instrument >= 0.5 && m.lang === lang;

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
  // the gate walks its own list, where each view's special handling is declared: a view added to the app
  // and not to this list would never be measured, so the two must agree
  const tabs = await page.locator('.of-viewbar [role=tab]').count();
  record(`${tag} view list`, tabs === VIEWS.length, { tabs, gate: VIEWS.length });
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
        const ok = viewOk(m, lang);
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
        const ok = viewOk(m, lang);
        record(`${tag} methods/${name}`, ok, m);
        await page.screenshot({ path: join(OUT, `methods-${k + 1}-${tag}.png`) });
      }
      continue;
    }
    await settleCharts(page, 1);
    const m = await measure(page);
    const ok = viewOk(m, lang);
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
  record(`${tag} focus`, focus.stage >= 0.8 && focus.largestViz >= 0.8 && !focus.overX && focus.fits && focus.filled && !focus.overY && focus.lang === lang, focus);
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
        const decimals = await page.evaluate(LOCALE_PROBE);
        const doc = await page.evaluate(() => ({ overX: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > document.body.clientWidth + 1,
          lang: document.documentElement.lang,
          katexErrors: document.querySelectorAll('.katex-error').length, loadErrors: document.querySelectorAll('.of-doc-state[role=alert]').length,
          // an equation wider than its box can only be read by scrolling inside it
          cutEquations: [...document.querySelectorAll('.katex-display')].filter(e => e.getBoundingClientRect().width > 0 && e.scrollWidth > e.clientWidth + 1).length,
          // a table's scroll box is for narrower screens: at the gated desktop sizes every table fits its page
          // (the uncertainty table once needed 135 px of sideways scroll at 1280 px in Spanish)
          scrollTables: [...document.querySelectorAll('.page-body .tabpanel:not([hidden]) .of-doc-scroll')].filter(e => e.getBoundingClientRect().width > 0 && e.scrollWidth > e.clientWidth + 1).length,
          // the page taller than the viewport must scroll the document (shell known defect 1: under the
          // defect scrollTo does nothing while the wheel still scrolls <body>, so the page looks fine)
          ...(() => { const tall = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) > innerHeight + 2;
            window.scrollTo(0, 1200); const moved = window.scrollY; window.scrollTo(0, 0); return { tall, moved }; })() }));
        const ticks = await page.evaluate(TICKS_PROBE);
        record(`${tag} ${route} ${g + 1}.${k + 1}`, !doc.overX && (!doc.tall || doc.moved > 0) && outside.length === 0 && figures.length === 0 && decimals.length === 0 && doc.lang === lang && doc.katexErrors === 0 && doc.loadErrors === 0 && doc.cutEquations === 0 && doc.scrollTables === 0 && ticks.cut.length === 0, { ...doc, outside, figures, decimals, ticks });
        await page.screenshot({ path: join(OUT, `${route}-${g + 1}-${k + 1}-${tag}.png`), fullPage: true });
      }
    }
  }

  record(`${tag} console`, errors.length === 0, errors.slice(0, 5));
  await context.close();
}

// Phone and tablet (PE-37's gate names phone, tablet and desktop; ADR-0071 binds the three sizes above).
// Below 860 px the rail stacks above the instrument and the page body scrolls, so the fixed-surface
// measures do not apply; every view must instead keep the rail whole and clear of the readout, keep the
// document from scrolling sideways (a wide readout, tab row or flowsheet scrolls inside its own box), and
// draw the flowsheet with no unit box over another. At 390 px the rail once shrank to 61 px under its
// controls and the flowsheet's cells to 46 px under 64 px boxes.
for (const tag of SMALL) {
  const [size, theme, lang] = tag.split('-');
  const [w, h] = size.split('x').map(Number);
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
    await page.waitForTimeout(500);
    const outside = await page.evaluate(OVERFLOW_PROBE);
    const railCut = await page.evaluate(RAIL_PROBE);
    const ellipsis = await page.evaluate(ELLIPSIS_PROBE);
    const ticks = await page.evaluate(TICKS_PROBE);
    const m = await page.evaluate(() => {
      const rail = document.querySelector('.of-rail');
      const r = rail.getBoundingClientRect();
      const o = document.querySelector('.of-readout').getBoundingClientRect();
      const flow = [...document.querySelectorAll('svg.of-flowmap')].find(s => s.getBoundingClientRect().width > 0);
      let units = null, overlaps = null;
      if (flow) {
        const boxes = [...flow.querySelectorAll('.of-flow-unit rect')].map(e => e.getBoundingClientRect());
        units = boxes.length;
        overlaps = 0;
        for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i], b = boxes[j];
          if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) overlaps += 1;
        }
      }
      return {
        railClear: r.bottom <= o.top + 1, railWhole: rail.scrollHeight <= rail.clientHeight + 2,
        overX: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > document.body.clientWidth + 1,
        lang: document.documentElement.lang, units, overlaps,
      };
    });
    record(`${tag} ${view}`, m.railClear && m.railWhole && !m.overX && outside.length === 0 && railCut.length === 0 && ellipsis.length === 0 && ticks.cut.length === 0 && (m.overlaps ?? 0) === 0 && m.lang === lang, { ...m, outside, railCut, ellipsis, ticks });
    await page.screenshot({ path: join(OUT, `${view}-${tag}.png`) });
  }
  record(`${tag} console`, errors.length === 0, errors.slice(0, 5));
  await context.close();
}
await browser.close();
writeFileSync(join(OUT, 'gate.json'), JSON.stringify({ base: BASE, case: CASE, full: FULL, only: ONLY, small: SMALL, results }, null, 1));
console.log(failures ? `\nGATE FAILED: ${failures} check(s)` : `\nGATE PASSED: ${results.length} checks`);
process.exit(failures ? 1 : 0);
