#!/usr/bin/env node
/**
 * Renders docs/use-cases.md and docs/use-cases/NN_<case>.md from the committed records and the authored
 * case prose, so the twelve case pages cannot drift from what the bake produced:
 *
 *   - the numbers from data/derived (the index, each case artifact and manifest, the contract);
 *   - the prose from frontend/src/content/cases.ts (the same context the workbench's Case view shows),
 *     and the references from frontend/src/content/citations.ts;
 *   - the mineral names from the engine's mineral table.
 *
 * Usage, from the repository root:
 *   node --experimental-strip-types scripts/render_use_cases.mjs            write the pages
 *   node --experimental-strip-types scripts/render_use_cases.mjs --check    exit 1 if any page is stale
 * (Node 22.18 and later strip TypeScript types without the flag; it is harmless there.)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DERIVED = join(ROOT, 'data', 'derived');
const DOCS = join(ROOT, 'docs');
const LIVE = 'https://oreflow.ml.fasl-work.com';
const CHECK = process.argv.includes('--check');

const json = rel => JSON.parse(readFileSync(join(ROOT, rel), 'utf-8'));
const { CASE_CONTEXT, VARIANT_NOTES } = await import(pathToFileURL(join(ROOT, 'frontend/src/content/cases.ts')).href);
const { CONTENT_CITATIONS } = await import(pathToFileURL(join(ROOT, 'frontend/src/content/citations.ts')).href);
const index = json('data/derived/manifests/index.json');
const contract = json('data/derived/contract/operating_contract.json');
const minerals = json('data-pipeline/pipeline/engine/data/minerals.json').minerals;
const version = readFileSync(join(ROOT, 'VERSION'), 'utf-8').trim();
const inputSpec = Object.fromEntries(contract.inputs.map(i => [i.name, i]));
const citations = Object.fromEntries(CONTENT_CITATIONS.map(c => [c.id, c]));

// ---- formatting (English; the pages are the English documentation) ----
const UNIT = { um: 'µm', 'm3/t': 'm³/t', 'm3/h': 'm³/h', 't/m3': 't/m³', '1': '' };
const unit = u => (u in UNIT ? UNIT[u] : u);
const number = (value, decimals) => (value === null || value === undefined || !Number.isFinite(value) ? '-'
  : value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
const significant = (value, digits = 3) => {
  if (!Number.isFinite(value)) return '-';
  if (value === 0) return '0';
  if (Math.abs(value) < 1e-4) return value.toExponential(digits - 1);
  const decimals = Math.max(0, digits - 1 - Math.floor(Math.log10(Math.abs(value))));
  return number(value, Math.min(decimals, 8));
};
const withUnit = (text, u) => (unit(u) === '' ? text : unit(u) === '%' ? `${text}%` : `${text} ${unit(u)}`);
const gradeDecimals = u => (u === '%' ? 2 : 1);
const METRIC = {
  recovery_pct: ['Recovery of the primary payable', 1],
  concentrate_grade: ['Concentrate grade', null],
  specific_energy_total_kwh_t: ['Specific energy, total', 2],
  specific_energy_grinding_kwh_t: ['Specific energy, grinding', 2],
  p80_um: ['Product P80', 0],
  mill_power_kw: ['Mill power', 0],
  water_intensity_m3_t: ['Water per tonne', 2],
  gravity_recovery_pct: ['Gravity recovery', 1],
  mass_pull_pct: ['Mass pull', 2],
  circulating_load_pct: ['Circulating load', 0],
  recovered_primary_tph: ['Recovered primary payable', null],
};
const KINETIC = { first_order: 'first-order', kelsall: 'Kelsall', klimpel: 'Klimpel', gamma: 'gamma', stretched_exponential: 'stretched-exponential' };
function metric(name, value, units) {
  const u = units[name] ?? '';
  const [, decimals] = METRIC[name] ?? [name, null];
  const d = decimals ?? (name.includes('grade') ? gradeDecimals(u) : 2);
  return withUnit(number(value, d), u);
}
const label = (name, units) => {
  const [text] = METRIC[name] ?? [name.replaceAll('_', ' ')];
  return text;
};
const inputDecimals = (name, reference) => (inputSpec[name].integer ? 0 : Math.abs(reference) >= 100 ? 0 : Math.abs(reference) >= 10 ? 1 : 2);
// the head grade's unit is the case's primary payable's (a % for copper, g/t for gold)
const inputValue = (name, value, reference = value, caseUnit = '') => {
  const spec = inputSpec[name];
  return withUnit(number(value, inputDecimals(name, reference)), spec.unit === 'case' ? caseUnit : spec.unit);
};
const mineralName = id => (minerals[id]?.name?.[0] ?? id);
const cell = text => String(text).replaceAll('|', '/');

// ---- one case page ----
function casePage(entry, n) {
  const artifact = json(`data/derived/${entry.artifact_path}`);
  const manifest = json(`data/derived/${entry.manifest_path}`);
  const id = artifact.case_id;
  const ctx = CASE_CONTEXT[id];
  const nominal = artifact.variants[0];
  const trace = nominal.trace;
  const units = trace.metric_units;
  const m = trace.metrics;
  const ore = artifact.definition.ore;
  const plant = artifact.definition.plant;
  const caseInputs = contract.cases[id].inputs;
  const out = [];
  const code = String(n).padStart(2, '0');
  out.push(`<!-- Generated by scripts/render_use_cases.mjs from the committed records (engine ${version}) and frontend/src/content/cases.ts. Edit those and run it; do not edit this page. -->`);
  out.push('', `# ${code} ${artifact.title.en}`, '');
  out.push(`> ${artifact.question.en}`, '');
  out.push(artifact.description.en, '');
  out.push(`| Case id | Category | Circuit family | Provenance |`, `|---|---|---|---|`);
  out.push(`| \`${id}\` | ${artifact.category} | ${artifact.family} | ${artifact.provenance} |`, '');
  out.push(`Open it in the workbench: [${LIVE}/?case=${id}](${LIVE}/?case=${id}); on its own stage: [focus](${LIVE}/focus/${id}).`, '');

  out.push('## The problem', '');
  for (const p of ctx.problem) out.push(p.en, '');

  out.push('## The ore', '');
  out.push('| Mineral | Role | Mass fraction | Liberation size | Composite content | Host | Separation response |', '|---|---|---|---|---|---|---|');
  const carrierMode = Object.fromEntries(ore.payables.flatMap(p => p.carriers.map(c => [c.mineral, `${p.species} carrier (${c.mode})`])));
  for (const mineral of ore.minerals) {
    const responds = [mineral.flotation ? 'flotation' : null, mineral.gravity ? 'gravity' : null, mineral.magnetic ? 'magnetic field' : null].filter(Boolean).join(', ') || '-';
    const stoichiometric = ore.payables.some(p => p.carriers.some(c => c.mineral === mineral.id && c.mode === 'stoichiometric'));
    const fraction = stoichiometric ? 'from the head grade' : mineral.fraction > 0 ? number(mineral.fraction, 3) : 'the balance';
    out.push(`| ${mineralName(mineral.id)} | ${carrierMode[mineral.id] ?? 'gangue'} | ${fraction} | ${mineral.liberation_size_um > 0 ? `${number(mineral.liberation_size_um, 0)} µm` : '-'} | ${mineral.composite_content > 0 ? number(mineral.composite_content, 2) : '-'} | ${mineral.host ? mineralName(mineral.host) : '-'} | ${responds} |`);
  }
  out.push('');
  out.push('| Payable | Head grade | Carried by |', '|---|---|---|');
  for (const p of ore.payables) {
    const carriers = p.carriers.map(c => `${mineralName(c.mineral)} (${number(100 * c.share, 0)}%, ${c.mode})`).join('; ');
    out.push(`| ${p.species} | ${withUnit(significant(p.head_grade, 3), p.unit)} | ${carriers} |`);
  }
  out.push('', `Bond ball-mill work index ${number(ore.work_index_kwh_t, 1)} kWh/t; crushing work index ${number(ore.crushing_work_index_kwh_t, 1)} kWh/t.`, '');

  out.push('## The plant', '');
  const rows = [
    ['Crusher', `Whiten crusher; feed F80 ${number(plant.crusher.feed_f80_um / 1000, 0)} mm`],
    ['Ball mill', `${number(plant.mill.installed_power_kw, 0)} kW installed; discharge at ${number(100 * plant.mill.discharge_solids, 0)}% solids`],
    ['Cyclones', `${number(plant.cyclone.diameter_cm, 1)} cm diameter, sharpness ${number(plant.cyclone.sharpness, 1)}; ${number(m.cyclones_required, 0)} required at the nominal state`],
  ];
  const f = plant.flotation;
  if (f) {
    const bank = (b, cells) => `${cells} cells of ${number(b.cell_volume_m3, 0)} m³`;
    rows.push(['Rougher bank', `${bank(f.rougher, nominal.point.rougher_cells)} (cells and gas velocity from the operating point)`]);
    if (f.cleaner) rows.push(['Cleaner bank', `${bank(f.cleaner, f.cleaner.cells)} at ${number(f.cleaner.jg_cm_s, 1)} cm/s`]);
    if (f.recleaner) rows.push(['Recleaner bank', `${bank(f.recleaner, f.recleaner.cells)} at ${number(f.recleaner.jg_cm_s, 1)} cm/s`]);
    if (f.regrind_energy_kwh_t > 0) rows.push(['Regrind', `${number(f.regrind_energy_kwh_t, 1)} kWh per tonne of rougher concentrate`]);
  }
  if (plant.gravity) rows.push(['Gravity unit', `on a bleed of the cyclone underflow; up to ${number(100 * plant.gravity.max_recovery, 0)}% of liberated gold per pass`]);
  if (plant.magnetic) rows.push(['Magnetic drums', `rougher and cleaner LIMS; up to ${number(100 * plant.magnetic.max_capture, 1)}% capture of liberated magnetite`]);
  if (plant.deslime) rows.push(['Desliming', `cyclones ahead of flotation; sharpness ${number(plant.deslime.sharpness, 1)}, water bypass ${number(100 * plant.deslime.bypass, 0)}%`]);
  rows.push(['Grade specification', `${plant.grade_spec.species} at least ${withUnit(number(plant.grade_spec.minimum, 1), units.concentrate_grade)}`]);
  if (plant.water_limit_m3_t > 0) rows.push(['Process water', `at most ${number(plant.water_limit_m3_t, 2)} m³ per tonne`]);
  out.push('| Unit | Declared |', '|---|---|', ...rows.map(([a, b]) => `| ${a} | ${cell(b)} |`), '');

  out.push('## The operating point', '');
  out.push('The nominal state and the bounds Contract 1 allows for this case; the workbench validates every change against them.', '');
  out.push('| Input | Nominal | Allowed range |', '|---|---|---|');
  const primaryUnit = contract.cases[id].primary.unit;
  for (const [name, bounds] of Object.entries(caseInputs)) {
    const ref = nominal.point[name];
    out.push(`| ${inputSpec[name].label.en} | ${inputValue(name, ref, ref, primaryUnit)} | ${inputValue(name, bounds.min, ref, primaryUnit)} to ${inputValue(name, bounds.max, ref, primaryUnit)} |`);
  }
  out.push('');

  out.push('## The six variants', '');
  out.push('Each variant changes exactly one input of the nominal state.', '');
  const head = ['recovery_pct', 'concentrate_grade', 'specific_energy_total_kwh_t', 'p80_um', 'mill_power_kw'];
  out.push(`| Variant | Change | ${head.map(k => label(k, units)).join(' | ')} | Flags |`, `|---|---|${head.map(() => '---|').join('')}---|`);
  for (const v of artifact.variants) {
    const change = Object.entries(v.change).map(([name, factor]) => `${inputSpec[name].label.en}: ${inputValue(name, nominal.point[name], nominal.point[name], primaryUnit)} to ${inputValue(name, v.point[name], nominal.point[name], primaryUnit)} (x${number(factor, 2)})`).join('; ') || '-';
    const flags = v.trace.flags.map(fl => `\`${fl.code}\``).join(', ') || '-';
    out.push(`| ${v.label.en} | ${cell(change)} | ${head.map(k => metric(k, v.trace.metrics[k], v.trace.metric_units)).join(' | ')} | ${flags} |`);
  }
  out.push('');
  for (const v of artifact.variants.slice(1)) {
    const note = VARIANT_NOTES[v.id];
    if (note) out.push(`- **${v.label.en}.** ${note.en}`);
  }
  out.push('');

  out.push('## At the nominal state', '');
  out.push('| Check | Value | Plausible range | Within |', '|---|---|---|---|');
  for (const [name, k] of Object.entries(manifest.kpis)) {
    out.push(`| ${label(name, units)} | ${metric(name, k.value, units)} | ${metric(name, k.range[0], units)} to ${metric(name, k.range[1], units)} | ${k.within ? 'yes' : 'no'} |`);
  }
  out.push('', `Every unit and the circuit close within ${significant(m.balance_max_relative_error, 2)} relative (the requirement is 1e-9). Water: ${metric('water_intensity_m3_t', m.water_intensity_m3_t, units)}.`, '');

  out.push('## Method records at the nominal state', '');
  const opt = nominal.methods.optimization;
  if (opt.status === 'optimal') {
    const d = Object.entries(opt.optimum.decisions).map(([name, value]) => `${inputSpec[name].label.en} ${inputValue(name, value, nominal.point[name], primaryUnit)}`).join(', ');
    out.push(`- **Optimizer:** optimal at ${d}; active constraint${opt.optimum.active.length === 1 ? '' : 's'}: ${opt.optimum.active.join(', ') || 'none'}; recovered metal ${opt.gain_pct >= 0 ? '+' : ''}${number(opt.gain_pct, 2)}% against the nominal state (${opt.evaluations} engine runs from ${opt.starts.length} starts).`);
  } else {
    const slacks = Object.entries(opt.least_violating.slacks).filter(([, s]) => s < 0).map(([c]) => c).join(', ');
    out.push(`- **Optimizer:** infeasible: no start ends within every constraint; the least-violating point misses ${slacks || 'a constraint'}.`);
  }
  const unc = nominal.methods.uncertainty;
  const rec = unc.outputs.recovery_pct;
  out.push(`- **Uncertainty** (${unc.samples} Latin-hypercube samples of the ore): recovery P05 ${metric('recovery_pct', rec.p05, units)}, P50 ${metric('recovery_pct', rec.p50, units)}, P95 ${metric('recovery_pct', rec.p95, units)}; probability of meeting every constraint ${number(100 * unc.probabilities.all_constraints, 0)}%.`);
  const sens = nominal.methods.sensitivity;
  const leaders = Object.entries(sens.indices).map(([output, idx]) => {
    if (idx.constant) return `${label(output, units).toLowerCase()} constant`;
    const [top, st] = Object.entries(idx.ST).sort((a, b) => b[1] - a[1])[0];
    return `${label(output, units).toLowerCase()}: ${top.replaceAll('_', ' ')} (total index ${number(st, 2)})`;
  });
  out.push(`- **Sobol indices** (${sens.evaluations} engine runs), the input with the largest total index: ${leaders.join('; ')}.`);
  const kin = trace.methods.kinetics;
  if (kin.status === 'not_applicable') out.push('- **Kinetic fits:** not applicable (no flotation).');
  else {
    const best = [...kin.models].sort((a, b) => Math.abs(a.lumping_error_pct) - Math.abs(b.lumping_error_pct))[0];
    const side = best.lumping_error_pct < 0 ? 'below' : 'above';
    out.push(`- **Kinetic fits:** of the five lumped models fitted to the virtual batch test, the ${KINETIC[best.id] ?? best.id} model projects the rougher bank closest to the exact bank recovery by true flotation (${number(kin.bank.exact_true_flotation_pct, 1)}%), ${number(Math.abs(best.lumping_error_pct), 2)} points ${side} it.`);
  }
  out.push('');

  out.push('## Scope and assumptions', '');
  for (const p of ctx.scope) out.push(p.en, '');
  out.push('## Reading it in the workbench', '');
  for (const p of ctx.read) out.push(p.en, '');

  out.push('## Sources', '');
  for (const [topic, text] of Object.entries(artifact.sources)) out.push(`- **${topic}:** ${text}`);
  for (const ref of ctx.refs) {
    const c = citations[ref];
    if (c) out.push(`- ${c.citation}${c.url ? ` [${c.url}](${c.url})` : ''}`);
  }
  out.push('');
  return { file: `${code}_${id}.md`, text: out.join('\n'), artifact, manifest };
}

// ---- the landing page ----
const pages = index.cases.map((entry, i) => casePage(entry, i + 1));
const landing = [
  `<!-- Generated by scripts/render_use_cases.mjs from the committed records (engine ${version}) and frontend/src/content/cases.ts. Edit those and run it; do not edit this page. -->`,
  '', '# Use cases', '',
  'Twelve authored ore and plant scenarios, three for each of four process questions: liberation, classification, flotation and integration.',
  'Each is an ore, a plant and an operating point inside published ranges, not a calibrated plant, and each comes with six variants that change one input at a time.',
  'The pages below are rendered from the committed case artifacts, so every number on them is the bake\'s; the prose is the same context the workbench\'s Case view shows.', '',
  '| Case | Question | Family | Recovery | Grade | Energy |', '|---|---|---|---|---|---|',
  ...pages.map(({ file, artifact }) => {
    const t = artifact.variants[0].trace;
    return `| [${file.slice(0, 2)} ${artifact.title.en}](use-cases/${file}) | ${artifact.question.en} | ${artifact.family} | ${metric('recovery_pct', t.metrics.recovery_pct, t.metric_units)} | ${metric('concentrate_grade', t.metrics.concentrate_grade, t.metric_units)} | ${metric('specific_energy_total_kwh_t', t.metrics.specific_energy_total_kwh_t, t.metric_units)} |`;
  }),
  '', 'The four circuit families: `rougher` (a flotation rougher with cleaners), `gravity_rougher` (a gravity unit on the grinding circuit, then flotation), `magnetic` (low-intensity magnetic drums instead of flotation) and `deslime_rougher` (desliming cyclones ahead of flotation).', '',
  'To add a case, see [guide 04](guides/04_add-a-case.md); the pages are regenerated with `node --experimental-strip-types scripts/render_use_cases.mjs`.', '',
].join('\n');

// ---- write or check ----
const targets = [[join(DOCS, 'use-cases.md'), landing], ...pages.map(p => [join(DOCS, 'use-cases', p.file), p.text])];
const stale = [];
for (const [path, text] of targets) {
  const current = existsSync(path) ? readFileSync(path, 'utf-8') : null;
  if (current === text) continue;
  if (CHECK) stale.push(path.slice(ROOT.length + 1));
  else { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text, 'utf-8'); }
}
if (CHECK) {
  if (stale.length) { console.log(`use-case pages are stale; run node --experimental-strip-types scripts/render_use_cases.mjs:\n  ${stale.join('\n  ')}`); process.exit(1); }
  console.log(`use-case pages: OK, ${targets.length} pages match the committed records`);
} else console.log(`use-case pages: ${targets.length} written`);
