import { chromium } from 'playwright';

const BASE = process.env.OF_BASE || 'http://127.0.0.1:5914';
const casesExpected = ['copper_porphyry_soft', 'copper_porphyry_hard', 'gold_free_milling', 'iron_magnetite_fine', 'nickel_sulphide',
  'phosphate_clay', 'copper_molybdenum', 'copper_oxide', 'zinc_sulfide', 'mixed_ore_high_clay', 'low_grade_copper', 'refractory_gold'];
const failures = [];
const check = (name, ok, evidence) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(evidence)}`);
  if (!ok) failures.push(name);
};
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addInitScript(() => { localStorage.setItem('caos.theme', 'dark'); localStorage.setItem('caos.lang', 'en'); });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

await page.goto(`${BASE}/app?case=copper_porphyry_soft&variant=nominal&view=circuit&focus=1`, { waitUntil: 'networkidle', timeout: 60000 });
const tour = page.locator('.of-walkthrough');
await tour.waitFor({ state: 'visible', timeout: 60000 });
await page.waitForSelector('.caos-focus-stage .of-flowmap .of-flow-unit', { timeout: 60000 });
const first = await tour.locator('.of-walkthrough-unit').innerText();
const firstSelected = await page.locator('.caos-focus-stage .of-flow-unit.selected').getAttribute('aria-label');
await tour.getByRole('button', { name: 'Next operation' }).click();
const stepped = await tour.locator('.of-walkthrough-unit').innerText();
const steppedSelected = await page.locator('.caos-focus-stage .of-flow-unit.selected').getAttribute('aria-label');
const initialLedger = await tour.locator('.of-walkthrough-streams li').count();
await tour.locator('input[type=range]').fill('700');
await tour.getByRole('button', { name: 'Play walkthrough' }).click();
await page.waitForFunction(() => Number(document.querySelector('.of-walkthrough-heading > span')?.textContent?.split('/')[0]) > 2, null, { timeout: 10000 });
const played = await tour.locator('.of-walkthrough-heading > span').innerText();
await tour.getByRole('button', { name: 'Pause walkthrough' }).click();
await page.waitForTimeout(850);
const paused = await tour.locator('.of-walkthrough-heading > span').innerText();
check('WB-016 step/play/pause and computed ledger', first !== stepped && firstSelected !== steppedSelected && stepped === steppedSelected && initialLedger > 0 && played === paused,
  { first, firstSelected, stepped, steppedSelected, initialLedger, played, paused });

await page.locator('.caos-focus-actions button').last().click();
console.log('EXIT FOCUS', await page.evaluate(() => ({ url: location.href, main: document.querySelector('.of-main')?.getAttribute('data-state') })));
await page.waitForSelector('.of-rail-case-selector select', { timeout: 30000 });
const picker = page.locator('.of-rail-case-selector select');
try {
  await page.waitForFunction(() => { const main = document.querySelector('.of-main'); return !!main && !main.hasAttribute('data-state'); }, null, { timeout: 60000 });
} catch (error) {
  console.error('EXIT FOCUS DIAGNOSTIC', JSON.stringify(await page.evaluate(() => ({
    url: location.href,
    main: document.querySelector('.of-main')?.outerHTML.slice(0, 2200),
    selector: document.querySelector('.of-rail-case-selector')?.outerHTML.slice(0, 900),
    title: document.title,
    errors: [...document.querySelectorAll('[role=alert]')].map(e => e.textContent),
  }))));
  throw error;
}
await page.locator('.of-rail-sections button').last().click();
const available = await picker.locator('option').evaluateAll(options => options.map(option => option.value).filter(Boolean));
const records = [];
for (const id of casesExpected) {
  console.log(`SELECT ${id}`);
  if (await picker.inputValue() !== id) await picker.selectOption(id);
  const beforeCase = await page.evaluate(() => ({ id: document.querySelector('.of-main')?.getAttribute('data-case'), loading: document.querySelector('.of-main')?.getAttribute('data-state') }));
  try {
    await page.waitForFunction(expected => {
      const main = document.querySelector('.of-main');
      return main?.getAttribute('data-case') === expected && !main.hasAttribute('data-state');
    }, id, { timeout: 60000 });
  } catch (error) {
    console.error('CASE TRANSITION DIAGNOSTIC', JSON.stringify(await page.evaluate(() => ({
      main: document.querySelector('.of-main')?.outerHTML.slice(0, 1400),
      selected: document.querySelector('.of-rail-case-selector select')?.value,
      errorText: document.querySelector('.of-main')?.innerText.slice(0, 800),
    }))));
    throw error;
  }
  if (beforeCase.id !== id) console.log(`CASE ${id}: transitioned from ${beforeCase.id ?? 'unknown'} (${beforeCase.loading ?? 'ready'})`);
  await page.waitForSelector('.of-main .of-flowmap .of-flow-unit', { timeout: 30000 });
  records.push(await page.evaluate(() => ({
    id: document.querySelector('.of-main')?.getAttribute('data-case'),
    units: [...document.querySelectorAll('.of-main .of-flowmap .of-flow-unit')].map(node => node.getAttribute('aria-label')),
    controls: [...document.querySelectorAll('.of-rail input[type=range]')].map(node => node.id),
    metrics: [...document.querySelectorAll('.of-readout-item strong')].map(node => node.textContent.trim()),
  })));
}
const signatures = new Set(records.map(item => item.units.join('|')));
const resultSignatures = new Set(records.map(item => item.metrics.join('|')));
const magnetite = records.find(item => item.id === 'iron_magnetite_fine');
const phosphate = records.find(item => item.id === 'phosphate_clay');
const gold = records.find(item => item.id === 'gold_free_milling');
const softCopper = records.find(item => item.id === 'copper_porphyry_soft');
const allCaseStates = records.length === casesExpected.length && records.every(item => item.units.length >= 4 && item.controls.length > 0 && item.metrics.length >= 4);
const familySpecific = signatures.size >= 4 && magnetite.units.some(name => /LIMS cleaner/i.test(name)) &&
  !magnetite.units.some(name => /^Rougher$/i.test(name)) && phosphate.units.some(name => /Desliming/i.test(name)) &&
  gold.units.some(name => /Gravity bleed/i.test(name)) &&
  !magnetite.controls.some(name => /collector_gpt|jg_cm_s|rougher_cells|gravity_bleed/.test(name)) &&
  softCopper.controls.some(name => /collector_gpt/.test(name));
check('VR-09 all 12 case circuits, controls and results', allCaseStates && familySpecific,
  { cases: records.length, caseOptions: available.length, distinctTopologies: signatures.size, distinctResults: resultSignatures.size,
    magnetite: magnetite.units, magnetiteControls: magnetite.controls, phosphate: phosphate.units, phosphateControls: phosphate.controls, gold: gold.units, goldControls: gold.controls, softCopperControls: softCopper.controls,
    missing: records.filter(item => item.units.length < 4 || !item.controls.length || item.metrics.length < 4).map(item => item.id) });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/app?case=iron_magnetite_fine&variant=nominal&view=circuit&focus=1`, { waitUntil: 'networkidle', timeout: 60000 });
await page.locator('.of-walkthrough').waitFor({ state: 'visible', timeout: 60000 });
const mobile = await page.evaluate(() => ({
  viewport: [innerWidth, innerHeight],
  documentOverX: document.documentElement.scrollWidth > innerWidth + 1,
  nextVisible: (() => { const e = document.querySelector('.of-walkthrough [aria-label="Next operation"]'); const r = e?.getBoundingClientRect(); return !!r && r.width > 0 && r.height > 0; })(),
  walkthrough: document.querySelector('.of-walkthrough')?.textContent?.includes('not elapsed plant time'),
  unit: document.querySelector('.of-walkthrough-unit')?.textContent,
}));
check('WB-016 narrow viewport reachability', !mobile.documentOverX && mobile.nextVisible && mobile.walkthrough, mobile);
check('browser console', errors.length === 0, errors.slice(0, 8));
await context.close();
await browser.close();
if (failures.length) process.exit(1);
