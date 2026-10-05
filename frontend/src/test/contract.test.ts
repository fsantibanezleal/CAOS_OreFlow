import { describe, expect, it } from 'vitest';
import contractDoc from '../../../data/derived/contract/operating_contract.json';
import probesDoc from '../../../data/derived/contract/contract_probes.json';
import { decodeValue, validate, validateControl, verdictSummary, type OperatingContract } from '../engine/contract';

// PE-30: the browser validator accepts and rejects exactly the states the Python validator and the API do.
const contract = contractDoc as unknown as OperatingContract;
type Probe = { case_id: string; values: Record<string, unknown>; expected: { accepted: boolean; errors: Array<[string, string]> } };
const probes = (probesDoc as unknown as { digest: string; probes: Probe[] });

describe('Contract 1 in the browser', () => {
  it('replays every probe verdict of the exported contract', () => {
    expect(probes.digest).toBe(contract.digest);
    expect(probes.probes.length).toBeGreaterThan(500);
    const mismatches: string[] = [];
    for (const probe of probes.probes) {
      const values: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(probe.values)) values[k] = decodeValue(v);
      const got = verdictSummary(validate(contract, probe.case_id, values));
      if (JSON.stringify(got) !== JSON.stringify(probe.expected)) mismatches.push(`${probe.case_id} ${JSON.stringify(probe.values)}`);
    }
    expect(mismatches).toEqual([]);
  });

  it('fills missing inputs from the nominal and never coerces', () => {
    const nominal = validate(contract, 'copper_porphyry_soft', {});
    expect(nominal.accepted).toBe(true);
    expect(nominal.point?.throughput_tph).toBe(contract.cases.copper_porphyry_soft.nominal.throughput_tph);
    expect(validate(contract, 'copper_porphyry_soft', { throughput_tph: '720' }).errors[0].code).toBe('not_a_number');
    expect(validate(contract, 'copper_porphyry_soft', { rougher_cells: 8.5 }).errors[0].code).toBe('not_integer');
    expect(validate(contract, 'iron_magnetite_fine', { collector_gpt: 30 }).errors[0].code).toBe('not_applicable');
  });
});

// UQ-07, OP-10: the method controls. tests/test_contract.py holds the same probe table, so both languages give the same
// verdict on every probe.
const CONTROL_PROBES: Array<[string, unknown, boolean, string | null]> = [
  ['uncertainty_seed', 20260926, true, null], ['uncertainty_seed', 0, true, null],
  ['uncertainty_seed', 9007199254740991, true, null], ['uncertainty_seed', 9007199254740992, false, 'out_of_range'],
  ['uncertainty_seed', -1, false, 'out_of_range'], ['uncertainty_seed', 1.5, false, 'not_integer'],
  ['uncertainty_seed', '7', false, 'not_a_number'], ['uncertainty_seed', Number.NaN, false, 'not_finite'],
  ['uncertainty_samples', 128, true, null], ['uncertainty_samples', 32, true, null], ['uncertainty_samples', 512, true, null],
  ['uncertainty_samples', 100, false, 'off_step'], ['uncertainty_samples', 16, false, 'out_of_range'],
  ['uncertainty_samples', 544, false, 'out_of_range'], ['uncertainty_bins', 10, false, 'unknown_input'],
  ['optimizer_weight_pct', 100, true, null], ['optimizer_weight_pct', 0, true, null], ['optimizer_weight_pct', 55, true, null],
  ['optimizer_weight_pct', 52, false, 'off_step'], ['optimizer_weight_pct', 105, false, 'out_of_range'],
  ['optimizer_weight_pct', -5, false, 'out_of_range'], ['optimizer_weight_pct', 0.75, false, 'not_integer'],
];

describe('the method controls', () => {
  it('are declared with their defaults and validated as the bake validates them', () => {
    const contract = contractDoc as unknown as OperatingContract;
    const controls = contract.controls!;
    expect(Object.keys(controls).sort()).toEqual(['optimizer_weight_pct', 'uncertainty_samples', 'uncertainty_seed']);
    for (const [name, spec] of Object.entries(controls)) expect(validateControl(contract, name, spec.default).accepted).toBe(true);
    for (const [name, value, accepted, code] of CONTROL_PROBES) {
      const verdict = validateControl(contract, name, value);
      expect(verdict.accepted, `${name}=${String(value)}`).toBe(accepted);
      if (code) expect(verdict.errors[0].code, `${name}=${String(value)}`).toBe(code);
    }
  });
});

// K-03 (implementation review of 2026-10-04): names of Object.prototype are unknown inputs, as in the API; 0.08.001
// accepted them, and a shared link `?set=constructor:1` reached the worker.
describe('prototype names are unknown inputs (K-03)', () => {
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'])('%s', name => {
    const verdict = validate(contract, 'copper_porphyry_soft', JSON.parse(`{"${name}": 1}`) as Record<string, unknown>);
    expect(verdict.accepted).toBe(false);
    expect(verdict.errors[0].code).toBe('unknown_input');
  });
});
