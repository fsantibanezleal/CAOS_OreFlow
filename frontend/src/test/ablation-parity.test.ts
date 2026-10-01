import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { OperatingPoint, Ore, Plant } from '../engine';
import { simulate } from '../engine/circuit';
import { ABLATION_OUTPUTS, SWITCHES, type Switch } from '../engine/ablations';

// AB-04: the browser applies the bake's five ablations to every case at its nominal state and reproduces each
// record within 1e-6 relative, and agrees on which switches do not apply. OF_DERIVED points a development run at
// a sandbox bake.
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const studies = JSON.parse(readFileSync(join(derived, 'studies.json'), 'utf-8')) as {
  cases: Record<string, { ablations: Record<Switch, { status: string; off?: Record<string, number> }> }>;
};
const RELATIVE = 1e-6;

describe('the browser reproduces the baked ablations', () => {
  for (const [caseId, entry] of Object.entries(studies.cases)) {
    it(caseId, () => {
      const artifact = JSON.parse(readFileSync(join(derived, 'cases', `${caseId}.json`), 'utf-8')) as {
        definition: { ore: Ore; plant: Plant }; variants: Array<{ point: OperatingPoint }>;
      };
      const base: [Ore, Plant, OperatingPoint] = [artifact.definition.ore, artifact.definition.plant, artifact.variants[0].point];
      const problems: string[] = [];
      for (const [name, baked] of Object.entries(entry.ablations) as Array<[Switch, { status: string; off?: Record<string, number> }]>) {
        const applies = SWITCHES[name].applies(...base);
        expect(applies, `${caseId}:${name}`).toBe(baked.status === 'computed');
        if (!applies) continue;
        const metrics = simulate(...SWITCHES[name].transform(...base)).metrics;
        for (const key of ABLATION_OUTPUTS) {
          const a = metrics[key], b = baked.off![key];
          if (Math.abs(a - b) > RELATIVE * Math.max(Math.abs(a), Math.abs(b), 1e-12)) problems.push(`${name}.${key}: ${a} vs ${b}`);
        }
      }
      expect(problems).toEqual([]);
    });
  }
});
