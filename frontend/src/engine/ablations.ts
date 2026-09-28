/**
 * The mechanism ablations in the browser (port of methods/ablations.py, AB-04): the same five counterfactual
 * transformations of a case at its nominal state, so the browser reproduces every baked ablation record.
 */
import type { OperatingPoint, Ore, Plant } from './model';

export const ABLATION_OUTPUTS = ['recovery_pct', 'concentrate_grade', 'specific_energy_total_kwh_t', 'recovered_primary_tph'] as const;
export type Switch = 'entrainment' | 'composite_classes' | 'cleaner_recirculation' | 'regrind' | 'gravity_bleed';
type Case = [Ore, Plant, OperatingPoint];

export const SWITCHES: Record<Switch, { applies: (...c: Case) => boolean; transform: (...c: Case) => Case }> = {
  entrainment: {
    applies: (_o, p) => p.flotation !== null,
    transform: (o, p, op) => {
      const f = p.flotation!;
      return [o, { ...p, flotation: { ...f, rougher: { ...f.rougher, wash_factor: 0 }, cleaner: { ...f.cleaner, wash_factor: 0 },
        recleaner: f.recleaner === null ? null : { ...f.recleaner, wash_factor: 0 } } }, op];
    },
  },
  composite_classes: {
    applies: o => o.minerals.some(m => m.liberation_size_um > 0 && m.composite_content > 0),
    transform: (o, p, op) => [{ ...o, minerals: o.minerals.map(m => (m.liberation_size_um > 0 ? { ...m, composite_content: 0 } : m)) }, p, op],
  },
  cleaner_recirculation: {
    applies: (_o, p) => p.flotation !== null,
    transform: (o, p, op) => [o, { ...p, flotation: { ...p.flotation!, cleaner_tail_to_rougher: false } }, op],
  },
  regrind: {
    applies: (_o, p) => p.flotation !== null && p.flotation.regrind_energy_kwh_t > 0,
    transform: (o, p, op) => [o, { ...p, flotation: { ...p.flotation!, regrind_energy_kwh_t: 0 } }, op],
  },
  gravity_bleed: {
    applies: (_o, p, op) => p.gravity !== null && op.gravity_bleed > 0,
    transform: (o, p, op) => [o, p, { ...op, gravity_bleed: 0 }],
  },
};
