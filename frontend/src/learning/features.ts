/**
 * The learned lane's physical features of a state (port of pipeline/methods/learning.py `features`):
 * computed before any simulation and never from the case identity. The browser test checks this port
 * against the reference block the bake writes into models/process_surrogate.json.
 */
import { mineralTable } from '../engine/constants';
import type { OperatingPoint, Ore, Plant } from '../engine/model';
import { gradeToFraction } from '../engine/ore';

export const FEATURES = [
  'log_payable_fraction', 'specific_throughput_t_h_mw', 'target_p80_um', 'circulating_load', 'water_m3_t',
  'crusher_css_mm', 'work_index_kwh_t', 'carrier_liberation_um', 'grind_to_liberation', 'carrier_composite_content',
  'carrier_density_t_m3', 'carrier_floatability', 'dose_ratio', 'jg_cm_s', 'rougher_cells', 'rougher_volume_m3_per_tph',
  'gravity_bleed', 'deslime_cut_um', 'has_flotation', 'has_gravity', 'has_magnetic', 'has_desliming',
] as const;

const KW_PER_MW = 1000.0;

export function features(ore: Ore, plant: Plant, point: OperatingPoint): number[] {
  const payable = ore.payables[0];
  const spec = Object.fromEntries(ore.minerals.map(m => [m.id, m]));
  const carriers = payable.carriers.filter(c => spec[c.mineral].liberation_size_um > 0.0).map(c => [c.mineral, c.share] as const);
  let total = 0.0;
  for (const [, share] of carriers) total += share;
  const weighted = (fn: (id: string) => number) => {
    let s = 0.0;
    for (const [id, share] of carriers) s += share * fn(id);
    return s / total;
  };
  const flotation = plant.flotation;
  const has = flotation !== null;
  const liberation = weighted(id => spec[id].liberation_size_um);
  const floatability = has ? weighted(id => spec[id].flotation?.floatability ?? 0.0) : 0.0;
  const halfDose = has ? weighted(id => spec[id].flotation?.half_dose_gpt ?? 0.0) : 0.0;
  const values: Record<(typeof FEATURES)[number], number> = {
    log_payable_fraction: Math.log10(gradeToFraction(point.head_grade, payable.unit)),
    specific_throughput_t_h_mw: point.throughput_tph / (plant.mill.installed_power_kw / KW_PER_MW),
    target_p80_um: point.target_p80_um,
    circulating_load: point.circulating_load,
    water_m3_t: point.water_m3_t,
    crusher_css_mm: point.crusher_css_mm,
    work_index_kwh_t: point.work_index_kwh_t,
    carrier_liberation_um: liberation,
    grind_to_liberation: point.target_p80_um / liberation,
    carrier_composite_content: weighted(id => spec[id].composite_content),
    carrier_density_t_m3: weighted(id => mineralTable[id].density),
    carrier_floatability: floatability,
    dose_ratio: halfDose > 0.0 ? point.collector_gpt / halfDose : 0.0,
    jg_cm_s: has ? point.jg_cm_s : 0.0,
    rougher_cells: has ? point.rougher_cells : 0.0,
    rougher_volume_m3_per_tph: has && flotation ? flotation.rougher.cell_volume_m3 * point.rougher_cells / point.throughput_tph : 0.0,
    gravity_bleed: plant.gravity !== null ? point.gravity_bleed : 0.0,
    deslime_cut_um: plant.deslime !== null ? point.deslime_cut_um : 0.0,
    has_flotation: has ? 1.0 : 0.0,
    has_gravity: plant.gravity !== null ? 1.0 : 0.0,
    has_magnetic: plant.magnetic !== null ? 1.0 : 0.0,
    has_desliming: plant.deslime !== null ? 1.0 : 0.0,
  };
  return FEATURES.map(name => values[name]);
}
