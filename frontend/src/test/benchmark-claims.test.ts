import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENGINE_BENCHMARK } from '../content/benchmark';

// The Benchmark page states the published-example checks, the method records' findings, the learned
// lane's scores and the measured lanes' results in its prose; every number and direction it states is
// held here to the committed records, so a bake that changes one fails instead of shipping stale text.
// OF_DERIVED points a development run at a sandbox bake; by default the committed records are read
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const read = <T>(path: string): T => JSON.parse(readFileSync(join(derived, path), 'utf-8')) as T;
const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

type Opt = {
  status: string; base_feasible: boolean; gain_pct: number | null; active: string[]; evaluations: number; screened: boolean;
  evaluations_without_screen?: number; screened_candidates?: number; proposed?: number; improved?: number;
  surrogate_abs_error_pp?: number | null; same_optimum_without_screen?: boolean;
  path: Array<{ weight: number; status: string; recovered_tph: number; energy_kwh_t: number | null }>;
};
type OptimizationRecord = {
  decisions: string[]; bounds: Record<string, [number, number]>;
  optimum: { decisions: Record<string, number>; recovered_tph: number; values: Record<string, number> } | null;
  without_screen?: { decisions: Record<string, number> | null; recovered_tph: number | null };
};
const benchmark = read<{
  oracles: {
    molycop: {
      inputs: Record<'p80_um' | 'circulating_load', { published: number; engine: number; relative_error: number }>;
      comparison: Record<'net_specific_energy_kwh_t' | 'gross_specific_energy_kwh_t' | 'cut_um' | 'water_bypass', { published: number; engine: number; relative_error: number }> & { overflow_passing_max_abs_difference_pct: number };
      tolerance: { net_specific_energy_kwh_t: number };
      sizing: { examples: Record<string, { published: { cyclones: number; pressure_kpa: number }; sized_for_published_cut: { cyclones: number; pressure_kpa: number }; calibration: { cut: number; pressure: number } }> };
    };
    gmg: { examples: Array<Record<string, number>>; tolerance_abs_kwh_t: number };
    laplante: {
      published: Record<string, number[]>; engine: Record<string, number[]> & { max_recovery: number; fit_at_bound: boolean; within_tolerance: boolean };
      without_grg_below_25um: Record<string, number[]> & { max_recovery: number; fit_at_bound: boolean; within_tolerance: boolean };
      audit: Record<string, number>; rising: boolean; diminishing: boolean; grg_above_ore_without_gravity: boolean;
    };
    zandrivierspoort: { published: Record<string, number[]>; engine: Record<string, number[]>; grade_difference_pct_points: { engine: number; published: number } };
  };
  kinetics: Record<string, { fits: number; mean_abs_lumping_error_pct: number; worst_abs_lumping_error_pct: number; converged_share: number }>;
  optimization: Record<string, Record<string, Opt>>;
  uncertainty: Record<string, { recovery_pct: Record<string, number>; probabilities: Record<string, number>; dominant_input: Record<string, string> }>;
}>('benchmark.json');
const learning = read<{
  summary: Record<string, Record<string, { interpolation_r2: number; loco_r2_median: number; loco_rmse_mean: number; transfer_r2_median: number; transfer_rmse_mean: number }>>;
  interpolation: { models: { gaussian_process: Record<string, { coverage_95: number }> } };
  guard: { false_alarm_rate: number; false_accept_rate: number; false_accept_by_feature: Record<string, number> };
  leave_one_case_out: Array<{ held_out: string; held_out_flag_rate: number; models: Record<string, Record<string, { rmse: number; r2: number }>> }>;
}>('learning.json');

