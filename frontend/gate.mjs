/**
 * OreFlow's browser gate (design §12.3; ADR-0058, ADR-0070, ADR-0071), run against a served build:
 *
 *   npm run build && npm run preview        (serves on 127.0.0.1:4914)
 *   node gate.mjs                           (smoke: two viewport, theme and language combinations)
 *   OF_MATRIX=full node gate.mjs            (three viewports, both themes, both languages)
 *   OF_MATRIX=none node gate.mjs            (the phone and tablet pass alone)
 *
 * Every combination also checks the optimizer's controls (a live run once per gate, OP-09), the classifier-cut
 * mode (CM-07) and the two real sources (RS-07 to RS-10).
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
 *   box over another; and every tab and sub-tab of every content page, none scrolling the document sideways;
 * - reads, on every App view, what the review of 2026-10-02 found no probe reading (REVIEW_PROBE): a word or a
 *   number split over two lines, a unit on the line after its number, an engine code in visible text, a white
 *   control in the dark theme, a cut readout, a select that cuts its own text, a workbench table that needs its
 *   scroll box, and a flowsheet that dropped a label, drew a tail as a product or ran an edge through a label;
 * - once per run (OF_REVIEW, default 1280x800-dark-es; empty for none), drives the states the review reached by hand:
 *   a sweep and a learned sweep followed by a state change (U-01, U-02), a rule violation (U-03), the optimizer's
 *   bound corner and the gold unit (U-04, U-05), a flagged variant (U-06, U-11), the phosphate facts (U-12), the
 *   focus stage from each view (U-25) and the classifier cut that reads off (U-28);
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
// 1920x1080 joined in 0.08.000: the review of 2026-10-02 measured it and the gate never had (U-34)
const VIEWPORTS = [[1280, 800], [1600, 900], [1920, 1080], [2560, 1440]];
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
// the review pass (once per run): the combination it runs at, empty for none
const REVIEW = process.env.OF_REVIEW ?? (ONLY.length ? '' : '1280x800-dark-es');
// the tab counts the pages must show: Implementation's nine (PG-02), Experiments' seven (PG-01), and Benchmark's five
// with the industrial-quality lane (IS-05)
const TAB_CENSUS = { implementation: 9, experiments: 7, benchmark: 5 };
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

// A chart's text is drawn on its canvas, out of every page probe's reach, so each chart declares what it
// could not fit: category labels still too wide once wrapped (`data-ticks-cut`; the four Sobol factor
// names ran into each other in Spanish at 1280x800), a y title too long for its axis in two lines
// (`data-title-cut`; "Error del guardia" was cut at both ends) and level labels with no free place
// beside the data (`data-labels-over`; "nominal" sat on a point), all in 0.05.000. Every chart declares its
// title, so a visible chart that declared nothing has not drawn, and fails.
const CANVAS_TEXT_PROBE = () => {
  const hosts = [...document.querySelectorAll('.of-plot-area')].filter(e => e.getBoundingClientRect().width > 0);
  const name = e => e.getAttribute('aria-label')?.slice(0, 40) ?? 'chart';
  // marksOver (U-27): a mark label with no place clear of the data and the other marks; yTicksCut (U-05): a y tick
  // wider than its axis, under the axis title
  const cut = hosts.flatMap(e => ['ticksCut', 'titleCut', 'labelsOver', 'marksOver', 'yTicksCut'].filter(k => (e.dataset[k] ?? '0') !== '0').map(k => `${name(e)}: ${k} ${e.dataset[k]}`));
  const silent = hosts.filter(e => e.dataset.titleCut === undefined).map(name);
  return { charts: hosts.length, cut, silent, ok: cut.length === 0 && silent.length === 0 };
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

// What the review of 2026-10-02 (#60) found that no probe above reads; each list is empty on a sound view, and each
// was not on 0.07.000. `desktop` is false in the phone pass, where a wide table scrolls in its own box by design.
const REVIEW_PROBE = desktop => {
  const vis = el => { const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none'; };
  const name = el => `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).split(' ')[0]}`;
  const out = { midword: [], unitwrap: [], rawIds: [], whiteControls: [], readoutCut: [], selectCut: [], tableScroll: [], flow: [] };
  const UNIT = /^(%|µm|mm|cm|m|t|t\/h|kg\/h|kWh\/t|kW|m³|m³\/t|m³\/h|t\/m³|g\/t|cm\/s|min|s|kPa)[.,;:)]?$/;
  const scope = document.querySelector('.of-bench, .caos-focus-shell') ?? document.body;
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || el.closest('.of-sr-only, .sr-only, .katex, svg, code, pre, option, script, style') || !vis(el)) continue;
    const text = node.textContent ?? '';
    if (!text.trim()) continue;
    let prev = null;
    for (const m of text.matchAll(/\S+/g)) {
      range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
      const rects = [...range.getClientRects()].filter(r => r.width > 0.5);
      // U-20, U-21: a word or a number split over two line boxes ("Muest/ra", "60,8 / %"); a hyphen or a slash may break
      if (new Set(rects.map(r => Math.round(r.top))).size > 1 && !/[-–/]/.test(m[0]) && out.midword.length < 5) out.midword.push(`${m[0]} [${name(el)}]`);
      // U-31: a unit on the line after its number ("4.19 / t/m³")
      if (prev && UNIT.test(m[0]) && /\d$/.test(prev.text) && rects[0] && Math.round(rects[0].top) > prev.top + 2 && out.unitwrap.length < 5) out.unitwrap.push(`${prev.text} / ${m[0]} [${name(el)}]`);
      prev = { text: m[0], top: rects.length ? Math.round(rects[rects.length - 1].top) : 0 };
    }
    // U-06: an engine code reaching the reader ("circulating_load_out_of_range")
    for (const id of text.matchAll(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/g)) if (out.rawIds.length < 5) out.rawIds.push(`${id[0]} [${name(el)}]`);
  }
  // U-22: in the dark theme no form control is a white box (the sample search was)
  if (document.documentElement.dataset.theme === 'dark') {
    for (const el of scope.querySelectorAll('input, select, textarea, button')) {
      if (!vis(el) || el.type === 'range' || el.type === 'checkbox' || el.closest('.of-sr-only')) continue;
      const bg = (getComputedStyle(el).backgroundColor.match(/[\d.]+/g) || []).map(Number);
      const lum = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255;
      if ((bg.length < 4 || bg[3] > 0.5) && lum > 0.8 && out.whiteControls.length < 5) out.whiteControls.push(name(el));
    }
  }
  // U-23: nothing in the readout is cut by an ellipsis, title or not: it is the one row every warning reaches
  for (const el of document.querySelectorAll('.of-readout *')) {
    if (vis(el) && getComputedStyle(el).textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.readoutCut.push(`${name(el)}: ${(el.textContent ?? '').slice(0, 40)}`);
  }
  // U-24: a select shows its whole selected text ("C1 · Oro de molienda libre con gra..." was cut)
  const ctx = document.createElement('canvas').getContext('2d');
  for (const sel of scope.querySelectorAll('select')) {
    if (!vis(sel) || !ctx) continue;
    const s = getComputedStyle(sel);
    ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const text = sel.selectedOptions[0]?.text ?? '';
    const arrow = s.appearance === 'none' ? 0 : 18;
    const room = sel.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - arrow;
    if (ctx.measureText(text).width > room + 1 && out.selectCut.length < 5) out.selectCut.push(`${text.slice(0, 48)} (${Math.round(ctx.measureText(text).width)} of ${Math.round(room)} px)`);
  }
  // U-19, U-35: at a desktop size a workbench table fits its box (the variants' flags column and the optimizer's fifth
  // column were cut at the edge)
  if (desktop) {
    for (const box of scope.querySelectorAll('.of-table-scroll, .of-aside')) {
      if (vis(box) && box.scrollWidth > box.clientWidth + 1) out.tableScroll.push(`${name(box)} ${box.scrollWidth} > ${box.clientWidth}`);
    }
  }
  // U-09, U-26: the flowsheet names every outlet and the feed (no label dropped), draws a tail apart from a product,
  // and runs no edge through a label
  for (const flow of document.querySelectorAll('svg.of-flowmap')) {
    if (!vis(flow)) continue;
    if ((flow.dataset.labelsMissing ?? '0') !== '0') out.flow.push(`labels missing ${flow.dataset.labelsMissing}`);
    if (!flow.querySelector('.of-flow-edge.tail')) out.flow.push('no outlet drawn as a tail');
    const samples = [];
    for (const line of flow.querySelectorAll('.of-flow-edge polyline')) {
      const total = line.getTotalLength?.() ?? 0;
      const m = line.getScreenCTM();
      if (!m || !(total > 0)) continue;
      for (let i = 0, n = Math.max(8, Math.ceil(total / 2)); i <= n; i += 1) {
        const q = line.getPointAtLength((total * i) / n);
        samples.push([m.a * q.x + m.c * q.y + m.e, m.b * q.x + m.d * q.y + m.f]);
      }
    }
    for (const label of flow.querySelectorAll('.of-flow-label text, text.of-flow-label')) {
      const b = label.getBoundingClientRect();
      if (b.width === 0) continue;
      const inset = b.height / 4;
      if (samples.some(([x, y]) => x > b.left + 1 && x < b.right - 1 && y > b.top + inset && y < b.bottom - inset) && out.flow.length < 5) out.flow.push(`an edge runs through: ${(label.textContent ?? '').slice(0, 30)}`);
    }
  }
  return { ...out, ok: Object.values(out).every(list => list.length === 0) };
};

// U-18: on a phone no two laid-out blocks of the view overlap (the compare table's header sat on its chart, and the
// hour's forecast rows under the sensor table); only grid and flex containers are read, absolutely placed overlays aside
const SIBLING_PROBE = () => {
  const out = [];
  const host = document.querySelector('.of-view-host');
  if (!host) return out;
  const name = el => `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).split(' ')[0]}`;
  for (const parent of [host, ...host.querySelectorAll('*')]) {
    const d = getComputedStyle(parent).display;
    if (!/grid|flex/.test(d) || parent.closest('svg, .u-wrap, .of-sr-only')) continue;
    const kids = [...parent.children].filter(c => { const r = c.getBoundingClientRect(); const p = getComputedStyle(c).position; return r.width > 0 && r.height > 0 && p !== 'absolute' && p !== 'fixed'; });
    for (let i = 0; i < kids.length; i += 1) for (let j = i + 1; j < kids.length; j += 1) {
      const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect();
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) out.push(`${name(kids[i])} over ${name(kids[j])}`);
      if (out.length >= 5) return out;
    }
  }
  return out;
};

// A slider of the rail set as a user would set it: the rail section that holds it opened, the value written through
// the input's own setter and announced, so React's change handler runs
async function setControl(page, input, value) {
  const sections = page.locator('.of-rail-sections button');
  const selector = `.of-rail input[type=range][id$="-${input}"]`;
  for (let k = 0; k < await sections.count() && !(await page.locator(selector).count()); k += 1) await sections.nth(k).click();
  return page.evaluate(([s, v]) => {
    const el = document.querySelector(s);
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, [selector, value]);
}

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
      // a section, equation, table or figure number keeps its point in Spanish ("sección 2.3", "ec. 5.1"): it numbers,
      // it is not a decimal (0.08: three such references were read as decimals)
      if (!math && /(?:secci[oó]n|secciones|apartado|cap[ií]tulo|ec\.|ecuaci[oó]n|tabla|figura|fig\.)\s*$/i.test(text.slice(0, m.index))) continue;
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
  const canvasText = await page.evaluate(CANVAS_TEXT_PROBE);
  const review = await page.evaluate(REVIEW_PROBE, true);
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
  return { ...m, outside, clipped, cut, decimals, railCut, ellipsis, canvasText, review, fits: outside.length === 0 && clipped.length === 0 && cut === 0 && decimals.length === 0 && railCut.length === 0 && ellipsis.length === 0 && canvasText.ok && review.ok,
    filled: (m.drawn === null || m.drawn.ok) && m.panels.every(f => f >= 0.3) };
}

// what every workbench view must hold (ADR-0071), in the interface language
const viewOk = (m, lang) => !m.overX && m.fits && m.filled && !m.overY && m.railScrolls === false && m.tabRows === 1 && m.instrument >= 0.5 && m.lang === lang;

async function settleCharts(page, minimum = 1) {
  await page.waitForFunction(n => document.querySelectorAll('.of-view-host canvas, .of-view-host svg.of-flowmap').length >= n, minimum, { timeout: 60000 });
  await page.waitForTimeout(250);
}

let uncertaintyRerunChecked = false;
let optimizerRunChecked = false;
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
        // UQ-06: the uncertainty record carries its re-run controls in every combination, and once per run of the
        // gate a 32-sample re-run at another seed completes and replaces the baked record
        if (/^(Uncertainty|Incertidumbre)$/.test(name)) {
          const rerun = page.locator('.of-view-methods .of-rerun');
          const controls = { box: await rerun.count(), seed: await rerun.locator('input[type=number]').count(), samples: await rerun.locator('select').count(), run: await rerun.locator('.of-run').count() };
          let live = null;
          if (!uncertaintyRerunChecked && controls.box === 1) {
            uncertaintyRerunChecked = true;
            await rerun.locator('input[type=number]').fill('7');
            await rerun.locator('select').selectOption('32');
            await rerun.locator('.of-run').click();
            live = await page.waitForSelector('.of-view-methods .of-rerun .of-status-line', { timeout: 120000 }).then(() => true, () => false);
            if (live) await rerun.locator('.of-revert').click();
          }
          record(`${tag} methods/uncertainty re-run`, controls.box === 1 && controls.seed === 1 && controls.samples === 1 && controls.run === 1 && live !== false, { ...controls, live });
        }
        // OP-09: the optimizer carries its weight control and run button in every combination, and once per run of
        // the gate a live run at 50% completes, replaces the baked record and offers the four charts
        if (/^(Optimizer|Optimizador)$/.test(name)) {
          const rerun = page.locator('.of-view-methods .of-rerun');
          const controls = { box: await rerun.count(), weight: await rerun.locator('select').count(), run: await rerun.locator('.of-run').count(),
            charts: await page.locator('.of-view-methods .of-aside .of-fields select').last().locator('option').count() };
          let live = null;
          let tone = null;
          if (!optimizerRunChecked && controls.box === 1) {
            optimizerRunChecked = true;
            await rerun.locator('select').selectOption('50');
            await rerun.locator('.of-run').click();
            live = await page.waitForSelector('.of-view-methods .of-rerun .of-status-line', { timeout: 600000 }).then(() => true, () => false);
            if (live) {
              await page.screenshot({ path: join(OUT, `methods-optimizer-live-${tag}.png`) });
              // a loss of recovered metal is never shown in the success colour, and a partial weight says it is not
              // advice: at 50% the 0.07.000 build reported '-0.7418 t/h of recovered metal (-15%)' in green
              tone = await page.evaluate(() => {
                const line = [...document.querySelectorAll('.of-view-methods .of-aside > .of-status-line')].at(-1);
                const good = getComputedStyle(document.documentElement).getPropertyValue('--color-good').trim();
                const probe = document.createElement('span'); probe.style.color = good; document.body.append(probe);
                const goodRgb = getComputedStyle(probe).color; probe.remove();
                const loss = /(recovered metal|metal recuperado) -|: -|: \u2212/.test(line?.textContent ?? '');
                return { loss, green: line ? getComputedStyle(line).color === goodRgb : null,
                  note: /not advice|no es una recomendaci/.test(document.querySelector('.of-view-methods .of-aside')?.textContent ?? '') };
              });
              await rerun.locator('.of-revert').click();
            }
          }
          const toneOk = tone === null || ((!tone.loss || tone.green === false) && tone.note);
          record(`${tag} methods/optimizer run`, controls.box === 1 && controls.weight === 1 && controls.run === 1 && controls.charts === 4 && live !== false && toneOk, { ...controls, live, tone });
        }
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

  // CM-07: the classifier cut in the rail's classification section: on, its slider appears and the target and the
  // load stay visible and disabled, and the Grinding view says the cut is set; off again, the target mode returns
  await page.locator('.of-viewbar [role=tab]').nth(VIEWS.indexOf('grinding')).click();
  await page.locator('.of-rail-sections button').nth(1).click();
  await page.locator('.of-rail .of-segmented:not(.of-segmented-3) button').last().click();
  await page.waitForFunction(() => /classifier cut and the installed power|corte del clasificador y la potencia instalada/.test(document.querySelector('.of-view-host')?.textContent ?? ''), null, { timeout: 90000 }).catch(() => undefined);
  const cut = await page.evaluate(() => ({
    slider: document.querySelectorAll('.of-rail input[id$="d50c_um"]').length,
    follows: document.querySelectorAll('.of-rail .of-knob.follows input[disabled]').length,
    stated: /classifier cut and the installed power|corte del clasificador y la potencia instalada/.test(document.querySelector('.of-view-host')?.textContent ?? ''),
    url: location.search.includes('d50c_um'),
  }));
  await page.screenshot({ path: join(OUT, `cut-mode-${tag}.png`) });
  // U-08: in cut mode, with the "modified" chip shown, the rail keeps every control reachable and the focus button
  // over none (in Spanish at 1280x800 all twelve cases overflowed by 8 to 26 px)
  const cutView = await measure(page);
  record(`${tag} grinding mode`, cut.slider === 1 && cut.follows === 2 && cut.stated && cut.url && cutView.railScrolls === false && cutView.railCut.length === 0 && cutView.review.ok,
    { ...cut, railScrolls: cutView.railScrolls, railCut: cutView.railCut, review: cutView.review });
  await page.locator('.of-rail .of-segmented:not(.of-segmented-3) button').first().click();
  await page.waitForFunction(() => !location.search.includes('d50c_um'), null, { timeout: 30000 }).catch(() => undefined);

  // RS-07 to RS-10: the two real sources. A sample fixes the head grade and the work index and runs in the engine;
  // an hour is shown in the Case view, and every engine view says why it does not apply
  const sourceButton = k => page.locator('.of-rail .of-segmented-3 button').nth(k);
  await sourceButton(1).click();
  // the options of a closed select have no box, so they are attached, never visible
  await page.waitForSelector('.of-rail select option', { state: 'attached', timeout: 60000 });
  await page.locator('.of-rail-sections button').first().click();
  await page.locator('.of-viewbar [role=tab]').nth(VIEWS.indexOf('case')).click();
  await page.waitForSelector('.of-view-sample table', { timeout: 90000 });
  const sampleCheck = await page.evaluate(() => ({
    fixed: document.querySelectorAll('.of-rail .of-knob.fixed input[disabled]').length,
    tables: document.querySelectorAll('.of-view-sample table').length,
    url: location.search.includes('source=sample'),
  }));
  const sampleView = await measure(page);
  await page.screenshot({ path: join(OUT, `source-sample-${tag}.png`) });
  record(`${tag} source sample`, sampleCheck.fixed === 2 && sampleCheck.tables === 2 && sampleCheck.url && viewOk(sampleView, lang), { ...sampleCheck, ...sampleView });
  await page.locator('.of-viewbar [role=tab]').nth(VIEWS.indexOf('grinding')).click();
  await settleCharts(page, 1);
  const sampleGrinding = await measure(page);
  record(`${tag} source sample grinding`, viewOk(sampleGrinding, lang), sampleGrinding);
  await sourceButton(2).click();
  // U-15: the source opens the Case view and closes the engine views, so the hour's view says why (RS-07); until 0.08
  // this step waited for a statement on an engine view the source no longer opens
  await page.waitForSelector('.of-view-hour table', { timeout: 90000 });
  const statement = await page.evaluate(() => /reverse cationic|catiónica inversa/.test(document.querySelector('.of-view-hour .of-hour-statement')?.textContent ?? ''));
  await settleCharts(page, 1);
  const hourView = await measure(page);
  const hourCheck = await page.evaluate(() => ({ tables: document.querySelectorAll('.of-view-hour table.of-table').length, controls: document.querySelectorAll('.of-rail input[type=range]').length, url: location.search.includes('source=hour'),
    // U-15: only the Case view is open; U-14: every sensor row names its unit (pH has none), in the interface language
    disabled: document.querySelectorAll('.of-viewbar [role=tab]:disabled').length,
    unitless: [...document.querySelectorAll('.of-view-hour table.of-table th[scope=row]')].map(th => th.textContent.trim()).filter(s => /Flow|Level|Feed|Density|Flujo|Nivel|alimentación|Densidad/.test(s) && !/\(.+\)$/.test(s)),
    english: document.documentElement.lang === 'es' ? [...document.querySelectorAll('.of-view-hour table.of-table th[scope=row]')].map(th => th.textContent.trim()).filter(s => /\b(Flow|Level|Feed|Column|Iron|Silica|Starch|Amina|Pulp)\b/.test(s)) : [] }));
  await page.screenshot({ path: join(OUT, `source-hour-${tag}.png`) });
  record(`${tag} source hour`, statement && hourCheck.tables === 2 && hourCheck.controls === 0 && hourCheck.url && hourCheck.disabled === VIEWS.length - 1 && hourCheck.unitless.length === 0 && hourCheck.english.length === 0 && viewOk(hourView, lang), { statement, ...hourCheck, ...hourView });
  await sourceButton(0).click();
  await page.waitForFunction(() => !location.search.includes('source='), null, { timeout: 30000 }).catch(() => undefined);
  await page.waitForSelector('.of-readout-item strong', { timeout: 90000 });

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
    // PG-01, PG-02: the planned tab census of the pages that 0.07.000 extends
    if (route in TAB_CENSUS) record(`${tag} ${route} tabs`, groups === TAB_CENSUS[route], { groups, expected: TAB_CENSUS[route] });
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
        const canvasText = await page.evaluate(CANVAS_TEXT_PROBE);
        record(`${tag} ${route} ${g + 1}.${k + 1}`, !doc.overX && (!doc.tall || doc.moved > 0) && outside.length === 0 && figures.length === 0 && decimals.length === 0 && doc.lang === lang && doc.katexErrors === 0 && doc.loadErrors === 0 && doc.cutEquations === 0 && doc.scrollTables === 0 && canvasText.ok, { ...doc, outside, figures, decimals, canvasText });
        await page.screenshot({ path: join(OUT, `${route}-${g + 1}-${k + 1}-${tag}.png`), fullPage: true });
      }
    }
  }

  record(`${tag} console`, errors.length === 0, errors.slice(0, 5));
  await context.close();
}

// The review pass (#60, U items): the states the review of 2026-10-02 reached by hand, once per run
if (REVIEW) {
  const [size, theme, lang] = REVIEW.split('-');
  const [w, h] = size.split('x').map(Number);
  const tag = `review ${REVIEW}`;
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  await context.addInitScript(([t, l]) => { localStorage.setItem('caos.theme', t); localStorage.setItem('caos.lang', l); }, [theme, lang]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const open = async (query, view) => {
    await page.goto(`${BASE}/?${query}`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForSelector('.of-readout-item strong', { timeout: 90000 });
    if (view) await page.locator('.of-viewbar [role=tab]').nth(VIEWS.indexOf(view)).click();
  };
  const methodsTab = async pattern => {
    const subtabs = page.locator('.of-view-methods .subtablist [role=tab]');
    for (let k = 0; k < await subtabs.count(); k += 1) if (pattern.test((await subtabs.nth(k).textContent()).trim())) { await subtabs.nth(k).click(); return true; }
    return false;
  };

  // U-01: a computed surface does not outlive its state: after the variant changes, the cells are gone and the view
  // says the state changed (0.07.000 kept the surface and its "81 / 81 states" through a variant and a throughput change)
  await open('case=copper_porphyry_soft', 'response');
  await page.locator('.of-view-response .of-cta').click();
  await page.waitForFunction(() => { const p = document.querySelector('.of-progress'); if (!p) return false; const [a, b] = p.textContent.split('/').map(s => parseInt(s, 10)); return a === b; }, null, { timeout: 120000 });
  const drawnBefore = await page.evaluate(() => document.querySelectorAll('.of-view-response canvas').length);
  await page.locator('.of-rail select:has(option[value="harder_ore"])').selectOption('harder_ore');
  await page.waitForTimeout(800);
  const stale = await page.evaluate(() => ({ canvases: document.querySelectorAll('.of-view-response canvas').length, hint: document.querySelector('.of-view-response .of-hint')?.textContent ?? null }));
  record(`${tag} U-01 response cleared on a state change`, drawnBefore > 0 && stale.canvases === 0 && !!stale.hint, { drawnBefore, ...stale });

  // U-02: the learned lane's sweep, the same after a throughput change
  await open('case=copper_porphyry_soft', 'methods');
  const learned = await methodsTab(/^(Learned lane|Vía aprendida)$/);
  await page.waitForFunction(() => !document.querySelector('.of-view-methods .of-run')?.disabled, null, { timeout: 60000 });
  await page.locator('.of-view-methods .of-run').click();
  await settleCharts(page, 2);
  const learnedBefore = await page.evaluate(() => document.querySelectorAll('.of-view-methods canvas').length);
  const moved = await setControl(page, 'throughput_tph', 1080);
  await page.waitForTimeout(800);
  const learnedAfter = await page.evaluate(() => ({ canvases: document.querySelectorAll('.of-view-methods .subtabpanel:not([hidden]) canvas').length, hint: document.querySelector('.of-view-methods .subtabpanel:not([hidden]) .of-hint')?.textContent ?? null }));
  record(`${tag} U-02 learned sweep cleared on a state change`, learned && moved && learnedBefore > 0 && learnedAfter.canvases === 0 && !!learnedAfter.hint, { learned, moved, learnedBefore, ...learnedAfter });

  // U-03: a rejected state shows the rejection at the top of the rail and in place of the views, and the readout no
  // longer says "within every engine check" (phosphate: a desliming cut above half the grind target)
  await open('case=phosphate_clay', 'grinding');
  const set1 = await setControl(page, 'deslime_cut_um', 45);
  await page.waitForTimeout(600);
  const set2 = await setControl(page, 'target_p80_um', 75);
  await page.waitForTimeout(800);
  const rejected = await page.evaluate(() => ({
    rail: document.querySelector('.of-rail-rejected')?.textContent ?? null,
    panel: !!document.querySelector('.of-rejection[role=alert]'),
    clean: /No engine flags|Sin avisos|Within every engine check/.test(document.querySelector('.of-readout')?.textContent ?? ''),
  }));
  await page.screenshot({ path: join(OUT, `review-U-03-${REVIEW}.png`) });
  record(`${tag} U-03 rejected state`, set1 && set2 && !!rejected.rail && rejected.panel && !rejected.clean, rejected);

  // U-04: an optimum decision on its search bound says so (the soft porphyry's collector sat at 75.0 of 0.00 to 75.0)
  await open('case=copper_porphyry_soft', 'methods');
  await methodsTab(/^(Optimizer|Optimizador)$/);
  await settleCharts(page, 1);
  const bounds = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.of-view-methods .of-aside table.of-table')][0]?.querySelectorAll('tbody tr:not(.of-table-group)') ?? [];
    return [...rows].map(r => {
      const cells = r.querySelectorAll('td');
      if (cells.length < 3) return null;
      const optimum = [...cells[1].childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      const [lo, hi] = cells[2].textContent.split('–').map(s => s.trim());
      return { optimum, lo, hi, tagged: !!cells[1].querySelector('.of-tag') };
    }).filter(Boolean);
  });
  const untagged = bounds.filter(b => (b.optimum === b.lo || b.optimum === b.hi) && !b.tagged);
  record(`${tag} U-04 decisions at a bound are marked`, bounds.length > 0 && untagged.length === 0, { bounds, untagged });

  // U-05: a gold plant's metal reads in kg/h, and a non-zero gain never prints as zero ("+0,0000 t/h")
  await open('case=gold_free_milling', 'methods');
  await methodsTab(/^(Optimizer|Optimizador)$/);
  await settleCharts(page, 1);
  const gold = await page.evaluate(() => [...document.querySelectorAll('.of-view-methods .of-aside > .of-status-line')].at(-1)?.textContent ?? '');
  record(`${tag} U-05 gold gain in kg/h`, /kg\/h/.test(gold) && !/(metal|recuperado|:)\s*[+-]?0[.,]0+\s/.test(gold), { status: gold });

  // U-06, U-11: the hard porphyry's finer classifier cut raises a flag: no raw code anywhere, the flagged facts in the
  // warning colour, and the full sentences under the tab row
  await open('case=copper_porphyry_hard&variant=cut_finer', 'grinding');
  await settleCharts(page, 1);
  const flagged = await page.evaluate(() => ({ warned: document.querySelectorAll('.of-fact-warn').length, line: document.querySelector('.of-flags-line')?.textContent ?? null }));
  const flaggedView = await measure(page);
  record(`${tag} U-06 U-11 flagged variant`, flagged.warned > 0 && !!flagged.line && flaggedView.review.rawIds.length === 0, { ...flagged, rawIds: flaggedView.review.rawIds });
  await page.locator('.of-viewbar [role=tab]').nth(VIEWS.indexOf('case')).click();
  const caseTabs = page.locator('.of-view-case .subtablist [role=tab]');
  const raw = [];
  for (let k = 0; k < await caseTabs.count(); k += 1) {
    await caseTabs.nth(k).click();
    await page.waitForTimeout(400);
    raw.push(...(await page.evaluate(REVIEW_PROBE, true)).rawIds);
  }
  record(`${tag} U-06 no raw code in the Case view`, raw.length === 0, raw.slice(0, 5));

  // U-12: phosphate's own facts (the slimes loss) are inside the Separation panel without scrolling it
  await open('case=phosphate_clay', 'separation');
  await settleCharts(page, 1);
  const facts = await page.evaluate(() => {
    const panel = document.querySelector('.of-view-host .of-side, .of-view-host .of-panel');
    if (!panel) return null;
    const box = panel.getBoundingClientRect();
    const first = [...panel.querySelectorAll('.of-facts > div')].slice(0, 3).map(d => { const r = d.getBoundingClientRect(); return { text: d.textContent.trim().slice(0, 40), inside: r.top >= box.top - 1 && r.bottom <= box.bottom + 1 }; });
    return { first, slimes: /slime|lama/i.test(first.map(f => f.text).join(' ')) };
  });
  record(`${tag} U-12 the family's facts first and in view`, !!facts && facts.slimes && facts.first.every(f => f.inside), facts);

  // U-25: the focus route opens on the stage of the view it was opened from
  const stages = {};
  for (const [view, stage] of [['grinding', 'psd'], ['separation', 'recovery_by_size'], ['response', 'response']]) {
    await open('case=copper_porphyry_soft', view);
    await page.locator('.of-focus-open').click();
    await page.waitForSelector('.of-focus-rail select', { timeout: 60000 });
    stages[view] = { expected: stage, shown: await page.locator('.of-focus-rail select').first().inputValue() };
  }
  record(`${tag} U-25 focus stage from the view`, Object.values(stages).every(s => s.expected === s.shown), stages);

  // U-28: the classifier cut's off value reads as off in the Case context, not as 0.0 µm
  await open('case=copper_porphyry_soft', 'case');
  await page.waitForSelector('.of-context .katex', { timeout: 60000 });
  const off = await page.evaluate(() => /off: the cut follows|apagado: el corte sigue/.test(document.querySelector('.of-context')?.textContent ?? ''));
  record(`${tag} U-28 the cut reads off`, off, { off });

  // S-12, S-20: a sample link with a changed control opens with that control (0.07.000 reset it to 720 t/h), and the
  // sample's fixed sliders sit on their own value
  await page.goto(`${BASE}/?case=copper_porphyry_soft&source=sample&sample=lct-9&set=throughput_tph:360`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForSelector('.of-readout-item strong', { timeout: 90000 });
  await page.waitForTimeout(800);
  const sampleLink = await page.evaluate(() => ({
    url: location.search.includes('throughput_tph%3A360') || location.search.includes('throughput_tph:360'),
    throughput: Number(document.querySelector('.of-rail input[type=range][id$="-throughput_tph"]')?.value ?? NaN),
    fixedSteps: [...document.querySelectorAll('.of-rail .of-knob.fixed input[type=range]')].map(i => i.getAttribute('step')),
  }));
  record(`${tag} S-12 S-20 sample link and fixed sliders`, sampleLink.url && sampleLink.throughput === 360 && sampleLink.fixedSteps.length > 0 && sampleLink.fixedSteps.every(s => s === 'any'), sampleLink);

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
    const canvasText = await page.evaluate(CANVAS_TEXT_PROBE);
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
    const review = await page.evaluate(REVIEW_PROBE, false);
    record(`${tag} ${view}`, m.railClear && m.railWhole && !m.overX && outside.length === 0 && railCut.length === 0 && ellipsis.length === 0 && canvasText.ok && review.ok && (m.overlaps ?? 0) === 0 && m.lang === lang, { ...m, outside, railCut, ellipsis, canvasText, review });
    await page.screenshot({ path: join(OUT, `${view}-${tag}.png`) });
    // U-18, U-33: every sub-tab of the Case and Methods views, not only the first: no block over another, every
    // chart's text declared clear, and the sub-tab row inside the screen (the fourth Methods tab was a sliver)
    if (view === 'case' || view === 'methods') {
      const subtabs = page.locator(`.of-view-${view} .subtablist [role=tab]`);
      for (let k = 0; k < await subtabs.count(); k += 1) {
        await subtabs.nth(k).click();
        await page.waitForTimeout(600);
        const sub = await page.evaluate(() => ({ overX: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > document.body.clientWidth + 1,
          offscreenTabs: [...document.querySelectorAll('.of-view-host .subtablist [role=tab]')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).map(b => b.textContent.trim()) }));
        const overlaps = await page.evaluate(SIBLING_PROBE);
        const subCanvas = await page.evaluate(CANVAS_TEXT_PROBE);
        const subReview = await page.evaluate(REVIEW_PROBE, false);
        record(`${tag} ${view}/${k + 1}`, !sub.overX && sub.offscreenTabs.length === 0 && overlaps.length === 0 && subCanvas.ok && subReview.ok, { ...sub, overlaps, canvasText: subCanvas, review: subReview });
        await page.screenshot({ path: join(OUT, `${view}-${k + 1}-${tag}.png`), fullPage: true });
      }
    }
  }
  // U-18: the hour source on a phone: its forecast rows are not hidden under the sensor table
  await page.locator('.of-rail .of-segmented-3 button').nth(2).click();
  await page.waitForSelector('.of-view-hour table', { timeout: 90000 });
  await page.waitForTimeout(600);
  const hourOverlaps = await page.evaluate(SIBLING_PROBE);
  record(`${tag} source hour`, hourOverlaps.length === 0, { overlaps: hourOverlaps });
  await page.screenshot({ path: join(OUT, `source-hour-${tag}.png`), fullPage: true });
  await page.locator('.of-rail .of-segmented-3 button').nth(0).click();
  await page.waitForSelector('.of-readout-item strong', { timeout: 90000 });
  // U-37: the route links show that they scroll (the end hiding links fades), and the footer is not cut
  const chrome = await page.evaluate(() => {
    const nav = document.querySelector('.site-header .main-nav');
    const meta = document.querySelector('.site-footer .footer-meta');
    const hides = nav ? nav.scrollWidth > nav.clientWidth + 1 : false;
    return { hides, fades: nav ? nav.dataset.fadeEnd === '1' || nav.dataset.fadeStart === '1' : false, footerCut: meta ? meta.scrollWidth > meta.clientWidth + 1 : null };
  });
  record(`${tag} header and footer`, (!chrome.hides || chrome.fades) && chrome.footerCut === false, chrome);
  // the content pages at a phone's and a tablet's width (ADR-0071): no tab or sub-tab scrolls the document
  // sideways. Until 0.07.000 this pass visited the App route only, and 16 content tabs overflowed a phone, their
  // wide tables and the charts beside them past the edge; a wide table now scrolls inside its own box
  for (const route of PAGES) {
    await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForSelector('.page-body, .of-page', { timeout: 60000 });
    const topTabs = page.locator('.page-body .tablist [role=tab]');
    const groups = await topTabs.count();
    const over = [];
    let visited = 0;
    for (let g = 0; g < Math.max(1, groups); g += 1) {
      if (groups) await topTabs.nth(g).click();
      const subTabs = page.locator('.page-body .tabpanel:not([hidden]) .subtablist [role=tab]');
      const count = Math.max(1, await subTabs.count());
      for (let k = 0; k < count; k += 1) {
        if (await subTabs.count()) await subTabs.nth(k).click();
        await page.waitForTimeout(400);
        visited += 1;
        const state = await page.evaluate(() => ({
          overX: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > document.body.clientWidth + 1,
          tab: [...document.querySelectorAll('.page-body [role=tab][aria-selected=true]')].map(t => t.textContent.trim()).join(' / '),
        }));
        if (state.overX) over.push(state.tab);
      }
    }
    await page.screenshot({ path: join(OUT, `${route}-${tag}.png`) });
    record(`${tag} ${route} page`, over.length === 0, { visited, over });
  }
  record(`${tag} console`, errors.length === 0, errors.slice(0, 5));
  await context.close();
}
await browser.close();
writeFileSync(join(OUT, 'gate.json'), JSON.stringify({ base: BASE, case: CASE, full: FULL, only: ONLY, small: SMALL, results }, null, 1));
console.log(failures ? `\nGATE FAILED: ${failures} check(s)` : `\nGATE PASSED: ${results.length} checks`);
process.exit(failures ? 1 : 0);
