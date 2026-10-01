/**
 * Loaders of the baked artifacts the browser reads (copied into public/ by copy-data.mjs). Every request
 * carries the app version, so a deploy never reads an artifact cached from the previous release.
 */
import type { OperatingContract } from '../engine/contract';
import type { Benchmark, CaseArtifact, CaseIndex, CaseManifest, LearningRecord, ValidationRecord } from './artifacts.types';
import { APP_VERSION } from './version';

const base = import.meta.env.BASE_URL;

const loads = new Map<string, Promise<unknown>>();

/** One request per file and page session; a failed request is forgotten, so it can be retried. */
function get<T>(path: string): Promise<T> {
  let load = loads.get(path);
  if (!load) {
    load = fetch(`${base}data/${path}?v=${encodeURIComponent(APP_VERSION)}`, { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error(`${response.status} ${path}`);
      return response.json();
    });
    load.catch(() => loads.delete(path));
    loads.set(path, load);
  }
  return load as Promise<T>;
}

export const loadIndex = () => get<CaseIndex>('manifests/index.json');
export const loadManifest = (id: string) => get<CaseManifest>(`manifests/${id}.json`);
export const loadCase = (id: string) => get<CaseArtifact>(`cases/${id}.json`);
export const loadContract = () => get<OperatingContract>('contract/operating_contract.json');
export const loadBenchmark = () => get<Benchmark>('benchmark.json');
export const loadLearning = () => get<LearningRecord>('learning.json');
export const loadValidation = () => get<ValidationRecord>('validation.json');

export type ParticleThreshold = { threshold: number; selected_fraction: number; expected_recovery: number; expected_grade_proxy: number };
export type ParticleModelEvaluation = {
  rmse: number; mae: number; bias: number;
  calibration: Array<{ bin: number; count: number; predicted: number; oracle: number }>;
  thresholds: ParticleThreshold[];
};
export type ParticleBenchmark = {
  schema: string;
  source: { doi: string; url: string; license: string; sha256: string };
  protocol: {
    train_rows: number; fit_rows: number; validation_rows: number; test_rows: number;
    features: string[]; excluded_from_features: string[]; target: string; test_oracle: string;
    published_reference: string; split: string; device: string; mlp_best_epoch: number; torch_version: string; mlp_validation_bce: number;
    missingness: string; threshold_interpretation: string;
  };
  standardization: { mean: number[]; scale: number[] };
  cases: Array<{ case: string; train_class_b: number; test_rows: number; excluded_test_rows: number; oracle_expected_b: number; models: Record<string, ParticleModelEvaluation> }>;
};
export const loadParticleBenchmark = () => get<ParticleBenchmark>('source/hzdr_particle_benchmark.json');

export type GeometRow = { source_row: number; hole_id: string; x: number; y: number; observed_lct_pct: number; fold: number; predictions_pct: Record<string, number> };
export type GeometProtocol = {
  folds: Array<{ id: number; train_rows: number; test_rows: number; train_holes: number; test_holes: number; test_source_rows: number[] }>;
  scores: Record<string, { mae_pp: number; rmse_pp: number; bias_pp: number; r2: number }>;
  /** Paired bootstrap over complete holes of the out-of-fold predictions. */
  paired_bootstrap: {
    samples: number; seed: number; unit: string; holes: number;
    rmse_interval_95_pp: Record<string, [number, number]>;
    rmse_differences: Record<string, { mean_pp: number; interval_95_pp: [number, number]; share_first_better: number; excludes_zero: boolean }>;
  };
  rows: GeometRow[];
};
export type GeometBenchmark = {
  schema: string;
  source: { title: string; record: string; doi: string; concept_doi: string; paper_doi: string; license: string; md5: string; sha256: string; raw_rows: number; usable_rows: number; holes: number; exclusions: Array<{ source_row: number; reason: string }> };
  protocol: { target: string; features: string[]; excluded_features: string[]; hole: string; zone: string; boundary: string };
  protocols: { hole: GeometProtocol; zone: GeometProtocol };
};
export const loadGeometBenchmark = () => get<GeometBenchmark>('source/geomet_lct_benchmark.json');

