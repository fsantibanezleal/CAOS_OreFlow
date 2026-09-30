import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { OperatingPoint, Ore, Plant } from '../engine';
import type { OperatingContract } from '../engine/contract';
import { optimize, type OptimizationRecord, type ScreenRecord, type Summary } from '../engine/optimize';
import { choleskyFrom, Screen, type ScreenDoc } from '../learning/screen';
import type { Scalers } from '../learning/surrogate';

// OP-08: the browser re-runs the bake's optimizer on every variant of every case, with the bake's screen, and takes
// the same steps. Each start stops for the same reason after the same number of iterations and evaluations, the
// screen screens, rejects and proposes the same candidates, the run without the screen spends the same
// evaluations, and the optimum, every start's end, every proposal's values and every step of the weight path agree
// within 1e-6 relative, because each evaluation is an engine run and the engines agree to that tolerance.
// OF_DERIVED and OF_MODELS point a development run at a sandbox bake.
// Every variant is a full optimization (six starts with the screen, six without, three path steps), about a minute
// each, so CI runs a declared subset (the nominal variants of the magnetite circuit, one decision; the oxide copper,
// where water binds; the free-milling gold, where the screen rarely passes) and OF_PARITY=full runs all 96 at release
// (docs/release-verification.md).
const SUBSET = new Set(['iron_magnetite_fine/nominal', 'copper_oxide/nominal', 'gold_free_milling/nominal']);
const FULL = process.env.OF_PARITY === 'full';
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const models = process.env.OF_MODELS ?? fileURLToPath(new URL('../../../models/', import.meta.url));
const contract = JSON.parse(readFileSync(join(derived, 'contract', 'operating_contract.json'), 'utf-8')) as OperatingContract;
const files = readdirSync(join(derived, 'cases')).filter(f => f.endsWith('.json')).sort();
const doc = JSON.parse(readFileSync(join(models, 'process_screen.json'), 'utf-8')) as ScreenDoc;
const scalers = JSON.parse(readFileSync(join(models, 'process_surrogate.json'), 'utf-8')) as Scalers;
const bin = readFileSync(join(models, doc.gp.cholesky.file));
const screen = new Screen(doc, scalers, choleskyFrom(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)));
const RELATIVE = 1e-6;

type Baked = {
  case_id: string; definition: { ore: Ore; plant: Plant };
  variants: Array<{ id: string; point: OperatingPoint; methods: { optimization: OptimizationRecord } }>;
};

const close = (a: number | null | undefined, b: number | null | undefined) =>
  (a == null || b == null) ? a == b : Math.abs(a - b) <= RELATIVE * Math.max(Math.abs(a), Math.abs(b), 1e-12);

function compareSummary(where: string, mine: Summary, baked: Summary, problems: string[]): void {
  if (mine.feasible !== baked.feasible) problems.push(`${where}.feasible: ${mine.feasible} vs ${baked.feasible}`);
  if (JSON.stringify(mine.active) !== JSON.stringify(baked.active)) problems.push(`${where}.active: ${mine.active} vs ${baked.active}`);
  for (const [k, v] of Object.entries(baked.decisions)) if (!close(mine.decisions[k], v)) problems.push(`${where}.${k}: ${mine.decisions[k]} vs ${v}`);
  if (!close(mine.recovered_tph, baked.recovered_tph)) problems.push(`${where}.recovered_tph: ${mine.recovered_tph} vs ${baked.recovered_tph}`);
  for (const [k, v] of Object.entries(baked.values)) if (!close(mine.values[k], v)) problems.push(`${where}.values.${k}: ${mine.values[k]} vs ${v}`);
}

