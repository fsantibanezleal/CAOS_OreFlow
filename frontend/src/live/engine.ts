import type { Params, Trace } from '../lib/contract.types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rr = (x: number, p80: number, slope = 0.73) => 1 - Math.exp(-Math.pow(x / (p80 / Math.pow(-Math.log(0.2), 1 / slope)), slope));

export function simulateLive(p: Params, caseId: string): Trace {
  const sizes = Array.from({ length: 96 }, (_, i) => 10 * Math.pow(Math.max(p.feed_p80_um * 2.3, 1000) / 10, i / 95));
  const css = p.feed_p80_um * 0.22;
  const crusherP80 = clamp(0.72 * css + 0.12 * p.feed_p80_um, 40, p.feed_p80_um * 0.98);
  const feed = sizes.map(x => clamp(rr(x, p.feed_p80_um), 0, 1));
  const crushed = sizes.map(x => clamp(rr(x, crusherP80, 0.82) - Math.exp(-Math.max(x - css, 0) / Math.max(css * 1.4, 1)) * 0.08 * (1 - rr(x, crusherP80, 0.82)), 0, 1));
  const ground = sizes.map(x => rr(x, p.grind_p80_um, clamp(0.48 + 0.9 / Math.max(crusherP80 / Math.max(p.grind_p80_um, 1), 1) - 0.006 * p.hardness_kwh_t, 0.2, 1.25)));
  const magneticFamily = caseId.split(':')[0] === 'iron_magnetite_fine';
  const cut = magneticFamily ? 0 : clamp(0.34 * p.classifier_cut_um / Math.sqrt(Math.max(0.25, p.water_m3_t / 2)) * Math.sqrt(2.65 / Math.max(p.density_t_m3, 1.2)) * Math.pow(Math.max(p.feed_tph, 1) / 500, 0.08), 8, p.feed_p80_um);
  const bins = ground.map((v, i) => Math.max(0, v - (ground[i - 1] ?? 0)));
  bins[bins.length - 1] += Math.max(0, 1 - bins.reduce((a, b) => a + b, 0));
  const overflowBins = magneticFamily ? bins : bins.map((mass, i) => mass / (1 + Math.exp(Math.min(60, Math.max(-60, (sizes[i] - cut) / Math.max(cut * 0.16, 1))))));
  const overflowFraction = magneticFamily ? 1 : overflowBins.reduce((a, b) => a + b, 0);
  const gravityFamily = caseId.split(':')[0] === 'gold_free_milling';
  const deslimeFamily = caseId.split(':')[0] === 'phosphate_clay';
  const gravityWindow = sizes.map(size => (1 - Math.exp(-size / 45)) * Math.exp(-size / 700));
  const gravityRecovery = gravityFamily ? Math.min(0.95, 0.82 * bins.reduce((sum, mass, i) => sum + (mass - overflowBins[i]) * gravityWindow[i], 0)) : 0;
  let cumulative = 0;
  const overflow = magneticFamily ? ground : overflowBins.map(mass => (cumulative += mass) / Math.max(overflowFraction, 1e-12));
  const liberation = 1 - Math.exp(-1.8 * Math.pow(p.grind_p80_um / 220, -0.35));
  const rate = 0.045 * liberation * (1 - Math.exp(-p.reagent_gpt / 180)) * (1 - Math.exp(-p.air_rate_m3_min / 1.4));
  const rougherFeedFraction = deslimeFamily ? 1 - overflowFraction : overflowFraction;
  const flotationRecovery = Array.from({ length: 96 }, (_, i) => magneticFamily ? 0 : rougherFeedFraction * 0.97 * (1 - Math.exp(-rate * p.flotation_time_min * i / 95)));
  const magneticRecovery = magneticFamily ? clamp(bins.reduce((sum, mass, i) => sum + mass * 0.91 * (1 - Math.exp(-sizes[i] / 25)) * Math.exp(-sizes[i] / 1800), 0), 0, 0.98) : 0;
  const recovery = flotationRecovery.map(value => value + gravityRecovery);
  const recoveryPct = magneticFamily ? magneticRecovery * 100 : recovery[95] * 100;
  const rougherMassPull = Math.min(clamp(0.018 + 0.085 * rougherFeedFraction + 0.000015 * p.reagent_gpt, 0.015, 0.18), rougherFeedFraction * 0.95);
  const gravityMassPull = gravityFamily ? Math.min((1 - overflowFraction) * 0.012, (p.feed_grade_pct / 100) * gravityRecovery / 0.18) : 0;
  const massPull = magneticFamily ? p.feed_grade_pct / 100 * magneticRecovery / 0.62 : rougherMassPull + gravityMassPull;
  const concentrateTph = p.feed_tph * massPull;
  const grade = magneticFamily ? 62 : 100 * (p.feed_tph * p.feed_grade_pct / 100 * recovery[95]) / Math.max(concentrateTph, 1e-9);
  const rittinger = 0.028 * Math.max(0, 1000000 / p.grind_p80_um - 1000000 / p.feed_p80_um);
  const kick = 1.85 * Math.max(0, Math.log(p.feed_p80_um / p.grind_p80_um));
  const bond = 10 * p.hardness_kwh_t * Math.max(0, 1 / Math.sqrt(p.grind_p80_um) - 1 / Math.sqrt(p.feed_p80_um));
  const metrics = { recovery_pct: recoveryPct, flotation_recovery_pct: flotationRecovery[95] * 100, gravity_recovery_pct: gravityRecovery * 100, gravity_product_tph: p.feed_tph * gravityMassPull, rougher_product_tph: magneticFamily ? 0 : p.feed_tph * rougherMassPull, magnetic_recovery_pct: magneticRecovery * 100, magnetic_product_tph: magneticFamily ? concentrateTph : 0, concentrate_grade_pct: grade, concentrate_tph: concentrateTph, mass_pull_pct: massPull * 100, crusher_p80_um: crusherP80, cyclone_d50_um: cut, overflow_fraction: overflowFraction, energy_rittinger_kwh_t: rittinger, energy_kick_kwh_t: kick, energy_bond_kwh_t: bond, specific_energy_kwh_t: 0.22 * rittinger + 0.12 * kick + bond, water_use_m3_h: p.feed_tph * p.water_m3_t, metal_balance_pct: 100 };
  return { schema: 'oreflow.trace/v1', case_id: caseId, size_um: sizes, feed_psd: feed, crushed_psd: crushed, ground_psd: ground, overflow_psd: overflow, flotation_recovery: recovery, metrics, method_outputs: [] };
}

