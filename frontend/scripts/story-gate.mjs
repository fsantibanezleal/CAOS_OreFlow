import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { servePages } from '@fasl-work/caos-app-shell/serve';

const frontend = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(frontend, '..');
const artifact = JSON.parse(readFileSync(join(root, 'data/derived/cases/copper_molybdenum.json'), 'utf8'));
const nominal = artifact.variants.find((variant) => variant.id === 'nominal');
assert.ok(nominal, 'the default OreFlow case has a baked nominal variant');
const server = await servePages(join(frontend, 'dist'), '/', 0, { spaFallback: true });
const browser = await chromium.launch({ headless: true });
const failures = [];
const numeric = (value) => Number(String(value).replace(/,/g, ''));
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (error) => failures.push(error.message));
  const returnTo = '/app?case=copper_molybdenum&variant=nominal&view=grinding&set=target_p80_um%3A170';
  await page.goto(`${server.url}story/circuit?case=copper_molybdenum&variant=nominal&from=${encodeURIComponent(returnTo)}`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-story-step="circuit"]').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('.oreflow-story-provenance').waitFor({ state: 'visible' });

  const expected = {
    p80: ['p80_um', 'p80_um'],
    recovery: ['recovery_pct', 'recovery_pct'],
    energy: ['specific_energy_total_kwh_t', 'specific_energy_total_kwh_t'],
  };
  for (const [id, [metric, unitKey]] of Object.entries(expected)) {
    const callout = page.locator(`[data-caos-callout="${id}"]`);
    const shown = numeric(await callout.getAttribute('data-callout-value'));
    assert.ok(Math.abs(shown - nominal.trace.metrics[metric]) < 0.02, `${id} callout is the selected artifact's ${metric}`);
    assert.equal(await callout.getAttribute('data-callout-unit'), nominal.trace.metric_units[unitKey], `${id} carries its source unit`);
    assert.ok(await callout.getAttribute('data-callout-source'), `${id} identifies its source`);
  }
  assert.equal(await page.locator('[data-story-link]').count(), 4, 'the four analytical story steps are directly reachable');

  const sceneUnit = page.locator('[data-linked-view="scene"][data-linked-id]').first();
  const firstId = await sceneUnit.getAttribute('data-linked-id');
  await sceneUnit.click();
  assert.equal(await page.locator(`[data-linked-view="panel"][data-linked-id="${firstId}"]`).getAttribute('data-linked-selected'), 'true', 'scene selection updates the evidence panel');
  const other = page.locator('[data-linked-view="panel"][data-linked-id]').nth(1);
  const otherId = await other.getAttribute('data-linked-id');
  await other.click();
  assert.equal(await page.locator(`[data-linked-view="scene"][data-linked-id="${otherId}"]`).getAttribute('data-linked-selected'), 'true', 'panel selection updates the circuit');
  const scrub = page.locator('.oreflow-story-cursor input');
  await scrub.focus();
  await scrub.press('ArrowRight');
  const position = await scrub.inputValue();
  assert.equal(await page.locator('[data-linked-cursor-marker]').getAttribute('data-linked-cursor-position'), position, 'the circuit scrubber and selected unit marker share one position');

  await page.locator('[data-story-link="compare"]').click();
  await page.locator('[data-story-step="compare"]').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /Seeded model range, P05–P95/ }).waitFor({ state: 'visible' });
  assert.match(await page.locator('.of-compare-charts').innerText(), /P05|P50|P95/i, 'the scenario comparison draws its sampled uncertainty range');
  assert.match(await page.locator('.of-compare-charts [data-plot]').first().getAttribute('aria-label') ?? '', /confidence interval|confianza/i, 'the uncertainty is explicitly qualified for screen readers');
  await page.locator('[data-story-link="methods"]').click();
  await page.locator('[data-story-step="methods"]').waitFor({ state: 'visible' });
  await page.locator('[data-story] button[aria-pressed]').first().click();
  assert.equal(await page.locator('[data-story] button[aria-pressed]').first().getAttribute('aria-pressed'), 'true', 'playback can be paused explicitly');
  await page.locator('.caos-story-exit').click();
  await page.waitForURL((url) => `${url.pathname}${url.search}` === returnTo);

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  phone.on('pageerror', (error) => failures.push(error.message));
  await phone.goto(`${server.url}story/circuit?case=copper_molybdenum&variant=nominal`, { waitUntil: 'domcontentloaded' });
  await phone.locator('[data-story-step="circuit"]').waitFor({ state: 'visible', timeout: 15000 });
  const geometry = await phone.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    stage: document.querySelector('[data-stage]').getBoundingClientRect().toJSON(),
    panel: document.querySelector('[data-stage-panel]').getBoundingClientRect().toJSON(),
    calls: [...document.querySelectorAll('[data-caos-callout]')].map((node) => node.getBoundingClientRect().toJSON()),
  }));
  assert.ok(geometry.width <= geometry.viewport + 1, 'the mobile story has no horizontal page overflow');
  assert.ok(geometry.stage.height > 0 && geometry.panel.top >= geometry.stage.top, 'mobile places the evidence panel after the stage');
  assert.ok(geometry.calls.length >= 3 && geometry.calls.every((box) => box.left >= 0 && box.right <= geometry.viewport), 'mobile keeps its three unit-bearing callouts on screen');
  assert.deepEqual(failures, [], 'no uncaught browser errors');
  console.log('OreFlow story: artifact-backed metrics, bidirectional circuit selection, linked operation scrubbing, sampled uncertainty, return-state, and mobile geometry passed.');
} finally {
  await browser.close();
  await server.close();
}
