import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The Benchmark page states the published-example checks, the method records' findings, the learned
// lane's scores and the measured lanes' results in its prose; every number and direction it states is
// held here to the committed records, so a bake that changes one fails instead of shipping stale text.
const derived = fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const read = <T>(path: string): T => JSON.parse(readFileSync(join(derived, path), 'utf-8')) as T;
const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

type Opt = { status: string; base_feasible: boolean; gain_pct: number | null; active: string[] };
const benchmark = read<{
  oracles: {
    molycop: { published: Record<string, number>; engine: Record<string, number>; relative_error: Record<string, number>; tolerance: Record<string, number> };
    gmg: { examples: Array<Record<string, number>>; tolerance_abs_kwh_t: number };
    laplante: { published: Record<string, number[]>; engine: Record<string, number[]> };
    zandrivierspoort: { published: Record<string, number[]>; engine: Record<string, number[]>; grade_difference_pct_points: { engine: number; published: number } };
  };
  kinetics: Record<string, { fits: number; mean_abs_lumping_error_pct: number; worst_abs_lumping_error_pct: number; converged_share: number }>;
  optimization: Record<string, Record<string, Opt>>;
  uncertainty: Record<string, { recovery_pct: Record<string, number>; probabilities: Record<string, number>; dominant_input: Record<string, string> }>;
}>('benchmark.json');
const learning = read<{
  summary: Record<string, Record<string, { interpolation_r2: number; loco_r2_median: number; loco_rmse_mean: number }>>;
  interpolation: { models: { gaussian_process: Record<string, { coverage_95: number }> } };
  guard: { false_alarm_rate: number; false_accept_rate: number; false_accept_by_feature: Record<string, number> };
  leave_one_case_out: Array<{ held_out: string; held_out_flag_rate: number; models: Record<string, Record<string, { rmse: number; r2: number }>> }>;
}>('learning.json');

