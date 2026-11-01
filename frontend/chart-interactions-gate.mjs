/** Actual UI gestures against existing OreFlow data. OF_BASE works for dev, preview or public builds. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.env.OF_BASE || 'http://127.0.0.1:4914';
const taskRoot = process.env.CAOS_TEMP_ROOT || process.env.OF_CHART_TASK_ROOT;
const configuredEvidence = process.env.OF_CHART_EVIDENCE || (taskRoot && join(taskRoot, 'oreflow-chart-interactions'));
if (!configuredEvidence) throw new Error('Configure OF_CHART_EVIDENCE, CAOS_TEMP_ROOT, or an external OF_CHART_TASK_ROOT before running the chart gate.');
const EVIDENCE = resolve(configuredEvidence);
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inside = (root, target) => {
  const part = relative(resolve(root), target);
  return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
};
if (inside(repository, EVIDENCE) || inside(tmpdir(), EVIDENCE)) {
  throw new Error('Chart evidence must be in a configured external task directory, outside the product repository and system temp.');
}
console.log(`EVIDENCE ${EVIDENCE}`);
await mkdir(EVIDENCE, { recursive: true });
const browser = await chromium.launch();
let checks = 0;
const check = (name, ok, evidence) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(evidence)}`);
  assert.ok(ok, name); checks++;
};
const jsonAttr = async (el, name) => JSON.parse(await el.getAttribute(name));
const pause = page => page.waitForTimeout(150); // allow ResizeObserver and the canvas paint to settle
async function drag(page, from, to, modifier) {
  if (modifier) await page.keyboard.down(modifier);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 }); await page.mouse.up();
  if (modifier) await page.keyboard.up(modifier);
  await pause(page);
}
async function linePan(page, host, tag) {
  await host.scrollIntoViewIfNeeded();
  const overlay = host.locator('.u-over'); const box = await overlay.boundingBox();
  const domain = await jsonAttr(host, 'data-x-domain');
  const pt = f => ({ x: box.x + box.width * f, y: box.y + box.height * 0.5 });
  await drag(page, pt(0.2), pt(0.65));
  const zoom = await jsonAttr(host, 'data-x-view');
  await host.focus(); await host.press('Shift+ArrowRight'); await pause(page);
  const keyboard = await jsonAttr(host, 'data-x-view');
  await drag(page, pt(0.7), pt(0.45), 'Shift');
  const pointer = await jsonAttr(host, 'data-x-view');
  const bounded = r => r[0] >= domain[0] - 1e-9 && r[1] <= domain[1] + 1e-9 && r[1] > r[0];
  const log = await host.getAttribute('data-log-x') === 'true';
  const span = r => log ? Math.log(r[1] / r[0]) : r[1] - r[0];
  check(`${tag} brush + keyboard/pointer pan`, zoom[0] > domain[0] && zoom[1] < domain[1] && keyboard[0] > zoom[0] && pointer[0] > keyboard[0] &&
    [zoom, keyboard, pointer].every(bounded) && Math.abs(span(zoom) - span(pointer)) < 1e-7, { domain, zoom, keyboard, pointer, log });
  await host.focus(); for (let k = 0; k < 15; k++) await host.press('Shift+ArrowRight');
  const edge = await jsonAttr(host, 'data-x-view');
  check(`${tag} pan stops at original domain`, bounded(edge) && Math.abs(edge[1] - domain[1]) < 1e-7, edge);
  await host.press('Escape'); await pause(page);
  check(`${tag} reset is deterministic`, JSON.stringify(await jsonAttr(host, 'data-x-view')) === JSON.stringify(domain), domain);
  await host.press('ArrowRight');
  check(`${tag} cursor survives navigation`, await host.locator('.u-cursor-x').count() === 1, 'arrow cursor');
}
async function gridPoint(heatmap, i, j) {
  const [xs, ys] = await jsonAttr(heatmap, 'data-grid-key');
  const view = await jsonAttr(heatmap, 'data-view');
  const canvas = heatmap.locator('canvas'); const box = await canvas.boundingBox();
  // Production OverlayInset is applied in focus. Read the actual rendered plot bounds metadata.
  const margins = await jsonAttr(heatmap, 'data-margins');
  return { x: box.x + margins.left + (i - view.i0 + 0.5) * (box.width - margins.left - margins.right) / (view.i1 - view.i0 + 1),
    y: box.y + margins.top + (view.j1 - j + 0.5) * (box.height - margins.top - margins.bottom) / (view.j1 - view.j0 + 1), nx: xs.length, ny: ys.length };
}
async function dragGrid(page, heatmap, a, b) {
  // Hover readouts may wrap on phones. Re-read geometry before down and after the selection readout appears.
  await heatmap.locator('canvas').scrollIntoViewIfNeeded();
  for (let k = 0; k < 2; k++) {
    const from = await gridPoint(heatmap, ...a); await page.mouse.move(from.x, from.y); await pause(page);
  }
  const from = await gridPoint(heatmap, ...a); await page.mouse.move(from.x, from.y); await page.mouse.down(); await pause(page);
  const to = await gridPoint(heatmap, ...b); await page.mouse.move(to.x, to.y, { steps: 12 }); await page.mouse.up(); await pause(page);
}
async function verifySlice(page, heatmap, tag, axis, lang) {
  const [xs, ys, z] = await jsonAttr(heatmap, 'data-grid-key');
  const selection = await jsonAttr(heatmap, 'data-selection'); const { region: r, cell: c } = selection;
  const single = r.i0 === r.i1 && r.j0 === r.j1;
  const coordinates = axis === 'x' ? xs.slice(single ? 0 : r.i0, single ? xs.length : r.i1 + 1) : ys.slice(single ? 0 : r.j0, single ? ys.length : r.j1 + 1);
  const expected = coordinates.map((_, k) => axis === 'x' ? z[c.j][k + (single ? 0 : r.i0)] : z[k + (single ? 0 : r.j0)][c.i]);
  const slice = page.getByRole('region', { name: lang === 'es' ? 'Corte vinculado' : 'Linked slice', exact: true });
  await slice.getByRole('combobox', { name: lang === 'es' ? 'Corte vinculado' : 'Linked slice', exact: true }).selectOption(axis);
  const rendered = await jsonAttr(slice, 'data-slice-values');
  check(`${tag} exact ${axis} slice, endpoint and source coordinates`, JSON.stringify(rendered) === JSON.stringify(expected) &&
    JSON.stringify(await jsonAttr(slice, 'data-slice-coordinates')) === JSON.stringify(coordinates) && c.x === xs[c.i] && c.y === ys[c.j] && c.z === z[c.j][c.i], { selection, expected, rendered });
  if (expected.some(v => v !== null)) {
    const chartData = await jsonAttr(slice.locator('[data-plot]'), 'data-state-key');
    check(`${tag} linked chart renders source values`, JSON.stringify(chartData) === JSON.stringify([coordinates, expected]), chartData);
    await slice.getByText(lang === 'es' ? 'Tabla de datos' : 'Data table', { exact: true }).click();
    check(`${tag} accessible slice table retains gaps`, await slice.locator('tbody tr').count() === coordinates.length &&
      (await slice.locator('tbody td').allTextContents()).filter(text => text === (lang === 'es' ? 'Fuera de la envolvente de operación' : 'Outside the operating envelope')).length === expected.filter(v => v === null).length,
      await slice.locator('tbody').innerText());
    await slice.getByText(lang === 'es' ? 'Tabla de datos' : 'Data table', { exact: true }).click();
  }
}
try {
  const configurations = [
    { width: 1280, height: 800, lang: 'en', theme: 'dark', focus: false },
    { width: 1280, height: 800, lang: 'es', theme: 'light', focus: true },
    { width: 390, height: 844, lang: 'es', theme: 'dark', focus: false },
    { width: 390, height: 844, lang: 'en', theme: 'light', focus: true },
    { width: 1280, height: 800, lang: 'en', theme: 'dark', focus: false, caseId: 'phosphate_clay', yInput: 'deslime_cut_um' },
  ];
  for (const config of configurations) {
    const { lang, width, focus } = config;
    const tag = `${width}-${lang}-${config.theme}-${focus ? 'focus' : 'workbench'}${config.caseId ? '-' + config.caseId : ''}`;
    if (process.env.OF_CHART_SCENARIO && !tag.includes(process.env.OF_CHART_SCENARIO)) continue;
    const context = await browser.newContext({ viewport: { width, height: config.height }, hasTouch: width === 390 });
    await context.addInitScript(({ lang, theme }) => { localStorage.setItem('caos.lang', lang); localStorage.setItem('caos.theme', theme); }, config);
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const route = view => `${BASE}/app?case=${config.caseId || 'copper_porphyry_soft'}&variant=nominal&view=${view}${focus ? '&focus=1' : ''}`;
    await page.goto(route('response'), { waitUntil: 'networkidle', timeout: 60000 });
    const response = page.locator('.of-view-response:visible');
    await response.getByRole('button', { name: lang === 'es' ? 'Calcular' : 'Compute', exact: true }).waitFor({ timeout: 60000 });
    if (config.yInput) await response.getByRole('combobox', { name: 'Input (y)', exact: true }).selectOption(config.yInput);
    if (width === 1280 && !focus && !config.caseId) await linePan(page, response.locator('[data-plot]'), tag);
    await response.getByRole('button', { name: lang === 'es' ? 'Calcular' : 'Compute', exact: true }).click();
    try {
      await response.locator('.of-progress').waitFor({ timeout: 60000 });
      await response.locator('.of-progress').evaluate(e => new Promise((resolve, reject) => {
        const complete = () => { const n = e.textContent.match(/(\d+)\s*\/\s*(\d+)/); return !!n && n[1] === n[2]; };
        if (complete()) return resolve(true);
        const timer = setTimeout(() => { observer.disconnect(); reject(new Error('sweep progress timeout')); }, 60000);
        const observer = new MutationObserver(() => { if (complete()) { clearTimeout(timer); observer.disconnect(); resolve(true); } });
        observer.observe(e, { childList: true, subtree: true, characterData: true });
      }));
    } catch (error) {
      console.error('SWEEP DIAGNOSTIC', tag, await response.innerText());
      await page.screenshot({ path: join(EVIDENCE, `${tag}-failure.png`), fullPage: true });
      throw error;
    }
    const heatmap = response.locator('.of-heatmap');
    await heatmap.locator('canvas').waitFor(); await pause(page);
    const [xs, ys, z] = await jsonAttr(heatmap, 'data-grid-key');
    const fullView = await jsonAttr(heatmap, 'data-view');
    const inspectToggle = heatmap.locator('.of-heatmap-tools > summary');
    await inspectToggle.click();
    const scale = heatmap.getByRole('combobox', { name: lang === 'es' ? 'Escala de color' : 'Colour scale', exact: true });
    const robustMin = Number(await heatmap.locator('.of-heatmap-scale').getAttribute('data-z-min'));
    await scale.selectOption('full');
    const fullMin = Number(await heatmap.locator('.of-heatmap-scale').getAttribute('data-z-min'));
    const finite = z.flat().filter(v => v !== null);
    check(`${tag} accessible reversible scale`, await heatmap.getAttribute('data-scale') === 'full' && fullMin === Math.min(...finite) && fullMin <= robustMin, { fullMin, robustMin });
    await scale.selectOption('robust');
    check(`${tag} robust scale restored`, Number(await heatmap.locator('.of-heatmap-scale').getAttribute('data-z-min')) === robustMin, robustMin);
    await inspectToggle.click();
    await heatmap.locator('canvas').scrollIntoViewIfNeeded();
    await dragGrid(page, heatmap, [xs.length - 2, ys.length - 2], [1, 1]);
    const selection = await jsonAttr(heatmap, 'data-selection');
    check(`${tag} reverse pointer region`, selection.region.i0 === 1 && selection.region.i1 === xs.length - 2 && selection.region.j0 === 1 && selection.region.j1 === ys.length - 2, selection);
    await verifySlice(page, heatmap, tag, 'x', lang); await verifySlice(page, heatmap, tag, 'y', lang);
    await inspectToggle.click();
    await heatmap.getByRole('button', { name: lang === 'es' ? 'Ampliar selección' : 'Zoom to selection', exact: true }).click();
    check(`${tag} numeric viewport follows selected region`, JSON.stringify(await jsonAttr(heatmap, 'data-view')) === JSON.stringify(selection.region), selection.region);
    await inspectToggle.click();
    const host = heatmap.locator('.of-heatmap-plot');
    await host.focus(); await host.press('Alt+ArrowRight');
    const keyboardView = await jsonAttr(heatmap, 'data-view');
    check(`${tag} keyboard heatmap pan`, keyboardView.i0 > selection.region.i0 && keyboardView.i1 < xs.length, keyboardView);
    await inspectToggle.click();
    await heatmap.getByRole('combobox', { name: lang === 'es' ? 'Acción al arrastrar' : 'Drag action', exact: true }).selectOption('pan');
    await inspectToggle.click();
    await dragGrid(page, heatmap, [keyboardView.i0 + 1, keyboardView.j0 + 1], [keyboardView.i0 + 2, keyboardView.j0 + 1]);
    const pointerView = await jsonAttr(heatmap, 'data-view');
    check(`${tag} pointer heatmap pan`, pointerView.i0 < keyboardView.i0 && pointerView.i0 >= 0 && pointerView.i1 < xs.length, pointerView);
    await inspectToggle.click();
    await heatmap.getByRole('button', { name: lang === 'es' ? 'Restablecer inspección' : 'Reset inspection', exact: true }).click();
    await inspectToggle.click();
    check(`${tag} complete reset`, await heatmap.getAttribute('data-selection') === '' && JSON.stringify(await jsonAttr(heatmap, 'data-view')) === JSON.stringify(fullView) && await heatmap.getAttribute('data-scale') === 'robust' && await response.locator('.of-response-slice').count() === 0, fullView);
    // Select a rejected cell by keyboard; the exact slice must preserve its null rather than display zero.
    const rejected = z.flatMap((row, j) => row.map((value, i) => value === null ? [i, j] : null)).find(Boolean);
    if (config.yInput) check(`${tag} real sweep contains rejected states`, !!rejected, { rejected });
    if (rejected) {
      await host.focus();
      for (let k = 0; k < rejected[0]; k++) await host.press('ArrowRight');
      for (let k = 0; k < rejected[1]; k++) await host.press('ArrowUp');
      await host.press('Enter');
      check(`${tag} rejected cell explicit`, (await jsonAttr(heatmap, 'data-selection')).cell.z === null && /Rejected|Rechazado/.test(await heatmap.locator('output').innerText()), rejected);
      await verifySlice(page, heatmap, `${tag} null`, 'y', lang);
      await host.press('Escape');
      // Inspect a contiguous, genuinely rejected column region without manufacturing a fixture grid.
      let nullPair;
      for (let j = 0; j + 1 < ys.length && !nullPair; j++) for (let i = 0; i < xs.length; i++) {
        if (z[j][i] === null && z[j + 1][i] === null) { nullPair = [i, j]; break; }
      }
      if (nullPair) {
        await dragGrid(page, heatmap, nullPair, [nullPair[0], nullPair[1] + 1]);
        await verifySlice(page, heatmap, `${tag} null-only`, 'y', lang);
        check(`${tag} null-only slice explicitly empty`, await response.locator('.of-response-slice [role=status]').count() === 1 &&
          await response.locator('.of-response-slice canvas').count() === 0, await response.locator('.of-response-slice').innerText());
        await page.screenshot({ path: join(EVIDENCE, 'rejected-slice.png'), fullPage: true });
        await host.focus(); await host.press('Escape');
      }
    }
    if (width === 390) {
      await heatmap.locator('canvas').scrollIntoViewIfNeeded();
      const cell = await gridPoint(heatmap, 1, 1); await page.touchscreen.tap(cell.x, cell.y); await pause(page);
      const touch = await jsonAttr(heatmap, 'data-selection');
      check(`${tag} touch selects source cell`, touch.cell.i === 1 && touch.cell.j === 1, touch);
      await host.focus(); await host.press('Escape');
    }
    await host.focus(); await host.press('ArrowRight'); await host.press('Enter'); await host.press('Shift+ArrowUp');
    const extended = await jsonAttr(heatmap, 'data-selection');
    check(`${tag} keyboard region extension`, extended.region.j1 > extended.region.j0, extended);
    // Capture the actual linked view, then verify controls did not widen or escape the stage.
    await heatmap.locator('canvas').scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(EVIDENCE, `${tag}.png`), fullPage: true });
    if (width === 390) {
      await response.locator('.of-response-slice').scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(EVIDENCE, `${tag}-slice.png`), fullPage: true });
    }
    const geometry = await response.evaluate(root => {
      const r = root.getBoundingClientRect();
      const canvases = [...root.querySelectorAll('canvas')].map(e => { const b = e.getBoundingClientRect(); return { width: b.width, height: b.height }; });
      return { overX: document.documentElement.scrollWidth > innerWidth + 1, overY: document.documentElement.scrollHeight > innerHeight + 1,
        canvases, stageShare: r ? r.width * r.height / (innerWidth * innerHeight) : 0,
        canvasShare: canvases.reduce((s, c) => s + c.width * c.height, 0) / (innerWidth * innerHeight) };
    });
    check(`${tag} bounded geometry and substantive chart stage`, !geometry.overX && (width < 1280 || (!geometry.overY && geometry.stageShare >= (focus ? 0.80 : 0.50) && geometry.canvasShare / geometry.stageShare >= 0.65)) && geometry.canvases.every(c => c.width >= 150 && c.height >= 200), geometry);
    // A metric change must clear inspection while reusing the existing sweep data.
    await response.getByRole('combobox', { name: lang === 'es' ? 'Métrica' : 'Metric', exact: true }).selectOption('mill_power_kw');
    check(`${tag} metric change invalidates inspection`, await heatmap.getAttribute('data-selection') === '' && await response.locator('.of-response-slice').count() === 0, 'new metric');
    await host.focus(); await host.press('Enter');
    await response.getByRole('combobox', { name: lang === 'es' ? 'Entrada (y)' : 'Input (y)', exact: true }).selectOption('');
    check(`${tag} changed axes clear stale data and selection`, await response.locator('.of-heatmap').count() === 0 && await response.locator('.of-response-slice').count() === 0, 'one input, recompute required');
    if (width === 1280 && !focus && !config.caseId) {
      await page.goto(route('grinding'), { waitUntil: 'networkidle' });
      const logChart = page.locator('[data-log-x="true"]:visible').first(); await logChart.waitFor();
      await linePan(page, logChart, `${tag} logarithmic`);
      await page.screenshot({ path: join(EVIDENCE, 'logarithmic-pan.png'), fullPage: true });
    }
    check(`${tag} browser console`, errors.length === 0, errors);
    await context.close();
  }
  assert.ok(checks > 0, 'scenario filter must run at least one configuration');
  console.log(`PASS chart interactions: ${checks} checks; evidence ${EVIDENCE}; base ${BASE}`);
} finally { await browser.close(); }
