import { describe, expect, it } from 'vitest';
import contractDoc from '../../../data/derived/contract/operating_contract.json';
import probesDoc from '../../../data/derived/contract/contract_probes.json';
import { decodeValue, validate, verdictSummary, type OperatingContract } from '../engine/contract';

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
