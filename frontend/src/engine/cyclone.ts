/**
 * Hydrocyclone partition and Plitt cluster sizing (port of engine/cyclone.py).
 * Partition to underflow per class: y = Rf + (1 - Rf)(1 - exp(-ln 2 (d/d50c)^m)); the cut is corrected
 * for particle density, d50c_k = d50c sqrt((rho_ref - 1)/(rho_k - 1)). Plitt (1976) as documented in SysCAD.
 */
import { constant } from './constants';
import { grid, type Vec } from './grid';
import type { Cyclone } from './model';
import { roundHalfEven } from './roots';

export function correctedCut(d50Ref: number, rhoRef: number, rho: number): number {
  const water = constant('water.density_t_m3');
  return d50Ref * Math.sqrt((rhoRef - water) / (rho - water));
}

/** Corrected (bypass-free) fraction of each class reporting to underflow. */
export function reducedPartition(d50: number, sharpness: number): Vec {
  const size = grid().size;
  const out = new Float64Array(size.length);
  const ln2 = Math.log(2.0);
  for (let i = 0; i < size.length; i += 1) out[i] = 1.0 - Math.exp(-ln2 * Math.pow(size[i] / d50, sharpness));
  return out;
}

export type PlittSizing = {
  cyclones: number;
  flow_l_min: number;
  d50c_um: number;
  required_d50c_um: number;
  pressure_kpa: number;
  volume_split: number;
  sharpness: number;
  feed_solids_vol_pct: number;
  in_pressure_window: boolean;
};

const k = (name: string) => constant(`plitt.${name}`);

export function plittCut(c: Cyclone, flowLMin: number, cvPct: number, rhoS: number): number {
  const water = constant('water.density_t_m3');
  const numerator = k('d50_coefficient') * Math.pow(c.diameter_cm, k('d50_exp_dc')) * Math.pow(c.inlet_cm, k('d50_exp_di'))
    * Math.pow(c.vortex_cm, k('d50_exp_do')) * Math.exp(k('d50_cv_coefficient') * cvPct);
  const denominator = Math.pow(c.apex_cm, k('d50_exp_du')) * Math.pow(c.free_vortex_height_cm, k('d50_exp_h'))
    * Math.pow(flowLMin, k('d50_exp_q')) * Math.pow(rhoS - water, k('d50_exp_density'));
  return numerator / denominator;
}

/** Flow per cyclone (L/min) at which Plitt's equation gives the requested cut. */
export function plittFlowForCut(c: Cyclone, d50Um: number, cvPct: number, rhoS: number): number {
  const reference = plittCut(c, 1.0, cvPct, rhoS);
  return Math.pow(reference / d50Um, 1.0 / k('d50_exp_q'));
}

export function plittPressure(c: Cyclone, flowLMin: number, cvPct: number): number {
  return k('pressure_coefficient') * Math.pow(flowLMin, k('pressure_exp_q')) * Math.exp(k('pressure_cv_coefficient') * cvPct)
    / (Math.pow(c.diameter_cm, k('pressure_exp_dc')) * Math.pow(c.inlet_cm, k('pressure_exp_di'))
      * Math.pow(c.free_vortex_height_cm, k('pressure_exp_h'))
      * Math.pow(c.apex_cm ** 2 + c.vortex_cm ** 2, k('pressure_exp_area')));
}

export function plittSplit(c: Cyclone, headM: number, cvPct: number): number {
  const s = (k('split_coefficient') * Math.pow(c.apex_cm / c.vortex_cm, k('split_exp_ratio'))
    * Math.pow(c.free_vortex_height_cm, k('split_exp_h')) * Math.pow(c.apex_cm ** 2 + c.vortex_cm ** 2, k('split_exp_area'))
    * Math.exp(k('split_cv_coefficient') * cvPct)) / (Math.pow(headM, k('split_exp_head')) * Math.pow(c.diameter_cm, k('split_exp_dc')));
  return s / (1.0 + s);
}

export function plittSharpness(c: Cyclone, flowLMin: number, volumeSplit: number): number {
  return k('sharpness_coefficient') * Math.exp(-k('sharpness_rv_coefficient') * volumeSplit)
    * Math.pow(c.diameter_cm ** 2 * c.free_vortex_height_cm / flowLMin, k('sharpness_exp'));
}

/** Number of cyclones and operating point that deliver the required cut (Plitt). */
export function sizeCluster(c: Cyclone, requiredD50Um: number, solidsM3H: number, waterM3H: number,
  solidsTH: number, waterTH: number): PlittSizing {
  const litres = constant('units.litres_per_m3');
  const minutes = constant('time.minutes_per_hour');
  const volume = solidsM3H + waterM3H;
  const cvPct = 100.0 * solidsM3H / volume;
  const rhoS = solidsTH / solidsM3H;
  const totalLMin = volume * litres / minutes;
  const perCyclone = plittFlowForCut(c, requiredD50Um, cvPct, rhoS);
  const count = Math.max(1, roundHalfEven(totalLMin / perCyclone));
  const flow = totalLMin / count;
  const pressure = plittPressure(c, flow, cvPct);
  const rhoFeed = (solidsTH + waterTH) / volume;
  const head = pressure / (constant('gravity.acceleration_m_s2') * rhoFeed);
  const split = plittSplit(c, head, cvPct);
  const [lo, hi] = constant<number[]>('plitt.pressure_window_kpa');
  return {
    cyclones: count, flow_l_min: flow, d50c_um: plittCut(c, flow, cvPct, rhoS), required_d50c_um: requiredD50Um,
    pressure_kpa: pressure, volume_split: split, sharpness: plittSharpness(c, flow, split), feed_solids_vol_pct: cvPct,
    in_pressure_window: lo <= pressure && pressure <= hi,
  };
}