/** The iron-plant soft-sensor lane (IS-01 to IS-06): forward windows, scores and down-sampled traces. */
export type IronScores = { mae_pct_points: number; rmse_pct_points: number; bias_pct_points: number; r2: number };
export type IronFold = {
  id: number; train_rows: number; test_rows: number; train_first: string; train_last: string; test_first: string; test_last: string;
  embargo_hours_min: number; scores: Record<string, IronScores>;
  trace: Array<{ sensor_hour: string; lab_hour: string; observed_pct: number; predictions_pct: Record<string, number>;
    sensors: Record<string, number>; lab_pct: { silica: number; iron: number } }>;
};
export type IronPlant = {
  schema: string;
  source: { title: string; url: string; publisher: string; dataset_id: number; version: number; license: string; archive_sha256: string; csv_sha256: string; date_first: string; date_last: string };
  quality: { source_rows: number; nominal_hours: number; rows_per_hour_min: number; rows_per_hour_max: number; constant_lab_hours: number;
    changing_lab_hours_excluded: number; changing_lab_rows_excluded: number; changing_lab_first_hour: string; gap_hours: number };
  protocol: { target: string; features: string[]; excluded_features: string[]; pair_rows: number; sampling: string; splits: string; interpretation: string; previous_lab_caveat: string };
  pooled_scores: Record<string, IronScores>;
  folds: IronFold[];
};
export const loadIronPlant = () => get<IronPlant>('source/iron_plant_soft_sensor.json');

/** The GeoMet samples in the soft porphyry's circuit (RS-05). */
export type RealSample = {
  id: string; source_row: number; hole: string; xyz: number[]; assays_pct: Record<string, number>; measured_recovery_pct: number;
  allocation: { band: string; fractions: Record<string, number>; copper_shares: Record<string, number>; s_to_cu_molar: number };
  work_index: { value: number; how: 'nearest_in_hole' | 'deposit_median'; from_source_row: number | null; distance_m: number | null };
  ore: import('../engine/model').Ore; point: import('../engine/model').OperatingPoint; metrics: Record<string, number>; flags: string[];
  balance_error: number; geomet_lane: { fold: number; predictions_pct: Record<string, number> } | null;
};
export type RealSamples = {
  schema: string; engine_version: string; case_id: string; labels: Record<string, string>;
  source: { title: string; record: string; doi: string; paper_doi: string; license: string; tables: Record<string, { file: string; md5: string; sha256: string }> };
  floatability_ratios: { bornite: number; chalcocite_to_bornite: number };
  plant: import('../engine/model').Plant;
  comminution: Array<{ source_row: number; hole: string; work_index_kwh_t: number }>;
  excluded: Array<{ table: string; source_row: number; reason: string }>;
  samples: RealSample[];
  summary: {
    samples: number; comminution_samples: number; work_index_kwh_t: { min: number; max: number; median: number };
    bands: Record<string, number>; work_index_assignment: Record<string, number>;
    engine_minus_measured_pp: { mean: number; rmse: number; min: number; max: number };
    geomet_lane_minus_measured_pp: Record<string, { mean: number; rmse: number }>; power_limited: number;
  };
};
export const loadRealSamples = () => get<RealSamples>('real_samples.json');

export type AblationRecord = { status: 'not_applicable' } | {
  status: 'computed'; on: Record<string, number>; off: Record<string, number>; delta: Record<string, number>; flags: string[]; balance: number;
};
export type SeedStudy = {
  seeds: number[]; samples: number; design: string; generator: string;
  per_seed: Array<{ seed: number; recovery_pct: Record<string, number>; concentrate_grade: Record<string, number>; all_constraints: number }>;
  spread: { recovery_pct: Record<string, number>; concentrate_grade: Record<string, number>; all_constraints: number };
};
export type Studies = {
  schema: 'oreflow.studies/v1'; engine_version: string; contract_digest: string;
  switches: Record<string, { removes: { en: string; es: string } }>;
  cases: Record<string, { ablations: Record<string, AblationRecord>; seed_study: SeedStudy }>;
};
/** The mechanism ablations and the uncertainty seed study of every nominal state (the studies stage). */
export const loadStudies = () => get<Studies>('studies.json');
