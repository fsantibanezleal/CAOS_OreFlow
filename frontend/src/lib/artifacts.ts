/**
 * Loaders of the baked artifacts the browser reads (copied into public/ by copy-data.mjs). Every request
 * carries the app version, so a deploy never reads an artifact cached from the previous release.
 */
import type { OperatingContract } from '../engine/contract';
import type { Benchmark, CaseArtifact, CaseIndex, CaseManifest, LearningRecord } from './artifacts.types';
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
    published_reference: string; split: string; device: string; mlp_best_epoch: number;
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
  bootstrap?: Record<string, unknown>;
  rows: GeometRow[];
};
export type GeometBenchmark = {
  schema: string;
  source: { title: string; record: string; doi: string; concept_doi: string; paper_doi: string; license: string; md5: string; sha256: string; raw_rows: number; usable_rows: number; holes: number; exclusions: Array<{ source_row: number; reason: string }> };
  protocol: { target: string; features: string[]; excluded_features: string[]; hole: string; zone: string; boundary: string };
  protocols: { hole: GeometProtocol; zone: GeometProtocol };
};
export const loadGeometBenchmark = () => get<GeometBenchmark>('source/geomet_lct_benchmark.json');
