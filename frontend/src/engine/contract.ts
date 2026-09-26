/**
 * Contract 1 validator (port of pipeline/io/contract.py `validate`; docs/data-contract/01_operating-contract.md).
 * It interprets only the exported contract document, so the browser and the API accept and reject exactly
 * the same states with the same codes; contract_probes.json holds the verdicts both must reproduce.
 */
export type ContractInput = {
  name: string; unit: string; bounds: string; low: number; high: number; step: number; integer: boolean; families: string[];
  label: { en: string; es: string }; help: { en: string; es: string }; display_scale: number; display_unit: string;
};
export type CaseBounds = { min: number; max: number; step: number; unit: string };
export type ContractCase = {
  family: string;
  primary: { species: string; unit: string };
  nominal: Record<string, number>;
  inputs: Record<string, CaseBounds>;
};
export type ContractRule = {
  id: string; families: string[]; left: string; relation: string; factor: number; right: string; message: { en: string; es: string };
};
export type OperatingContract = {
  schema: string;
  fields: string[];
  families: string[];
  inputs: ContractInput[];
  rules: ContractRule[];
  messages: Record<string, { en: string; es: string }>;
  cases: Record<string, ContractCase>;
  digest: string;
};
export type ContractError = { code: string; input: string | null; value?: number; min?: number; max?: number };
export type Verdict = { accepted: boolean; point: Record<string, number> | null; errors: ContractError[] };

const isNumber = (value: unknown): value is number => typeof value === 'number';

export function validate(contract: OperatingContract, caseId: string, values: Record<string, unknown>): Verdict {
  const entry = contract.cases[caseId];
  if (!entry) return { accepted: false, point: null, errors: [{ code: 'unknown_case', input: null }] };
  const declared: Record<string, ContractInput> = {};
  for (const spec of contract.inputs) declared[spec.name] = spec;
  const point: Record<string, number> = { ...entry.nominal };
  const errors: ContractError[] = [];
  for (const [name, value] of Object.entries(values)) {
    if (!(name in declared)) { errors.push({ code: 'unknown_input', input: name }); continue; }
    if (!(name in entry.inputs)) {
      if (!(isNumber(value) && value === 0)) errors.push({ code: 'not_applicable', input: name });
      continue;
    }
    if (!isNumber(value)) { errors.push({ code: 'not_a_number', input: name }); continue; }
    if (!Number.isFinite(value)) { errors.push({ code: 'not_finite', input: name }); continue; }
    if (declared[name].integer && value !== Math.floor(value)) { errors.push({ code: 'not_integer', input: name, value }); continue; }
    const bounds = entry.inputs[name];
    if (value < bounds.min || value > bounds.max) {
      errors.push({ code: 'out_of_range', input: name, value, min: bounds.min, max: bounds.max });
      continue;
    }
    point[name] = value;
  }
  if (errors.length === 0) {
    for (const rule of contract.rules) {
      if (!rule.families.includes(entry.family)) continue;
      const left = point[rule.left];
      const limit = rule.factor * point[rule.right];
      if (!(left <= limit)) errors.push({ code: rule.id, input: rule.left, value: left, max: limit });
    }
  }
  return errors.length ? { accepted: false, point: null, errors } : { accepted: true, point, errors: [] };
}

/** Order-free summary of a validation result, compared across validators. */
export function verdictSummary(result: Verdict): { accepted: boolean; errors: Array<[string, string]> } {
  const errors = result.errors.map(e => [e.code, e.input ?? ''] as [string, string]);
  errors.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1));
  return { accepted: result.accepted, errors };
}

/** Probe files tag non-finite values, which strict JSON cannot hold. */
export function decodeValue(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value as object);
    if (keys.length === 1 && keys[0] === 'non_finite') return Number((value as { non_finite: string }).non_finite === 'nan' ? NaN
      : (value as { non_finite: string }).non_finite === 'inf' ? Infinity : -Infinity);
  }
  return value;
}