describe('the Benchmark page says what the records hold', () => {
  it('published examples: Moly-Cop, GMG, Laplante and Zandrivierspoort as quoted', () => {
    // E-05 and E-08: every published input, net energy against net; P80 and the load are inputs
    const m = benchmark.oracles.molycop;
    expect(Math.abs(m.inputs.p80_um.relative_error)).toBeLessThan(1e-9);
    expect(Math.abs(m.inputs.circulating_load.relative_error)).toBeLessThan(1e-9);
    const c = m.comparison;
    expect([round(c.net_specific_energy_kwh_t.engine, 2), round(c.net_specific_energy_kwh_t.published, 2)]).toEqual([7.3, 7.71]);
    expect(round(100 * c.net_specific_energy_kwh_t.relative_error, 1)).toBe(-5.2);
    expect(m.tolerance.net_specific_energy_kwh_t).toBe(0.2);
    expect([Math.round(c.cut_um.engine), c.cut_um.published]).toEqual([188, 183.3]);
    expect([round(100 * c.water_bypass.engine, 1), round(100 * c.water_bypass.published, 1)]).toEqual([37.4, 37.5]);
    expect(c.overflow_passing_max_abs_difference_pct).toBeLessThan(0.5);
    // E-07: the sizing fails both published classifier states, by the factors the page quotes
    const bs = m.sizing.examples.BallSim_Direct, bp = m.sizing.examples.BallParam_Direct;
    expect([round(1 / bs.calibration.cut, 2), round(1 / bp.calibration.cut, 2)]).toEqual([1.66, 1.38]);
    expect([round(1 / bs.calibration.pressure, 1), round(1 / bp.calibration.pressure, 1)]).toEqual([2.2, 1.7]);
    expect([bs.sized_for_published_cut.cyclones, Math.round(bs.sized_for_published_cut.pressure_kpa)]).toEqual([2, 816]);
    expect([bs.published.cyclones, Math.round(bs.published.pressure_kpa)]).toEqual([6, 53]);
    const gmg = benchmark.oracles.gmg;
    expect(gmg.examples.map(e => round(e.engine_operating_work_index_kwh_t, 2))).toEqual([14.38, 11.71]);
    expect(gmg.examples.map(e => e.operating_work_index_kwh_t)).toEqual([14.4, 11.7]);
    for (const e of gmg.examples) expect(Math.abs(e.error_kwh_t)).toBeLessThan(0.03);
    expect(gmg.tolerance_abs_kwh_t).toBe(0.05);
    // E-11: the simulator example like for like, as the page quotes it
    const l = benchmark.oracles.laplante, e = l.engine, w = l.without_grg_below_25um;
    expect(l.published.grg_recovery_pct).toEqual([79.78, 88.28, 91.79, 93.74, 94.75, 95.85]);
    expect([l.published.grg_circulating_load_pct[0], l.published.grg_circulating_load_pct[3], l.published.grg_circulating_load_pct.at(-1)]).toEqual([2016.31, 602.84, 412.63]);
    expect(e.fit_at_bound && e.max_recovery === 1 && !e.within_tolerance).toBe(true);
    expect([round(e.grg_recovery_pct[0], 1), round(e.grg_recovery_pct.at(-1)!, 1)]).toEqual([69.5, 90.7]);
    const missed = e.grg_recovery_pct.map((v, i) => l.published.grg_recovery_pct[i] - v);
    expect([round(Math.max(...missed), 1), round(Math.min(...missed), 1)]).toEqual([10.3, 5.2]);
    const clLow = e.grg_circulating_load_pct.map((v, i) => 100 * (1 - v / l.published.grg_circulating_load_pct[i]));
    expect([Math.round(Math.min(...clLow)), Math.round(Math.max(...clLow))]).toEqual([65, 80]);
    expect([Math.round(Math.min(...e.grg_to_overflow_pct)), Math.round(Math.max(...e.grg_to_overflow_pct))]).toEqual([9, 31]);
    expect([round(Math.min(...e.discharge_grg_below_150um_pct), 1), round(Math.max(...e.discharge_grg_below_150um_pct), 1)]).toEqual([86.7, 88.3]);
    expect(round(w.max_recovery, 2)).toBe(0.74);
    const near = w.grg_recovery_pct.map((v, i) => Math.abs(v - l.published.grg_recovery_pct[i]));
    expect([round(Math.max(...near.slice(1)), 1), round(near[0], 1)]).toEqual([1.1, 4.8]);
    const wLow = w.grg_circulating_load_pct.map((v, i) => 100 * (1 - v / l.published.grg_circulating_load_pct[i]));
    expect([Math.round(Math.min(...wLow)), Math.round(Math.max(...wLow))]).toEqual([50, 69]);
    expect([Math.round(l.audit.grg_circulating_load_pct), round(l.audit.underflow_over_overflow_au_grade, 1), Math.round(100 * l.audit.underflow_grg_share)]).toEqual([2812, 9.3, 97]);
    expect(l.rising && l.diminishing && l.grg_above_ore_without_gravity).toBe(true);
    const z = benchmark.oracles.zandrivierspoort;
    expect(z.engine.concentrate_fe_pct.map(v => round(v, 1))).toEqual([63.8, 67.8]);
    expect(z.published.concentrate_fe_pct).toEqual([64.9, 69.0]);
    expect(round(z.grade_difference_pct_points.engine, 1)).toBe(4.0);
    expect(round(z.grade_difference_pct_points.published, 1)).toBe(4.1);
    expect(z.engine.magnetite_recovery_pct.map(v => round(v, 1))).toEqual([94.9, 93.5]);
  });

  it('kinetic lumping: 88 converged fits a model, first order worst, gamma then Kelsall best', () => {
    const k = benchmark.kinetics;
    for (const record of Object.values(k)) expect([record.fits, record.converged_share]).toEqual([88, 1]);
    const mean = (id: string) => round(k[id].mean_abs_lumping_error_pct, 1), worst = (id: string) => round(k[id].worst_abs_lumping_error_pct, 1);
    expect([mean('first_order'), worst('first_order')]).toEqual([7.6, 19.1]);
    expect([round(k.gamma.mean_abs_lumping_error_pct, 2), round(k.kelsall.mean_abs_lumping_error_pct, 2)]).toEqual([1.27, 1.81]);
    expect([worst('gamma'), worst('kelsall')]).toEqual([5.1, 8.5]);
    expect([mean('klimpel'), mean('stretched_exponential')]).toEqual([2.8, 4.8]);
    // the first-order model's bank: residence past the 16-minute test, and an underestimate at every nominal state
    const index = read<{ cases: Array<{ case_id: string }> }>('manifests/index.json');
    const nominal = index.cases.map(c => read<{ variants: Array<{ trace: { metrics: Record<string, number>; methods: { kinetics: { status?: string; models?: Array<{ id: string; lumping_error_pct: number }> } } } }> }>(`cases/${c.case_id}.json`).variants[0].trace)
      .filter(tr => tr.methods.kinetics.status !== 'not_applicable');
    const residence = nominal.map(tr => tr.metrics.rougher_residence_min);
    expect([Math.round(Math.min(...residence)), Math.round(Math.max(...residence))]).toEqual([23, 84]);
    const text = ENGINE_BENCHMARK.KINETICS.paragraphs.map(p => p.en).join(' ');
    expect(text).toMatch(/7\.6 points of recovery on average and 19\.1 at worst/);
    expect(text).toMatch(/nominal bank residence ranges from 23 to 84 minutes/);
    expect(text).toMatch(/Gamma and Kelsall lose 1\.27 and 1\.81 points on average, with worst errors of 5\.1 and 8\.5; Klimpel averages 2\.80 and the stretched exponential 4\.76 points/);
    expect(Math.min(...residence)).toBeGreaterThan(16);
    expect(nominal.every(tr => tr.methods.kinetics.models!.find(m => m.id === 'first_order')!.lumping_error_pct < 0)).toBe(true);
    const order = Object.keys(k).sort((a, b) => k[a].mean_abs_lumping_error_pct - k[b].mean_abs_lumping_error_pct);
    expect(order[0]).toBe('gamma');
    expect(order.at(-1)).toBe('first_order');
  });

  it('optimization: 94 of 96 feasible, 28 target-mode variants break a constraint, the one loss from one, power most often active', () => {
    const records = Object.entries(benchmark.optimization).flatMap(([id, variants]) => Object.entries(variants).map(([v, r]) => ({ id, v, r })));
    expect(records).toHaveLength(96);
    expect(records.filter(x => x.r.status === 'optimal')).toHaveLength(94);
    expect(records.filter(x => x.r.status !== 'optimal').map(x => `${x.id}:${x.v}`).sort()).toEqual(['iron_magnetite_fine:harder_ore', 'iron_magnetite_fine:higher_throughput']);
    const cut = records.filter(x => x.v.startsWith('cut_')), target = records.filter(x => !x.v.startsWith('cut_'));
    expect([target.length, target.filter(x => !x.r.base_feasible).length]).toEqual([72, 29]);
    expect([cut.length, cut.filter(x => !x.r.base_feasible).length, cut.filter(x => x.r.status === 'optimal').length]).toEqual([24, 0, 24]);
    const gains = records.filter(x => x.r.gain_pct !== null).sort((a, b) => (a.r.gain_pct as number) - (b.r.gain_pct as number));
    expect([gains[0].id, gains[0].v, round(gains[0].r.gain_pct as number, 1)]).toEqual(['iron_magnetite_fine', 'coarser_grind', -0.8]);
    expect([gains.at(-1)!.id, gains.at(-1)!.v, round(gains.at(-1)!.r.gain_pct as number, 1)]).toEqual(['copper_oxide', 'coarser_grind', 20.0]);
    // both ends of the range are measured from a state that broke a constraint, as the page says
    expect([gains[0].r.base_feasible, gains.at(-1)!.r.base_feasible]).toEqual([false, true]);
    const losses = gains.filter(x => (x.r.gain_pct as number) < 0);
    expect(losses).toHaveLength(2);
    expect(losses.every(x => !x.r.base_feasible)).toBe(true);
    const count = (name: string, set = records) => set.filter(x => x.r.active.includes(name)).length;
    expect([count('power'), count('grade'), count('water')]).toEqual([70, 31, 20]);
    expect(count('power', cut)).toBe(24);
    const nominal = Object.entries(benchmark.optimization).map(([id, v]) => ({ id, gain: v.nominal.gain_pct as number })).sort((a, b) => a.gain - b.gain);
    expect([nominal[0].id, round(nominal[0].gain, 1)]).toEqual(['iron_magnetite_fine', 0.3]);
    expect([nominal.at(-1)!.id, round(nominal.at(-1)!.gain, 1)]).toEqual(['copper_oxide', 7.9]);
    const cutGains = cut.map(x => ({ id: x.id, gain: x.r.gain_pct as number })).sort((a, b) => a.gain - b.gain);
    expect([cutGains[0].id, round(cutGains[0].gain, 1), cutGains.at(-1)!.id, round(cutGains.at(-1)!.gain, 1)]).toEqual(['iron_magnetite_fine', 0.3, 'zinc_sulfide', 6.2]);
    const text = ENGINE_BENCHMARK.OPTIMIZATION.paragraphs.map(p => p.en).join(' ');
    expect(text).toMatch(/94 of the 96 variants/);
    expect(text).toMatch(/Twenty-nine of the 72 target-mode variants/);
    expect(text).toMatch(/from -0\.8% \(magnetite with a coarser grind\) to \+20\.0% \(oxide copper with a coarser grind\)/);
    expect(text).toMatch(/Nominal gains run from 0\.3% \(magnetite\) to 7\.9% \(oxide copper\)/);
    expect(text).toMatch(/their optimized gains range from 0\.3% in magnetite to 6\.2% in zinc sulphide/);
    expect(text).toMatch(/active at 70 of the 94 optima and at all 24 in the cut mode, then the grade specification at 31 and the water capacity at 20/);
  });

  it('optimization: what the screen cost, the surrogate\'s error, the unscreened optima and the weight path (OP-07, OP-11)', () => {
    const records = Object.entries(benchmark.optimization).flatMap(([id, variants]) => Object.entries(variants).map(([v, r]) => ({ id, v, r })));
    const screened = records.filter(x => x.r.screened);
    // the learned lane describes the target mode, so exactly the target-mode variants are screened
    expect(screened.map(x => `${x.id}:${x.v}`).sort()).toEqual(records.filter(x => !x.v.startsWith('cut_')).map(x => `${x.id}:${x.v}`).sort());
    const sum = (f: (r: Opt) => number) => screened.reduce((a, x) => a + f(x.r), 0);
    const withScreen = sum(r => r.evaluations), without = sum(r => r.evaluations_without_screen!);
    expect([withScreen, without, round(100 * (withScreen / without - 1), 1)]).toEqual([26367, 22487, 17.3]);
    const change = screened.map(x => x.r.evaluations - x.r.evaluations_without_screen!);
    expect([change.filter(c => c < 0).length, change.filter(c => c > 0).length, change.filter(c => c === 0).length]).toEqual([0, 68, 4]);
    expect([sum(r => r.proposed!), sum(r => r.screened_candidates!), sum(r => r.improved!)]).toEqual([5811, 79034, 901]);
    // the rejections by reason are in the case records' per-start screen counts
    const rejected = { guard: 0, interval: 0 };
    for (const x of screened) {
      const starts = read<{ variants: Array<{ id: string; methods: { optimization: { starts: Array<{ screen: { rejected: Record<string, number> } }> } } }> }>(`cases/${x.id}.json`)
        .variants.find(v => v.id === x.v)!.methods.optimization.starts;
      for (const s of starts) { rejected.guard += s.screen.rejected.guard; rejected.interval += s.screen.rejected.interval; }
    }
    expect([rejected.guard, rejected.interval]).toEqual([19, 48268]);
    const errors = screened.map(x => x.r.surrogate_abs_error_pp).filter((e): e is number => typeof e === 'number');
    expect(round(errors.reduce((a, e) => a + e, 0) / errors.length, 2)).toBe(0.66);
    const differ = screened.filter(x => !x.r.same_optimum_without_screen);
    expect([screened.length - differ.length, differ.length]).toEqual([65, 7]);
    // the two that differ, both low-grade copper: the unscreened search recovers more metal in each, within 0.02% and
    // one or two finest mesh steps away in any decision
    const artifact = (id: string) => read<{ variants: Array<{ id: string; methods: { optimization: OptimizationRecord } }> }>(`cases/${id}.json`);
    const meshMinimum = 2 ** -10;
    const gaps = differ.map(x => {
      const rec = artifact(x.id).variants.find(v => v.id === x.v)!.methods.optimization;
      const plain = rec.without_screen!;
      const steps = Math.max(...rec.decisions.map(n => Math.abs(rec.optimum!.decisions[n] - plain.decisions![n]) / ((rec.bounds[n][1] - rec.bounds[n][0]) * meshMinimum)));
      return { key: `${x.id}:${x.v}`, short: 1 - rec.optimum!.recovered_tph / plain.recovered_tph!, steps: Math.round(steps) };
    });
    expect(gaps.filter(g => g.short > 0)).toHaveLength(5);
    expect(gaps.filter(g => g.short < 0)).toHaveLength(2);
    expect(gaps.every(g => g.steps >= 1 && g.steps <= 5)).toBe(true);
    expect(gaps.map(g => g.key).sort()).toEqual(['low_grade_copper:harder_ore', 'low_grade_copper:higher_throughput', 'mixed_ore_high_clay:coarser_grind', 'mixed_ore_high_clay:more_collector', 'mixed_ore_high_clay:nominal', 'nickel_sulphide:harder_ore', 'zinc_sulfide:coarser_grind']);
    // OP-07: at a quarter of the weight on metal the nominal optima trade metal for energy, except magnetite's
    const trade = Object.keys(benchmark.optimization).map(id => {
      const opt = artifact(id).variants[0].methods.optimization.optimum!, last = benchmark.optimization[id].nominal.path.at(-1)!;
      expect([last.weight, last.status]).toEqual([0.25, 'optimal']);
      return { id, energy: 100 * (1 - last.energy_kwh_t! / opt.values.energy_kwh_t), metal: 100 * (1 - last.recovered_tph / opt.recovered_tph) };
    });
    const moved = trade.filter(x => x.id !== 'iron_magnetite_fine');
    expect([Math.round(Math.min(...moved.map(x => x.energy))), Math.round(Math.max(...moved.map(x => x.energy)))]).toEqual([0, 42]);
    expect([Math.round(Math.min(...moved.map(x => x.metal))), Math.round(Math.max(...moved.map(x => x.metal)))]).toEqual([0, 29]);
    const magnetite = trade.find(x => x.id === 'iron_magnetite_fine')!;
    expect([Math.abs(magnetite.energy) < 1e-9, Math.abs(magnetite.metal) < 1e-9]).toEqual([true, true]);
    expect(benchmark.optimization.iron_magnetite_fine.nominal.active).toContain('grade');
    // along every full path neither energy nor metal rises as the weight falls, beyond the mesh's resolution
    let worst = 0;
    for (const x of records.filter(r => r.r.status === 'optimal' && r.r.path.every(s => s.status === 'optimal'))) {
      const opt = artifact(x.id).variants.find(v => v.id === x.v)!.methods.optimization.optimum!;
      const energy = [opt.values.energy_kwh_t, ...x.r.path.map(s => s.energy_kwh_t!)], metal = [opt.recovered_tph, ...x.r.path.map(s => s.recovered_tph)];
      for (const series of [energy, metal]) for (let k = 1; k < series.length; k += 1) worst = Math.max(worst, series[k] / series[k - 1] - 1);
    }
    expect(worst).toBeLessThan(1e-4);
    const text = ENGINE_BENCHMARK.OPTIMIZATION.paragraphs.map(p => p.en).join(' ');
    expect(text).toMatch(/26,367 engine evaluations versus 22,487 without screening, 17\.3% more/);
    expect(text).toMatch(/Of 79,034 candidates, 19 were rejected by the guard and 48,268 by the uncertainty interval; 5,811 were proposed to the engine and 901 improved/);
    expect(text).toMatch(/0\.66 points per variant/);
    expect(text).toMatch(/same optimum in 65 variants. In the seven differing cases, metal differs by at most 0.017% and decisions by one to five mesh steps; five favour the unscreened result and two the screened result/);
    expect(text).toMatch(/spends 0 to 42% less energy per tonne and 0 to 29% less metal/);
    expect(text).toMatch(/beyond 0\.01%, the mesh's resolution/);
  });

  it('uncertainty: the spreads, the joint probabilities and the dominant inputs as quoted', () => {
    const u = benchmark.uncertainty;
    const width = Object.entries(u).map(([id, r]) => ({ id, w: r.recovery_pct.p95 - r.recovery_pct.p05 })).sort((a, b) => a.w - b.w);
    expect([width[0].id, round(width[0].w, 1)]).toEqual(['mixed_ore_high_clay', 1.5]);
    expect([width.at(-1)!.id, round(width.at(-1)!.w, 1)]).toEqual(['zinc_sulfide', 9.7]);
    const joint = Object.entries(u).map(([id, r]) => ({ id, p: r.probabilities.all_constraints })).sort((a, b) => a.p - b.p);
    expect([joint[0].id, Math.round(100 * joint[0].p)]).toEqual(['zinc_sulfide', 44]);
    const m = u.iron_magnetite_fine.probabilities;
    expect([Math.round(100 * m.grade_meets_spec), Math.round(100 * m.power_within_installed)]).toEqual([66, 79]);
    const top = joint.filter(x => x.p === joint.at(-1)!.p).map(x => x.id).sort();
    expect([top, Math.round(100 * joint.at(-1)!.p)]).toEqual([['copper_oxide'], 88]);
    // the record's phosphate case is two draws of 128 above the soft porphyry
    expect([Math.round(100 * u.copper_porphyry_soft.probabilities.all_constraints), Math.round(128 * (u.phosphate_clay.probabilities.all_constraints - u.copper_porphyry_soft.probabilities.all_constraints))]).toEqual([82, 2]);
    const not = (key: string, value: string) => Object.entries(u).filter(([, r]) => r.dominant_input[key] !== value).map(([id]) => id).sort();
    expect(not('recovery_pct', 'floatability')).toEqual(['copper_porphyry_hard', 'iron_magnetite_fine']);
    expect(u.copper_porphyry_hard.dominant_input.recovery_pct).toBe('work_index');
    expect(u.iron_magnetite_fine.dominant_input.recovery_pct).toBe('head_grade');
    expect(not('concentrate_grade', 'liberation_size')).toEqual(['copper_oxide', 'gold_free_milling', 'mixed_ore_high_clay', 'nickel_sulphide', 'refractory_gold']);
    expect(not('specific_energy_grinding_kwh_t', 'work_index')).toEqual([]);
    expect(not('recovered_primary_tph', 'head_grade')).toEqual([]);
    // UQ-08: the page says which record the workbench re-runs live and which stays baked
    const limits = (ENGINE_BENCHMARK.UNCERTAINTY.limits ?? []).map(l => l.en).join(' ');
    expect(limits).toMatch(/re-runs the uncertainty record/);
    expect(limits).toMatch(/Sobol indices are precomputed only/);
  });

  it('learned lane: interpolation and transfer rank the models as quoted, and the guard behaves as described', () => {
    const s = learning.summary, models = Object.keys(s);
    expect(round(s.mlp.recovery_pct.interpolation_r2, 3)).toBe(0.951);
    expect(models.every(m => s[m].recovery_pct.interpolation_r2 <= s.mlp.recovery_pct.interpolation_r2)).toBe(true);
    expect([round(s.mlp.recovery_pct.loco_r2_median, 3), round(s.mlp.recovery_pct.loco_rmse_mean, 1)]).toEqual([0.547, 26.2]);
    expect(round(s.mlp.recovery_pct.loco_rmse_mean, 1)).toBe(26.2);
    const gb = s.hist_gradient_boosting.recovery_pct, rf = s.random_forest.recovery_pct;
    expect([round(gb.loco_r2_median, 3), round(gb.loco_rmse_mean, 1), round(rf.loco_rmse_mean, 1)]).toEqual([0.512, 12.7, 13.2]);
    // the MLP has the best median one-case-out R² on recovery, gradient boosting next
    const byMedian = [...models].sort((a, b) => s[b].recovery_pct.loco_r2_median - s[a].recovery_pct.loco_r2_median);
    expect(byMedian.slice(0, 2)).toEqual(['mlp', 'hist_gradient_boosting']);
    expect(round(s.gaussian_process.recovery_pct.loco_rmse_mean, 1)).toBe(10.9);
    const folds = learning.leave_one_case_out, fold = (id: string) => folds.find(f => f.held_out === id)!;
    const magnetite = fold('iron_magnetite_fine'), phosphate = fold('phosphate_clay');
    const worstFold = folds.reduce((a, b) => (b.models.mlp.recovery_pct.rmse > a.models.mlp.recovery_pct.rmse ? b : a));
    expect([worstFold.held_out, Math.round(phosphate.models.mlp.recovery_pct.rmse), Math.round(magnetite.models.mlp.recovery_pct.rmse)]).toEqual(['iron_magnetite_fine', 9, 240]);
    expect(magnetite.models.mlp.recovery_pct.rmse).toBeGreaterThan(100); // only predictions outside 0 to 100% can give this
    const copper = ['copper_porphyry_soft', 'copper_porphyry_hard', 'copper_molybdenum', 'mixed_ore_high_clay', 'low_grade_copper'];
    for (const id of copper) {
      const m = fold(id).models;
      if (id === 'mixed_ore_high_clay') expect(m.random_forest.recovery_pct.rmse).toBeLessThan(m.mlp.recovery_pct.rmse);
      else expect(m.mlp.recovery_pct.rmse).toBeLessThan(Math.min(...Object.entries(m).filter(([k]) => k !== 'mlp').map(([, v]) => v.recovery_pct.rmse)));
    }
    const energy = models.filter(m => m !== 'ridge').map(m => s[m].specific_energy_total_kwh_t.loco_r2_median);
    expect([round(Math.min(...energy), 3), round(Math.max(...energy), 3)]).toEqual([0.900, 0.952]);
    expect(models.filter(m => m !== 'mlp').every(m => s[m].log_upgrade.loco_r2_median < 0)).toBe(true);
    expect(round(s.mlp.log_upgrade.loco_r2_median, 3)).toBe(0.243);
    const gp = learning.interpolation.models.gaussian_process;
    const coverage = ['recovery_pct', 'log_upgrade', 'specific_energy_total_kwh_t'].map(t => 100 * gp[t].coverage_95);
    expect(coverage.map(c => round(c, 1))).toEqual([90.7, 91.3, 93.6]);
    expect(coverage.every(c => c < 95)).toBe(true);
    expect(round(100 * learning.guard.false_alarm_rate, 1)).toBe(1.5);
    expect(round(100 * learning.guard.false_accept_rate, 1)).toBe(15.5);
    const byFeature = learning.guard.false_accept_by_feature;
    const blind = ['crusher_css_mm', 'water_m3_t', 'circulating_load'];
    expect(Object.keys(byFeature).sort((a, b) => byFeature[b] - byFeature[a]).slice(0, 3)).toEqual(blind);
    expect(blind.map(f => Math.round(100 * byFeature[f]))).toEqual([95, 69, 42]);
    const accepted = Object.values(byFeature).reduce((a, b) => a + b, 0), fromBlind = blind.reduce((a, f) => a + byFeature[f], 0);
    expect(Math.round(100 * fromBlind / accepted)).toBe(74);
    const flagged = folds.filter(f => f.held_out_flag_rate === 1).map(f => f.held_out).sort();
    expect(flagged).toEqual(['copper_oxide', 'iron_magnetite_fine', 'phosphate_clay', 'refractory_gold']);
    expect([Math.round(100 * fold('nickel_sulphide').held_out_flag_rate), Math.round(100 * fold('zinc_sulfide').held_out_flag_rate)]).toEqual([71, 9]);
    expect(round(100 * fold('mixed_ore_high_clay').held_out_flag_rate, 1)).toBe(95.3);
    const copper_sulphides = copper.filter(id => id !== 'mixed_ore_high_clay');
    expect(round(100 * Math.max(...copper_sulphides.map(id => fold(id).held_out_flag_rate)), 1)).toBe(16.0);
    expect(folds.filter(f => f.models.mlp.recovery_pct.r2 < 0).map(f => f.held_out).sort()).toEqual(['gold_free_milling', 'iron_magnetite_fine']);
  });

  it('measured lanes: the GeoMet bootstrap and the HZDR probability errors as quoted', () => {
    const g = read<{
      source: { raw_rows: number; usable_rows: number; holes: number };
      protocols: Record<'hole' | 'zone', { folds: unknown[]; paired_bootstrap: { samples: number; rmse_differences: Record<string, { mean_pp: number; interval_95_pp: [number, number]; excludes_zero: boolean }> };
        robust?: Record<'repeated_partitions' | 'leave_one_hole_out', { rmse_differences: Record<string, { difference_pp: number; interval_adjusted_pp: [number, number]; excludes_zero: boolean }>; ridge_gain_over_mean_pp?: { mean: number; published_percentile: number } }> }>;
    }>('source/geomet_lct_benchmark.json');
    expect([g.source.raw_rows, g.source.usable_rows, g.source.holes]).toEqual([53, 52, 29]);
    expect([g.protocols.hole.folds.length, g.protocols.zone.folds.length]).toEqual([5, 3]);
    const hole = g.protocols.hole.paired_bootstrap, zone = g.protocols.zone.paired_bootstrap;
    expect(hole.samples).toBe(2000);
    expect(Object.entries(hole.rmse_differences).filter(([, d]) => d.excludes_zero).map(([pair]) => pair)).toEqual(['train_mean-ridge']);
    const ridge = hole.rmse_differences['train_mean-ridge'];
    expect([round(ridge.mean_pp, 2), round(ridge.interval_95_pp[0], 2), round(ridge.interval_95_pp[1], 2)]).toEqual([0.42, 0.02, 0.82]);
    expect(Object.values(zone.rmse_differences).some(d => d.excludes_zero)).toBe(false);
    // M-05: the fixed partition is extreme; over partitions and leaving a hole out nothing separates
    const robust = g.protocols.hole.robust!;
    const rp = robust.repeated_partitions, lo = robust.leave_one_hole_out;
    expect([rp.ridge_gain_over_mean_pp!.published_percentile, round(rp.ridge_gain_over_mean_pp!.mean, 2)]).toEqual([98.5, 0.18]);
    const rr = rp.rmse_differences['train_mean-ridge'], lr = lo.rmse_differences['train_mean-ridge'];
    expect([round(rr.difference_pp, 2), round(rr.interval_adjusted_pp[0], 2), round(rr.interval_adjusted_pp[1], 2)]).toEqual([0.17, -0.39, 0.71]);
    expect([round(lr.difference_pp, 2), round(lr.interval_adjusted_pp[0], 2), round(lr.interval_adjusted_pp[1], 2)]).toEqual([0.22, -0.36, 0.79]);
    expect([...Object.values(rp.rmse_differences), ...Object.values(lo.rmse_differences)].some(d => d.excludes_zero)).toBe(false);
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
    // M-09: the network against the linear model, the ordering the sentence once read as the opposite
    expect(p.cases.filter(c => c.models.l1_logistic.rmse < c.models.particle_mlp.rmse).map(c => c.case)).toEqual(['1', '2']);
    expect([round(c4.models.l1_logistic.rmse, 2), round(c4.models.published_reference.rmse, 3), round(c4.models.particle_mlp.rmse, 3)]).toEqual([0.19, 0.037, 0.023]);
  });
});

// The review of 2026-10-02 (dimension 2, M items; E-10): every statistic the rewritten paragraphs quote is recomputed
// here from the records, so the next precompute cannot leave a number the record no longer holds
describe('the Benchmark statistics say what they hold (M-06 to M-23, E-10)', () => {
  const learning = read<any>('learning.json'), studies = read<any>('studies.json'), bench = read<any>('benchmark.json');
  const en = (topic: { paragraphs: Array<{ en: string }> }) => topic.paragraphs.map(p => p.en).join(' ');
  const folds: any[] = learning.leave_one_case_out;
  const fold = (id: string) => folds.find(f => f.held_out === id);
  const copper = ['copper_porphyry_soft', 'copper_porphyry_hard', 'copper_molybdenum', 'mixed_ore_high_clay', 'low_grade_copper'];
  const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

  it('M-06: the spreads and extremes over the seed study', () => {
    const cases = Object.keys(studies.cases);
    const widths = (c: string): number[] => studies.cases[c].seed_study.per_seed.map((p: any) => p.recovery_pct.p95 - p.recovery_pct.p05);
    const joint = (c: string): number[] => studies.cases[c].seed_study.per_seed.map((p: any) => p.all_constraints);
    const seeds = widths(cases[0]).length;
    const extreme = (f: (c: string) => number[], pick: (a: number, b: number) => boolean) =>
      Array.from({ length: seeds }, (_, i) => cases.reduce((a, b) => (pick(f(b)[i], f(a)[i]) ? b : a)));
    expect(new Set(extreme(widths, (a, b) => a < b))).toEqual(new Set(['mixed_ore_high_clay']));
    expect(new Set(extreme(widths, (a, b) => a > b))).toEqual(new Set(['zinc_sulfide']));
    expect(extreme(joint, (a, b) => a < b).filter(c => c === 'iron_magnetite_fine')).toHaveLength(0);
    const g = widths('mixed_ore_high_clay'), z = widths('zinc_sulfide'), m = joint('iron_magnetite_fine');
    const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    expect([round(mean(g), 1), round(Math.min(...g), 1), round(Math.max(...g), 1), round(mean(z), 1), round(Math.min(...z), 1), round(Math.max(...z), 1)]).toEqual([1.6, 1.5, 1.7, 10.9, 10.2, 11.9]);
    expect([Math.round(100 * mean(m)), Math.round(100 * Math.min(...m)), Math.round(100 * Math.max(...m))]).toEqual([52, 50, 56]);
    expect(['copper_porphyry_soft', 'phosphate_clay', 'gold_free_milling'].map(c => Math.round(100 * mean(joint(c))))).toEqual([82, 82, 81]);
    const text = en(ENGINE_BENCHMARK.UNCERTAINTY);
    expect(text).toMatch(/recovery P05–P95 by 1\.5 points in high-clay copper and up to 9\.7 in zinc. Across eight further seeds, those widths range from 1\.5 to 1\.7 in high-clay copper and 10\.2 to 11\.9 in zinc/);
    expect(text).toMatch(/probability of meeting all constraints together is lowest in zinc \(44%\) and highest in oxide copper \(88%\)/);
    expect(text).toMatch(/magnetite is 52%, with grade meeting specification in 66% and mill power within its limit in 79%/);

  });

  it('M-10, M-14: the proposals behind the surrogate error, and the gains from states that met every constraint', () => {
    const recs = Object.entries(bench.optimization).flatMap(([id, vs]: [string, any]) => Object.entries(vs).map(([v, r]: [string, any]) => ({ id, v, r })));
    const errs: number[] = [];
    for (const x of recs.filter(x => x.r.screened)) {
      const o = read<any>(`cases/${x.id}.json`).variants.find((v: any) => v.id === x.v).methods.optimization;
      const c = o.proposal_columns as string[];
      for (const s of o.starts) for (const row of s.screen?.proposals ?? []) if (row[c.indexOf('engine_recovery_pct')] !== null) errs.push(row[c.indexOf('surrogate_recovery_pct')] - row[c.indexOf('engine_recovery_pct')]);
    }
    const abs = errs.map(Math.abs);
    expect([errs.length, round(abs.reduce((a, b) => a + b, 0) / abs.length, 2), round(median(abs), 2), round(Math.max(...abs), 1)]).toEqual([5811, 0.71, 0.48, 38.2]);
    expect(Math.round(4 * errs.filter(e => e < 0).length / errs.length)).toBe(2);
    const feasible = recs.filter(x => !x.v.startsWith('cut_') && x.r.base_feasible && x.r.gain_pct !== null).sort((a, b) => a.r.gain_pct - b.r.gain_pct);
    expect([feasible.length, feasible[0].id, feasible[0].v, round(feasible[0].r.gain_pct, 1), feasible.at(-1)!.id, feasible.at(-1)!.v, round(feasible.at(-1)!.r.gain_pct, 1)])
      .toEqual([43, 'iron_magnetite_fine', 'finer_crusher', 0.3, 'copper_oxide', 'coarser_grind', 20.0]);
    const text = en(ENGINE_BENCHMARK.OPTIMIZATION);
    expect(text).toMatch(/across proposals its mean is 0\.71, median 0\.48 and maximum 38\.2/);
    expect(text).toMatch(/Among the 43 feasible-start target variants, gains run from 0\.3% .* to 20\.0%/);
  });

  it('M-11, M-21, M-23: the seeds, the equal training rows and the forest against boosting', () => {
    const ms = learning.mlp_seeds.summary.recovery_pct;
    const range = (v: number[], d: number) => [round(Math.min(...v), d), round(Math.max(...v), d)];
    expect(range(ms.interpolation_rmse, 1)).toEqual([3.0, 3.5]);
    expect(range(copper.flatMap(c => ms.loco_rmse_by_case[c]), 1)).toEqual([1.7, 9.1]);
    expect(range(ms.loco_rmse_by_case.iron_magnetite_fine, 0)).toEqual([217, 277]);
    expect(range(ms.loco_rmse_by_case.phosphate_clay, 0)).toEqual([7, 19]);
    expect(range(ms.loco_rmse_mean, 1)).toEqual([25.0, 30.1]);
    const rfBetter = folds.filter(f => f.models.random_forest.recovery_pct.rmse < f.models.hist_gradient_boosting.recovery_pct.rmse).map(f => f.held_out).sort();
    expect(rfBetter).toEqual(['copper_oxide', 'iron_magnetite_fine', 'mixed_ore_high_clay', 'phosphate_clay']);
    const eq = learning.equal_rows;
    expect([eq.random_forest.recovery_pct.rows, round(eq.random_forest.recovery_pct.r2, 3), round(eq.hist_gradient_boosting.recovery_pct.r2, 3),
      round(learning.interpolation.models.gaussian_process.recovery_pct.r2, 3), learning.interpolation.models.gaussian_process.recovery_pct.training_rows, learning.interpolation.train_rows])
      .toEqual([612, 0.683, 0.813, 0.878, 500, 2460]);
    const text = en(ENGINE_BENCHMARK.LEARNED);
    expect(text).toMatch(/R² 0\.951 at the record seed; RMSE 3\.0 to 3\.5 points over five training seeds/);
    expect(text).toMatch(/RMSE 1\.7 to 9\.1 across cases and seeds/);
    expect(text).toMatch(/240 points at the record seed; 217 to 277 over seeds/);
    expect(text).toMatch(/25\.0 to 30\.1 across seeds, 26\.2 at the record seed/);
    expect(text).toMatch(/median one-case-out recovery R² is 0\.547, followed by gradient boosting at 0\.512/);
    expect(text).toMatch(/most accurate on four of the five copper sulphide plants/);
    expect(text).toMatch(/On 612 matched training rows the forest and gradient boosting score R² 0\.683 and 0\.813; the Gaussian process uses 500 of 2,460 rows and scores 0\.878/);
  });

  it('M-07, M-08, M-12: the upgrade among the copper plants, the coverage under both protocols, the energy failures', () => {
    const med = (m: string) => round(median(copper.map(c => fold(c).models[m].log_upgrade.r2)), 2);
    expect([med('gaussian_process'), med('mlp'), med('hist_gradient_boosting'), med('random_forest'), med('ridge')]).toEqual([0.93, 0.95, 0.11, 0.23, -5.88]);
    const gp = learning.summary.gaussian_process, targets = ['recovery_pct', 'log_upgrade', 'specific_energy_total_kwh_t'];
    expect(targets.map(t => round(100 * gp[t].loco_coverage_pooled, 1))).toEqual([82.9, 67.8, 86.8]);
    expect(targets.map(t => round(100 * gp[t].loco_coverage_worst, 1))).toEqual([35.5, 0.0, 43.8]);
    const phosphate = fold('phosphate_clay').models;
    expect([round(phosphate.gaussian_process.specific_energy_total_kwh_t.r2, 1), Math.round(phosphate.mlp.specific_energy_total_kwh_t.r2)]).toEqual([-0.9, 0]);
    const text = en(ENGINE_BENCHMARK.LEARNED);
    expect(text).toMatch(/copper-group median upgrade R² is 0\.93 for the Gaussian process, 0\.95 for the MLP, 0\.11 for gradient boosting, 0\.23 for the forest and -5\.88 for ridge/);
    expect(text).toMatch(/coverage is 90\.7, 91\.3 and 93\.6% under interpolation and 82\.9, 67\.8 and 86\.8% with one case out/);
    expect(text).toMatch(/on phosphate the Gaussian process and MLP score -0\.9 and 0\.0/);
  });

  // L-01: the figure and the equation name the protocols they show; until 0.09.000 they called one case out the transfer
  it('L-01: the learned figure and equation captions name the protocols', () => {
    const learned = ENGINE_BENCHMARK.LEARNED as { figure?: { caption: { en: string } }; equations?: Array<{ caption: { en: string } }> };
    expect(learned.figure!.caption.en).toMatch(/against the median one-ore-group-out R²/);
    expect(learned.equations!.map(e => e.caption.en).join(' ')).toMatch(/the seven ore groups with one group out, the transfer score/);
    expect(learned.equations!.map(e => e.caption.en).join(' ')).not.toMatch(/The transfer score: the median over the twelve folds/);
  });

  it('L-01: one ore group out, the transfer the page quotes', () => {
    const s = learning.summary, models = Object.keys(s);
    // seven groups by (payable, dominant carrier): the five chalcopyrite plants and the two gold plants are held out together
    expect(new Set(Object.values(learning.transfer_groups)).size).toBe(7);
    const groups = learning.leave_one_group_out as any[], group = (id: string) => groups.find(g => g.held_out_group === id);
    expect(group('Cu:chalcopyrite').cases).toEqual(copper);
    // no model keeps a positive median recovery R² over the groups; the random forest comes closest
    expect(models.every(m => Number.isFinite(s[m].recovery_pct.transfer_r2_median))).toBe(true);
    const closest = [...models].sort((a, b) => s[b].recovery_pct.transfer_r2_median - s[a].recovery_pct.transfer_r2_median)[0];
    expect([closest, round(s[closest].recovery_pct.transfer_r2_median, 3), round(s[closest].recovery_pct.transfer_rmse_mean, 1)]).toEqual(['mlp', 0.437, 46.7]);
    const cu = group('Cu:chalcopyrite').models;
    expect([round(cu.gaussian_process.recovery_pct.r2, 3), round(cu.mlp.recovery_pct.r2, 3)]).toEqual([0.539, 0.795]);
    const alone = copper.map(c => fold(c).models.mlp.recovery_pct.r2);
    expect([round(Math.min(...alone), 2), round(Math.max(...alone), 2)]).toEqual([0.52, 0.99]);
    // the upgrade does not transfer to the copper plants held out together: -0.15 for the MLP to -20 for ridge
    const upgrade = models.map(m => cu[m].log_upgrade.r2);
    expect([round(cu.mlp.log_upgrade.r2, 2), Math.round(cu.ridge.log_upgrade.r2), Math.max(...upgrade) === cu.mlp.log_upgrade.r2, Math.min(...upgrade) === cu.ridge.log_upgrade.r2]).toEqual([-0.60, -23, false, true]);
    const energy = models.filter(m => m !== 'ridge').map(m => s[m].specific_energy_total_kwh_t.transfer_r2_median);
    expect([round(Math.min(...energy), 2), round(Math.max(...energy), 2)]).toEqual([0.88, 0.91]);
    const text = en(ENGINE_BENCHMARK.LEARNED);
    expect(text).toMatch(/highest median recovery R² across seven groups \(0\.437\), but mean error is 46\.7 points/);
    expect(text).toMatch(/five chalcopyrite plants held out together score 0\.795 for the MLP and 0\.539 for the Gaussian process/);
    expect(text).toMatch(/and 0\.88 to 0\.91 with a whole ore group out/);
    expect(text).toMatch(/holding out the two pyrite gold plants gives it R² -10\.2/);
  });

  it('M-16, M-17: the guard over its probe distances, and its flags against the errors', () => {
    const by = learning.guard.acceptance_by_distance as Array<{ distance: number; upward: number; downward: number }>;
    const at = (d: number) => by.find(x => x.distance === d)!;
    expect([round(100 * at(0.5).upward, 1), round(100 * at(0.5).downward, 1), Math.round(100 * at(0.1).upward), Math.round(100 * at(0.1).downward), Math.round(100 * at(1.0).upward)]).toEqual([15.5, 19.9, 48, 60, 6]);
    expect(round(100 * learning.guard.false_accept_rate, 1)).toBe(round(100 * at(0.5).upward, 1));
    const soft = fold('copper_porphyry_soft'), refractory = fold('refractory_gold');
    expect([Math.round(100 * soft.held_out_flag_rate), round(soft.models.hist_gradient_boosting.log_upgrade.r2, 2), Math.round(100 * refractory.held_out_flag_rate), round(refractory.models.hist_gradient_boosting.recovery_pct.r2, 2)]).toEqual([16, -1.46, 100, 0.17]);
    const text = en(ENGINE_BENCHMARK.LEARNED);
    expect(text).toMatch(/At half a training range beyond the maximum it accepts 15\.5% of probes \(19\.9% below the minimum\); at one tenth it accepts 48% \(60% below\), and at one full range 6%/);
    expect(text).toMatch(/it flags 16% of soft-porphyry states while gradient boosting upgrade R² is -1\.46, and all refractory-gold states while gradient boosting recovery R² is 0\.17/);
  });

  it('E-10: the Zandrivierspoort levels, silica and rougher beside the step', () => {
    const z = bench.oracles.zandrivierspoort;
    expect(z.engine.concentrate_silica_pct.map((v: number) => round(v, 1))).toEqual([10.9, 5.8]);
    expect(z.gap_fe_pct_points.map((v: number) => round(-v, 1))).toEqual([1.1, 1.2]);
    expect([round(z.engine.rougher_75.magnetite_recovery_pct, 1), round(z.engine.rougher_75.concentrate_fe_pct, 1), z.published.rougher_75.magnetite_recovery_pct, z.published.rougher_75.concentrate_fe_pct]).toEqual([97.3, 60.1, 98.1, 63.8]);
    const text = en(ENGINE_BENCHMARK.ORACLES);
    expect(text).toMatch(/at levels 1\.1 and 1\.2 points below the published ones\. Its silica is 10\.9 and 5\.8% against the published 7\.7 and 2\.25%, and its rougher drum at 75 µm recovers 97\.3% of the magnetite at 60\.1% Fe, against the published 98\.1% at 63\.8%/);
  });
});