function compareScreen(where: string, mine: Omit<ScreenRecord, 'proposals'> & { proposals?: ScreenRecord['proposals'] }, baked: typeof mine, problems: string[]): void {
  const counts = (s: typeof mine) => [s.iterations, s.screened, s.rejected.guard, s.rejected.interval, s.proposed, s.improved].join('/');
  if (counts(mine) !== counts(baked)) problems.push(`${where} screen: ${counts(mine)} vs ${counts(baked)}`);
  (baked.proposals ?? []).forEach((b, i) => {
    const m = mine.proposals?.[i];
    if (!m || m[0] !== b[0] || m[6] !== b[6]) { problems.push(`${where} proposal ${i}: ${JSON.stringify(m)} vs ${JSON.stringify(b)}`); return; }
    for (const c of [1, 2, 3, 4, 5]) if (!close(m[c] as number | null, b[c] as number | null)) problems.push(`${where} proposal ${i}[${c}]: ${m[c]} vs ${b[c]}`);
  });
}

describe('the browser reproduces the baked optimization records', () => {
  for (const file of files) {
    const artifact = JSON.parse(readFileSync(join(derived, 'cases', file), 'utf-8')) as Baked;
    for (const variant of artifact.variants) {
      if (!FULL && !SUBSET.has(`${artifact.case_id}/${variant.id}`)) continue;
      it(`${artifact.case_id}/${variant.id}`, () => {
        const baked = variant.methods.optimization;
        const { ore, plant } = artifact.definition;
        const mine = optimize(artifact.case_id, ore, plant, variant.point, contract, { screen: baked.screened ? screen.forCase(ore, plant) : null });
        expect(mine.method).toBe(baked.method);
        expect(mine.weights).toEqual(baked.weights);
        expect(mine.status).toBe(baked.status);
        expect(mine.evaluations).toBe(baked.evaluations);
        expect(mine.without_screen?.evaluations).toBe(baked.without_screen?.evaluations);
        expect(mine.without_screen?.starts).toEqual(baked.without_screen?.starts);
        expect(mine.trace?.length).toBe(baked.trace?.length);
        const problems: string[] = [];
        compareSummary('base', mine.base, baked.base, problems);
        mine.starts.forEach((s, i) => {
          const b = baked.starts[i];
          if (s.stop !== b.stop || s.iterations !== b.iterations || s.evaluations !== b.evaluations) {
            problems.push(`start ${i}: ${s.stop}/${s.iterations}/${s.evaluations} vs ${b.stop}/${b.iterations}/${b.evaluations}`);
          }
          compareSummary(`start ${i}`, s.end, b.end, problems);
          if (b.screen) compareScreen(`start ${i}`, s.screen!, b.screen, problems);
        });
        if (baked.optimum) compareSummary('optimum', mine.optimum!, baked.optimum, problems);
        if (!close(mine.gain_pct, baked.gain_pct)) problems.push(`gain_pct: ${mine.gain_pct} vs ${baked.gain_pct}`);
        for (const [k, v] of Object.entries(baked.without_screen?.decisions ?? {})) {
          if (!close(mine.without_screen?.decisions?.[k], v)) problems.push(`without_screen.${k}: ${mine.without_screen?.decisions?.[k]} vs ${v}`);
        }
        (baked.path ?? []).forEach((b, i) => {
          const s = mine.path![i];
          if (s.weight !== b.weight || s.status !== b.status || s.evaluations !== b.evaluations || s.stop !== b.stop) {
            problems.push(`path ${i}: ${s.status}/${s.evaluations}/${s.stop} vs ${b.status}/${b.evaluations}/${b.stop}`);
          }
          for (const [k, v] of Object.entries(b.decisions)) if (!close(s.decisions[k], v)) problems.push(`path ${i}.${k}: ${s.decisions[k]} vs ${v}`);
          if (!close(s.recovered_tph, b.recovered_tph)) problems.push(`path ${i}.recovered_tph: ${s.recovered_tph} vs ${b.recovered_tph}`);
          if (b.screen) compareScreen(`path ${i}`, s.screen!, b.screen, problems);
        });
        expect(problems).toEqual([]);
      }, 300_000);
    }
  }
});