describe('the Benchmark page says what the records hold', () => {
  it('published examples: Moly-Cop, GMG, Laplante and Zandrivierspoort as quoted', () => {
    const m = benchmark.oracles.molycop;
    expect(Math.abs(m.relative_error.p80_um)).toBeLessThan(1e-9);
    expect(Math.abs(m.relative_error.circulating_load)).toBeLessThan(1e-9);
    expect(round(m.engine.gross_specific_energy_kwh_t, 2)).toBe(9.13);
    expect(m.published.gross_specific_energy_kwh_t).toBe(8.56);
    expect(round(100 * m.relative_error.gross_specific_energy_kwh_t, 1)).toBe(6.7);
    expect(m.tolerance.gross_specific_energy_kwh_t).toBe(0.2);
    const gmg = benchmark.oracles.gmg;
    expect(gmg.examples.map(e => round(e.engine_operating_work_index_kwh_t, 2))).toEqual([14.38, 11.71]);
    expect(gmg.examples.map(e => e.operating_work_index_kwh_t)).toEqual([14.4, 11.7]);
    for (const e of gmg.examples) expect(Math.abs(e.error_kwh_t)).toBeLessThan(0.03);
    expect(gmg.tolerance_abs_kwh_t).toBe(0.05);
    const l = benchmark.oracles.laplante;
    const g = l.engine.gravity_recovery_pct, steps = g.slice(1).map((v, i) => v - g[i]);
    expect(steps.every(s => s > 0)).toBe(true);
    expect(steps.slice(1).every((s, i) => s < steps[i])).toBe(true);
    expect([round(g[0], 1), round(g.at(-1)!, 1)]).toEqual([13.7, 31.7]);
    expect([l.published.gold_recovery_pct[0], l.published.gold_recovery_pct.at(-1)]).toEqual([64.1, 77.1]);
    const gold = l.engine.gold_circulating_load_pct;
    expect([Math.round(gold[0]), Math.round(gold.at(-1)!)]).toEqual([555, 271]);
    expect(gold.slice(1).every((v, i) => v < gold[i])).toBe(true);
    expect(gold.every((v, i) => v > l.engine.ore_circulating_load_pct[i])).toBe(true);
    expect(l.engine.ore_circulating_load_pct.every(v => Math.round(v) === 250)).toBe(true);
    expect([l.published.grg_circulating_load_pct[0], l.published.grg_circulating_load_pct.at(-1)]).toEqual([2016, 413]);
    const z = benchmark.oracles.zandrivierspoort;
    expect(z.engine.concentrate_fe_pct.map(v => round(v, 1))).toEqual([63.8, 67.8]);
    expect(z.published.concentrate_fe_pct).toEqual([64.9, 69.0]);
    expect(round(z.grade_difference_pct_points.engine, 1)).toBe(4.0);
    expect(round(z.grade_difference_pct_points.published, 1)).toBe(4.1);
    expect(z.engine.magnetite_recovery_pct.map(v => round(v, 1))).toEqual([94.9, 93.5]);
  });

  it('kinetic lumping: 66 converged fits a model, first order worst, Kelsall and gamma best', () => {
    const k = benchmark.kinetics;
    for (const record of Object.values(k)) expect([record.fits, record.converged_share]).toEqual([66, 1]);
    const mean = (id: string) => round(k[id].mean_abs_lumping_error_pct, 1), worst = (id: string) => round(k[id].worst_abs_lumping_error_pct, 1);
    expect([mean('first_order'), worst('first_order')]).toEqual([5.3, 8.4]);
    expect([mean('kelsall'), worst('kelsall')]).toEqual([0.9, 2.0]);
    expect([mean('gamma'), worst('gamma')]).toEqual([0.7, 1.9]);
    expect([mean('klimpel'), mean('stretched_exponential')]).toEqual([2.0, 3.0]);
    // the first-order model's bank: residence past the 16-minute test, and an underestimate at every nominal state
    const index = read<{ cases: Array<{ case_id: string }> }>('manifests/index.json');
    const nominal = index.cases.map(c => read<{ variants: Array<{ trace: { metrics: Record<string, number>; methods: { kinetics: { status?: string; models?: Array<{ id: string; lumping_error_pct: number }> } } } }> }>(`cases/${c.case_id}.json`).variants[0].trace)
      .filter(tr => tr.methods.kinetics.status !== 'not_applicable');
    const residence = nominal.map(tr => tr.metrics.rougher_residence_min);
    expect([Math.floor(Math.min(...residence)), Math.round(Math.max(...residence))]).toEqual([20, 30]);
    expect(Math.min(...residence)).toBeGreaterThan(16);
    expect(nominal.every(tr => tr.methods.kinetics.models!.find(m => m.id === 'first_order')!.lumping_error_pct < 0)).toBe(true);
    const order = Object.keys(k).sort((a, b) => k[a].mean_abs_lumping_error_pct - k[b].mean_abs_lumping_error_pct);
    expect(order[0]).toBe('gamma');
    expect(order.at(-1)).toBe('first_order');
  });

  it('optimization: 70 of 72 feasible, 40 variants break a constraint, every loss from one, power most often active', () => {
    const records = Object.entries(benchmark.optimization).flatMap(([id, variants]) => Object.entries(variants).map(([v, r]) => ({ id, v, r })));
    expect(records).toHaveLength(72);
    expect(records.filter(x => x.r.status === 'optimal')).toHaveLength(70);
    expect(records.filter(x => x.r.status !== 'optimal').map(x => `${x.id}:${x.v}`).sort()).toEqual(['iron_magnetite_fine:harder_ore', 'iron_magnetite_fine:higher_throughput']);
    expect(records.filter(x => !x.r.base_feasible)).toHaveLength(40);
    const gains = records.filter(x => x.r.gain_pct !== null).sort((a, b) => (a.r.gain_pct as number) - (b.r.gain_pct as number));
    expect([gains[0].id, gains[0].v, round(gains[0].r.gain_pct as number, 1)]).toEqual(['zinc_sulfide', 'harder_ore', -10.8]);
    expect([gains.at(-1)!.id, gains.at(-1)!.v, round(gains.at(-1)!.r.gain_pct as number, 1)]).toEqual(['copper_oxide', 'coarser_grind', 24.0]);
    expect(gains.filter(x => (x.r.gain_pct as number) < 0).every(x => !x.r.base_feasible)).toBe(true);
    const count = (name: string) => records.filter(x => x.r.active.includes(name)).length;
    expect([count('power'), count('grade'), count('water')]).toEqual([58, 34, 12]);
    const nominal = Object.entries(benchmark.optimization).map(([id, v]) => ({ id, gain: v.nominal.gain_pct as number })).sort((a, b) => a.gain - b.gain);
    expect([nominal[0].id, round(nominal[0].gain, 1)]).toEqual(['iron_magnetite_fine', 0.3]);
    expect([nominal.at(-1)!.id, round(nominal.at(-1)!.gain, 1)]).toEqual(['copper_oxide', 11.0]);
  });

  it('uncertainty: the spreads, the joint probabilities and the dominant inputs as quoted', () => {
    const u = benchmark.uncertainty;
    const width = Object.entries(u).map(([id, r]) => ({ id, w: r.recovery_pct.p95 - r.recovery_pct.p05 })).sort((a, b) => a.w - b.w);
    expect([width[0].id, round(width[0].w, 1)]).toEqual(['gold_free_milling', 3.7]);
    expect([width.at(-1)!.id, round(width.at(-1)!.w, 1)]).toEqual(['zinc_sulfide', 12.8]);
    const joint = Object.entries(u).map(([id, r]) => ({ id, p: r.probabilities.all_constraints })).sort((a, b) => a.p - b.p);
    expect([joint[0].id, Math.round(100 * joint[0].p)]).toEqual(['zinc_sulfide', 3]);
    expect([joint.at(-1)!.id, joint.at(-1)!.p]).toEqual(['copper_oxide', 1]);
    expect(Math.round(100 * u.zinc_sulfide.probabilities.grade_meets_spec)).toBe(5);
    const not = (key: string, value: string) => Object.entries(u).filter(([, r]) => r.dominant_input[key] !== value).map(([id]) => id).sort();
    expect(not('recovery_pct', 'floatability')).toEqual(['copper_porphyry_hard', 'iron_magnetite_fine']);
    expect(u.copper_porphyry_hard.dominant_input.recovery_pct).toBe('work_index');
    expect(u.iron_magnetite_fine.dominant_input.recovery_pct).toBe('head_grade');
    expect(not('concentrate_grade', 'liberation_size')).toEqual(['gold_free_milling', 'nickel_sulphide', 'refractory_gold']);
    expect(not('specific_energy_grinding_kwh_t', 'work_index')).toEqual([]);
    expect(not('recovered_primary_tph', 'head_grade')).toEqual([]);
  });

  it('learned lane: interpolation and transfer rank the models as quoted, and the guard behaves as described', () => {
    const s = learning.summary;
    expect(round(s.mlp.recovery_pct.interpolation_r2, 3)).toBe(0.968);
    expect(Object.keys(s).every(m => s[m].recovery_pct.interpolation_r2 <= s.mlp.recovery_pct.interpolation_r2)).toBe(true);
    expect([round(s.mlp.recovery_pct.loco_r2_median, 3), round(s.mlp.recovery_pct.loco_rmse_mean, 1)]).toEqual([0.216, 42.1]);
    expect(Object.keys(s).every(m => s[m].recovery_pct.loco_r2_median >= s.mlp.recovery_pct.loco_r2_median)).toBe(true);
    const gb = s.hist_gradient_boosting.recovery_pct;
    expect([round(gb.loco_r2_median, 3), round(gb.loco_rmse_mean, 1)]).toEqual([0.749, 11.8]);
    expect(Object.keys(s).every(m => s[m].recovery_pct.loco_r2_median <= gb.loco_r2_median)).toBe(true);
    const magnetite = learning.leave_one_case_out.find(f => f.held_out === 'iron_magnetite_fine')!;
    expect(Math.round(magnetite.models.mlp.recovery_pct.rmse)).toBe(259);
    expect(magnetite.models.mlp.recovery_pct.rmse).toBeGreaterThan(100); // only predictions outside 0 to 100% can give this
    expect([round(s.hist_gradient_boosting.specific_energy_total_kwh_t.loco_r2_median, 3), round(s.random_forest.specific_energy_total_kwh_t.loco_r2_median, 3)]).toEqual([0.887, 0.858]);
    expect(Object.keys(s).every(m => s[m].log_upgrade.loco_r2_median < 0)).toBe(true);
    const gp = learning.interpolation.models.gaussian_process;
    expect(['recovery_pct', 'log_upgrade', 'specific_energy_total_kwh_t'].map(t => round(100 * gp[t].coverage_95, 1))).toEqual([89.2, 92.0, 95.6]);
    expect(round(100 * learning.guard.false_alarm_rate, 1)).toBe(1.3);
    expect(round(100 * learning.guard.false_accept_rate, 1)).toBe(17.0);
    const byFeature = learning.guard.false_accept_by_feature;
    const blind = ['circulating_load', 'water_m3_t', 'crusher_css_mm'];
    expect(blind.map(f => Math.round(100 * byFeature[f]))).toEqual([91, 97, 97]);
    const accepted = Object.values(byFeature).reduce((a, b) => a + b, 0), fromBlind = blind.reduce((a, f) => a + byFeature[f], 0);
    expect(fromBlind / accepted).toBeGreaterThan(0.9); // almost all accepted probes step out along those three inputs
    const flagged = learning.leave_one_case_out.filter(f => f.held_out_flag_rate === 1).map(f => f.held_out).sort();
    expect(flagged).toEqual(['copper_oxide', 'gold_free_milling', 'iron_magnetite_fine', 'phosphate_clay', 'refractory_gold']);
    const others = learning.leave_one_case_out.filter(f => f.held_out_flag_rate < 1);
    expect(others).toHaveLength(7);
    expect(Math.max(...others.map(f => f.held_out_flag_rate))).toBeLessThanOrEqual(0.11);
    expect(learning.leave_one_case_out.filter(f => f.models.mlp.recovery_pct.r2 < 0)).toHaveLength(6);
    expect(learning.leave_one_case_out.filter(f => f.models.hist_gradient_boosting.recovery_pct.r2 < 0)).toHaveLength(2);
  });

  it('measured lanes: the GeoMet bootstrap and the HZDR probability errors as quoted', () => {
    const g = read<{
      source: { raw_rows: number; usable_rows: number; holes: number };
      protocols: Record<'hole' | 'zone', { folds: unknown[]; paired_bootstrap: { samples: number; rmse_differences: Record<string, { mean_pp: number; interval_95_pp: [number, number]; excludes_zero: boolean }> } }>;
    }>('source/geomet_lct_benchmark.json');
    expect([g.source.raw_rows, g.source.usable_rows, g.source.holes]).toEqual([53, 52, 29]);
    expect([g.protocols.hole.folds.length, g.protocols.zone.folds.length]).toEqual([5, 3]);
    const hole = g.protocols.hole.paired_bootstrap, zone = g.protocols.zone.paired_bootstrap;
    expect(hole.samples).toBe(2000);
    expect(Object.entries(hole.rmse_differences).filter(([, d]) => d.excludes_zero).map(([pair]) => pair)).toEqual(['train_mean-ridge']);
    const ridge = hole.rmse_differences['train_mean-ridge'];
    expect([round(ridge.mean_pp, 2), round(ridge.interval_95_pp[0], 2), round(ridge.interval_95_pp[1], 2)]).toEqual([0.42, 0.02, 0.82]);
    expect(Object.values(zone.rmse_differences).some(d => d.excludes_zero)).toBe(false);
    const p = read<{
      protocol: { train_rows: number; validation_rows: number; test_rows: number };
      cases: Array<{ case: string; test_rows: number; excluded_test_rows: number; models: Record<string, { rmse: number }> }>;
    }>('source/hzdr_particle_benchmark.json');
    expect([p.protocol.train_rows, p.protocol.validation_rows, p.protocol.test_rows]).toEqual([68008, 10202, 29147]);
    const c4 = p.cases.find(c => c.case === '4')!;
    expect([c4.test_rows, c4.excluded_test_rows]).toEqual([28484, 663]);
    const better = (model: string) => p.cases.filter(c => c.models[model].rmse < c.models.published_reference.rmse).map(c => c.case);
    expect(better('particle_mlp')).toEqual(['1', '3', '4']);
    expect(better('l1_logistic')).toEqual(['1', '2', '3']);
    expect([round(c4.models.l1_logistic.rmse, 2), round(c4.models.published_reference.rmse, 3), round(c4.models.particle_mlp.rmse, 3)]).toEqual([0.19, 0.037, 0.023]);
  });
});
