/**
 * Types of the baked artifacts (Contract 2, docs/data-contract/03_case-artifacts.md). The shapes are
 * produced by data-pipeline/pipeline/stages and checked by scripts/check_artifacts.py.
 */
import type { OperatingPoint, Ore, Plant, Family } from '../engine/model';
import type { Trace } from '../engine/trace';

export type Bilingual = { en: string; es: string };

export type Slacks = Record<string, number>;
export type OptimumSummary = {
  decisions: Record<string, number>;
  recovered_tph: number;
  recovery_pct: number;
  values: Record<string, number>;
  slacks: Slacks;
  active: string[];
  feasible: boolean;
};
export type OptimizationRecord = {
  status: 'optimal' | 'infeasible';
  decisions: string[];
  bounds: Record<string, [number, number]>;
  constraints: { grade: { minimum: number; species: string }; power: { maximum_kw: number }; water?: { maximum_m3_t: number } };
  base: OptimumSummary;
  optimum: OptimumSummary | null;
  gain_tph?: number;
  gain_pct?: number | null;
  starts: Array<{ start: Record<string, number>; end: OptimumSummary; violation: number; evaluations: number; message: string }>;
  evaluations: number;
  least_violating?: OptimumSummary;
};
export type OutputDistribution = { p05: number; p50: number; p95: number; mean: number; std: number; base: number; values: number[] };
export type UncertaintyRecord = {
  status: string;
  samples: number;
  seed: number;
  design: string;
  inputs: Record<string, { half_width: number }>;
  factors: number[][];
  outputs: Record<string, OutputDistribution>;
  probabilities: Record<string, number>;
  base_checks: Record<string, boolean>;
  flag_counts: Record<string, number>;
  max_balance_error: number;
};
export type SobolIndices = { S1: Record<string, number>; S1_conf: Record<string, number>; ST: Record<string, number>; ST_conf: Record<string, number> } | { constant: true };
export type SensitivityRecord = { status: string; base_samples: number; evaluations: number; seed: number; inputs: Record<string, { half_width: number }>; indices: Record<string, SobolIndices> };

export type VariantArtifact = {
  id: string;
  label: Bilingual;
  change: Record<string, number>;
  point: OperatingPoint;
  trace: Trace;
  methods: { optimization: OptimizationRecord; uncertainty: UncertaintyRecord; sensitivity?: SensitivityRecord };
};

export type CaseArtifact = {
  schema: 'oreflow.case/v2';
  engine_version: string;
  contract_digest: string;
  case_id: string;
  category: string;
  family: Family;
  title: Bilingual;
  description: Bilingual;
  question: Bilingual;
  provenance: string;
  notes: string[];
  sources: Record<string, string>;
  kpi_ranges: Record<string, [number, number]>;
  definition: { ore: Ore; plant: Plant };
  nominal: OperatingPoint;
  variants: VariantArtifact[];
};

export type IndexEntry = { case_id: string; category: string; family: Family; title: Bilingual; manifest_path: string; artifact_path: string; variants: number };
export type CaseIndex = { schema: 'oreflow.index/v2'; engine_version: string; contract_digest: string; n_cases: number; n_variants: number; cases: IndexEntry[] };

export type CaseManifest = {
  schema: 'oreflow.manifest/v2';
  case_id: string;
  category: string;
  family: Family;
  title: Bilingual;
  engine_version: string;
  contract_digest: string;
  artifact: { path: string; bytes: number; sha256: string; schema: string };
  variants: string[];
  nominal: Record<string, number>;
  kpis: Record<string, { value: number; range: [number, number]; within: boolean }>;
};

export type LearningSummary = Record<string, Record<string, { interpolation_rmse: number; interpolation_r2: number; loco_rmse_mean: number; loco_rmse_max: number; loco_r2_median: number }>>;
export type LearningRecord = {
  schema: 'oreflow.learning/v1';
  features: string[];
  targets: string[];
  models: string[];
  design: { per_case: number; cases: string[]; rows: number; seed: number; seconds: number; method: string };
  identity: Record<string, string>;
  interpolation: {
    train_rows: number; test_rows: number;
    models: Record<string, Record<string, Record<string, number | string | string[] | Record<string, number>>>>;
    mlp_training: Record<string, unknown>;
    permutation_importance: Record<string, Record<string, number>>;
  };
  guard: { threshold: number; false_alarm_rate: number; false_accept_rate: number; false_accept_by_feature: Record<string, number>; in_envelope_rows: number; probe_rows: number };
  leave_one_case_out: Array<{ held_out: string; train_rows: number; test_rows: number; models: Record<string, Record<string, Record<string, number>>>; held_out_flag_rate: number }>;
  summary: LearningSummary;
  final: { mlp_training: Record<string, unknown>; guard_threshold: number; exports: Record<string, { path: string; bytes: number; max_abs_difference: number; opset: number }> };
  engine_version: string;
  contract_digest: string;
};

export type BenchmarkCase = {
  case_id: string; family: Family; category: string;
  kpis: Record<string, { value: number; range: [number, number]; within: boolean }>;
  variants: Record<string, Record<string, number | boolean | string[]>>;
};
export type Benchmark = {
  schema: 'oreflow.benchmark/v2';
  engine_version: string;
  contract_digest: string;
  protocol: string;
  case_count: number;
  variant_count: number;
  cases: BenchmarkCase[];
  oracles: Record<string, Record<string, unknown>>;
  kinetics: Record<string, { fits: number; mean_abs_lumping_error_pct: number; worst_abs_lumping_error_pct: number; mean_rmse_pct: number; converged_share: number }>;
  optimization: Record<string, Record<string, { status: string; base_feasible: boolean; gain_pct: number | null; active: string[]; decisions: Record<string, number> | null; evaluations: number }>>;
  uncertainty: Record<string, { recovery_pct: Record<string, number>; concentrate_grade: Record<string, number>; probabilities: Record<string, number>; dominant_input: Record<string, string> }>;
  learning: { summary: LearningSummary; identity: Record<string, string>; guard: Record<string, number>; design_rows: number; device: string } | null;
  lanes: Record<string, { path: string; schema: string } | null>;
};

export type ValidationRecord = {
  schema: 'oreflow.validation/v2';
  engine_version: string;
  contract_digest: string;
  passed: boolean;
  errors: string[];
  stages: string[];
  workers: number;
  seconds: Record<string, number>;
};
