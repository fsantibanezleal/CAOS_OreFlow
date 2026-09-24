import type { Benchmark, CaseArtifact, CaseIndex, CaseManifest } from '../lib/contract.types';
import { APP_VERSION } from '../lib/version';
const base = import.meta.env.BASE_URL;
async function get<T>(path: string): Promise<T> { const response = await fetch(`${base}data/${path}?v=${APP_VERSION}`, { cache: 'no-store' }); if (!response.ok) throw new Error(`${response.status} ${path}`); return response.json() as Promise<T>; }
export const loadIndex = () => get<CaseIndex>('manifests/index.json');
export const loadManifest = (id: string) => get<CaseManifest>(`manifests/${id}.json`);
export const loadCase = (id: string) => get<CaseArtifact>(`cases/${id}.json`);
export const loadBenchmark = () => get<Benchmark>('benchmark.json');
export type MethodMatrix = { methods: Array<{ id: string; name: string; domain: string }>; rows: Array<{ case_id: string; variant_id: string; method_id: string; value: number | null; status: string }> };
export const loadMethodMatrix = () => get<MethodMatrix>('metrics/matrix.json');
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
export type GeometProtocol = { folds: Array<{ id: number; train_rows: number; test_rows: number; train_holes: number; test_holes: number; test_source_rows: number[] }>; scores: Record<string, { mae_pp: number; rmse_pp: number; bias_pp: number; r2: number }>; rows: GeometRow[] };
export type GeometBenchmark = { schema: string; source: { title: string; record: string; doi: string; concept_doi: string; paper_doi: string; license: string; md5: string; sha256: string; raw_rows: number; usable_rows: number; holes: number; exclusions: Array<{ source_row: number; reason: string }> }; protocol: { target: string; features: string[]; excluded_features: string[]; hole: string; zone: string; boundary: string }; protocols: { hole: GeometProtocol; zone: GeometProtocol } };
export const loadGeometBenchmark = () => get<GeometBenchmark>('source/geomet_lct_benchmark.json');
