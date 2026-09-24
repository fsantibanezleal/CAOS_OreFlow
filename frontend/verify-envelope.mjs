import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.OREFLOW_BASE_URL || 'http://127.0.0.1:5914';
const out = new URL('./qa-output/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [width, height] of [[390, 844], [628, 748], [1280, 800], [1600, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('.of-envelope-dot').first().waitFor();
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      chartWidth: document.querySelector('.of-investigation-plot')?.getBoundingClientRect().width,
    }));
    if (dimensions.documentWidth > width || dimensions.documentHeight > height) throw new Error(`overflow ${width}x${height}: ${JSON.stringify(dimensions)}`);
    if (dimensions.chartWidth < width * (width < 900 ? .7 : .45)) throw new Error(`underfilled chart at ${width}: ${dimensions.chartWidth}`);
    await page.screenshot({ path: fileURLToPath(new URL(`envelope-${width}.png`, out)), fullPage: false });
    if (width < 900) {
      await page.getByRole('tab', { name: 'Limits & point' }).click();
      await page.locator('.of-envelope-limits input').first().fill('100');
      await page.getByText('No sampled point meets every limit.').waitFor();
      await page.getByRole('button', { name: 'Reset limits' }).click();
      await page.getByRole('tab', { name: 'Analysis' }).click();
    } else {
      await page.locator('.of-envelope-limits input').first().fill('100');
      await page.getByText('No sampled point meets every limit.').waitFor();
      await page.getByRole('button', { name: 'Reset limits' }).click();
    }
    await page.locator('.of-envelope-dot.feasible').last().click();
    if (width < 900) await page.getByRole('tab', { name: 'Limits & point' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export record' }).click();
    const download = await downloadPromise;
    if (!download.suggestedFilename().endsWith('operating-envelope.json')) throw new Error('export filename');
    await page.getByRole('button', { name: 'Apply to circuit' }).click();
    await page.getByRole('tab', { name: 'Circuit' }).click();
    await page.locator('.of-source-badge.live').waitFor({ state: 'attached' });
    await page.getByRole('tab', { name: 'Investigate' }).click();
    await page.locator('.of-envelope-dot').first().waitFor();
    await page.getByRole('button', { name: 'Toggle light / dark' }).click();
    await page.getByRole('button', { name: 'Switch language' }).click();
    await page.getByText('Envolvente de operación').waitFor();
    await page.screenshot({ path: fileURLToPath(new URL(`envelope-${width}-dark-es.png`, out)), fullPage: false });
    if (errors.length) throw new Error(`${width} browser errors: ${errors.join(' | ')}`);
    results.push({ width, height, ...dimensions, export: download.suggestedFilename(), errors });
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.of-envelope-dot').first().waitFor();
  await page.locator('.of-workbench-toolbar select').first().selectOption('iron_magnetite_fine');
  await page.getByText('MAGNETIC SEPARATION').waitFor();
  await page.getByText('Feed rate', { exact: true }).waitFor();
  if (await page.getByRole('tab', { name: 'Projection' }).count()) throw new Error('magnetic case exposed flotation projection');
  await page.locator('.of-workbench-toolbar select').first().selectOption('gold_free_milling');
  await page.getByText('GRAVITY → ROUGHER').waitFor();
  await page.getByRole('tab', { name: 'Projection' }).click();
  await page.getByLabel('Rotate right').click();
  results.push({ familySwitch: 'magnetic -> gravity', projection: true });
  await page.close();
  for (const width of [390, 1280]) {
    const evidencePage = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 800 } });
    const evidenceErrors = [];
    evidencePage.on('pageerror', error => evidenceErrors.push(error.message));
    evidencePage.on('console', message => { if (message.type() === 'error') evidenceErrors.push(message.text()); });
    await evidencePage.goto(base, { waitUntil: 'networkidle' });
    await evidencePage.getByRole('link', { name: 'Benchmark', exact: true }).first().click();
    await evidencePage.getByText('Measured copper locked-cycle recovery').waitFor();
    const points = await evidencePage.locator('.of-geomet-point.prediction').count();
    if (points !== 52) throw new Error(`GeoMet rendered ${points} observations`);
    await evidencePage.locator('.of-geomet-point.prediction').nth(12).click();
    await evidencePage.locator('.of-geomet-controls select').first().selectOption('zone');
    await evidencePage.locator('.of-geomet-controls select').last().selectOption('random_forest');
    await evidencePage.screenshot({ path: fileURLToPath(new URL(`geomet-${width}.png`, out)), fullPage: false });
    await evidencePage.getByRole('button', { name: 'Toggle light / dark' }).click();
    await evidencePage.getByRole('button', { name: 'Switch language' }).click();
    await evidencePage.getByText('Recuperación medida en ciclo cerrado de cobre').waitFor();
    await evidencePage.screenshot({ path: fileURLToPath(new URL(`geomet-${width}-dark-es.png`, out)), fullPage: false });
    const docSize = await evidencePage.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportWidth: innerWidth, viewportHeight: innerHeight }));
    if (docSize.width > width || docSize.height > (width === 390 ? 844 : 800)) throw new Error(`GeoMet page overflow ${JSON.stringify(docSize)}`);
    if (evidenceErrors.length) throw new Error(`GeoMet browser errors ${evidenceErrors.join(' | ')}`);
    results.push({ geometWidth: width, points, docSize, errors: evidenceErrors });
    await evidencePage.close();
  }
  await writeFile(new URL('verification.json', out), JSON.stringify(results, null, 2));
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
} finally {
  await browser.close();
}
