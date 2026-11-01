/**
 * Contract 1 validator (port of pipeline/io/contract.py `validate`; docs/data-contract/01_operating-contract.md).
 * It interprets only the exported contract document, so the browser and the API accept and reject exactly
 * the same states with the same codes; contract_probes.json holds the verdicts both must reproduce.
 */
// Wire shapes come only from the canonical schemas. Verdict/error types below belong
// to the validator's domain and remain independent of the serialized document.
export type {
  OperatingContract, ContractInput, CaseBounds, ContractCase, ContractRule, ContractControl,
} from '../generated/oreflow-contract-v1';
import type { OperatingContract, ContractInput } from '../generated/oreflow-contract-v1';

export type ContractError = { code: string; input: string | null; value?: number; min?: number; max?: number; step?: number };
export type Verdict = { accepted: boolean; point: Record<string, number> | null; errors: ContractError[] };

const isNumber = (value: unknown): value is number => typeof value === 'number';
// own properties only: `name in object` also finds Object.prototype's members, so 0.08.001 accepted "constructor",
// "toString" or "__proto__" as inputs where the API answered unknown_input (review of 2026-10-04, K-03)
const owns = (object: object, name: string): boolean => Object.prototype.hasOwnProperty.call(object, name);

export function validate(contract: OperatingContract, caseId: string, values: Record<string, unknown>): Verdict {
  const entry = contract.cases[caseId];
  if (!entry) return { accepted: false, point: null, errors: [{ code: 'unknown_case', input: null }] };
  const declared: Record<string, ContractInput> = Object.create(null) as Record<string, ContractInput>;
  for (const spec of contract.inputs) declared[spec.name] = spec;
  const point: Record<string, number> = { ...entry.nominal };
  const errors: ContractError[] = [];
  for (const [name, value] of Object.entries(values)) {
    if (!owns(declared, name)) { errors.push({ code: 'unknown_input', input: name }); continue; }
    if (!owns(entry.inputs, name)) {
      if (!(isNumber(value) && value === 0)) errors.push({ code: 'not_applicable', input: name });
      continue;
    }
    if (!isNumber(value)) { errors.push({ code: 'not_a_number', input: name }); continue; }
    if (!Number.isFinite(value)) { errors.push({ code: 'not_finite', input: name }); continue; }
    if (declared[name].integer && value !== Math.floor(value)) { errors.push({ code: 'not_integer', input: name, value }); continue; }
    const bounds = entry.inputs[name];
    // an input with an off value (the classifier cut) takes it as its own state, outside its range
    if (bounds.off !== undefined && value === bounds.off) { point[name] = value; continue; }
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
/** Interpret one method control (port of io/contract.py:validate_control), with the operating inputs' error codes plus off_step. */
export function validateControl(contract: OperatingContract, name: string, value: unknown): { accepted: boolean; value: number | null; errors: ContractError[] } {
  const spec = contract.controls !== undefined && owns(contract.controls, name) ? contract.controls[name] : undefined;
  if (spec === undefined) return { accepted: false, value: null, errors: [{ code: 'unknown_input', input: name }] };
  if (!isNumber(value)) return { accepted: false, value: null, errors: [{ code: 'not_a_number', input: name }] };
  if (!Number.isFinite(value)) return { accepted: false, value: null, errors: [{ code: 'not_finite', input: name }] };
  if (spec.integer && !Number.isInteger(value)) return { accepted: false, value: null, errors: [{ code: 'not_integer', input: name, value }] };
  if (!(spec.min <= value && value <= spec.max)) return { accepted: false, value: null, errors: [{ code: 'out_of_range', input: name, value, min: spec.min, max: spec.max }] };
  if ((value - spec.min) % spec.step !== 0) return { accepted: false, value: null, errors: [{ code: 'off_step', input: name, value, step: spec.step }] };
  return { accepted: true, value, errors: [] };
}

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