export function alternativeKinetics(p: Params, overflowFraction: number, methodId: 'kelsall' | 'compressed_exponential'): number[] {
  const liberation = 1 - Math.exp(-1.8 * Math.pow(p.grind_p80_um / 220, -0.35));
  const rate = 0.045 * liberation * (1 - Math.exp(-p.reagent_gpt / 180)) * (1 - Math.exp(-p.air_rate_m3_min / 1.4));
  return Array.from({ length: 96 }, (_, i) => {
    const t = p.flotation_time_min * i / 95;
    const conditional = methodId === 'kelsall'
      ? 0.97 * (0.62 * (1 - Math.exp(-rate * 1.9 * t)) + 0.38 * (1 - Math.exp(-rate * 0.55 * 0.58 * t)))
      : 0.97 * (1 - Math.exp(-Math.pow(Math.max(rate * t, 0), 0.78)));
    return overflowFraction * Math.min(0.98, Math.max(0, conditional));
  });
}

export function svgPoints(values: number[], width = 640, height = 220, invert = false) {
  const max = Math.max(...values, 1e-9);
  const min = Math.min(...values, 0);
  return values.map((v, i) => { const x = (i / Math.max(values.length - 1, 1)) * width; const y = height - ((v - min) / Math.max(max - min, 1e-9)) * height; return `${x.toFixed(1)},${(invert ? height - y : y).toFixed(1)}`; }).join(' ');
}
