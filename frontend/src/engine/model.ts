/**
 * Typed inputs of the process engine (port of engine/model.py). Field names are the Python field
 * names, so a case artifact's `definition` and `nominal` are read as they are.
 */
export type Flotability = {
  floatability: number;
  optimum_size_um: number;
  fine_width: number;
  coarse_width: number;
  half_dose_gpt: number;
  unresponsive_fraction: number;
};
export type Carrier = { mineral: string; share: number; mode: string };
export type Payable = { species: string; unit: string; carriers: Carrier[]; head_grade: number };
export type MineralSpec = {
  id: string;
  fraction: number;
  grindability: number;
  liberation_size_um: number;
  liberation_slope: number;
  composite_content: number;
  host: string;
  flotation: Flotability | null;
  magnetic: boolean;
  gravity: boolean;
};
export type Ore = {
  minerals: MineralSpec[];
  payables: Payable[];
  work_index_kwh_t: number;
  crushing_work_index_kwh_t: number;
  quality_species: string[];
};
export type Crusher = {
  feed_f80_um: number; feed_slope: number; k1_css: number; k2_css: number; k3: number;
  beta0: number; beta1: number; beta2: number;
};
export type Mill = {
  installed_power_kw: number; alpha0: number; alpha1: number; alpha2: number; critical_size_um: number;
  reference_work_index_kwh_t: number; beta0: number; beta1: number; beta2: number; discharge_solids: number;
};
export type Cyclone = {
  sharpness: number; underflow_solids: number; diameter_cm: number; inlet_cm: number; vortex_cm: number;
  apex_cm: number; free_vortex_height_cm: number;
};
export type Bank = {
  cell_volume_m3: number; gas_holdup: number; cells: number; jg_cm_s: number; feed_solids: number; wash_factor: number;
};
export type FlotationPlant = {
  rougher: Bank; cleaner: Bank; d32_base_mm: number; d32_slope_mm_per_cm_s: number; water_floatability: number;
  entrainment_size_um: number; drainage: number; recleaner: Bank | null; regrind_energy_kwh_t: number;
};
export type GravityPlant = { max_recovery: number; size_scale_um: number; composite_recovery: number; gangue_yield: number };
export type MagneticPlant = {
  max_capture: number; fine_scale_um: number; composite_threshold: number; entrapment_base: number;
  entrapment_fines: number; entrapment_scale_um: number; cleaner_factor: number; concentrate_solids: number;
};
export type DeslimePlant = { sharpness: number; bypass: number };
export type GradeSpec = { species: string; minimum: number };
export type Family = 'rougher' | 'gravity_rougher' | 'magnetic' | 'deslime_rougher';
export type Plant = {
  family: Family;
  crusher: Crusher;
  mill: Mill;
  cyclone: Cyclone;
  flotation: FlotationPlant | null;
  gravity: GravityPlant | null;
  magnetic: MagneticPlant | null;
  deslime: DeslimePlant | null;
  grade_spec: GradeSpec | null;
  water_limit_m3_t: number;
};
export type OperatingPoint = {
  throughput_tph: number;
  target_p80_um: number;
  circulating_load: number;
  water_m3_t: number;
  crusher_css_mm: number;
  work_index_kwh_t: number;
  head_grade: number;
  collector_gpt: number;
  jg_cm_s: number;
  rougher_cells: number;
  gravity_bleed: number;
  deslime_cut_um: number;
};

export type Flag = { code: string; message: string };

export class Flags {
  readonly items: Flag[] = [];

  add(code: string, message: string): void {
    if (this.items.every(item => item.code !== code)) this.items.push({ code, message });
  }
}
