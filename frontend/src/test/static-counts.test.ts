import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ARCHITECTURE } from '../content/architecture';

// The architecture diagrams and the pages' static figures state counts the records fix: the contract's inputs, the
// variants per case and in all. In 0.07 the diagrams still said 72 variants, twelve inputs and COBYLA after the
// records had moved on, so this holds each stated count to the contract and the index. OF_DERIVED points a
// development run at a sandbox bake.
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const read = <T>(path: string): T => JSON.parse(readFileSync(join(derived, path), 'utf-8')) as T;
const source = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf-8');
const WORDS: Record<number, [string, string]> = { 12: ['twelve', 'doce'], 13: ['thirteen', 'trece'], 14: ['fourteen', 'catorce'] };

describe('the static figures state the counts the records fix', () => {
  const inputs = read<{ inputs: unknown[] }>('contract/operating_contract.json').inputs.length;
  const index = read<{ n_cases: number; n_variants: number }>('manifests/index.json');
  const perCase = index.n_variants / index.n_cases;

  it('the architecture diagrams', () => {
    const svg = (name: string) => source(`public/svg/tech/${name}`);
    expect(svg('01-the-app.svg')).toContain(`>${inputs} operating inputs, one contract<`);
    expect(svg('01-the-app.svg')).toContain(`>${inputs} entradas de operación, un contrato<`);
    expect(svg('01-the-app.svg')).toContain(`>${index.n_variants} variants with method records<`);
    expect(svg('02-lanes.svg')).toContain(`>definition, ${perCase} variants, records<`);
    expect(svg('03-web-app.svg')).toContain(`>parity on ${index.n_variants} variants, claims, surrogate<`);
    const contracts = svg('05-data-contracts.svg');
    expect(contracts).toContain(`>${inputs} inputs with unit, bounds and step<`);
    expect(contracts).toContain(`>${index.n_variants} variants re-simulated in TS<`);
    expect(contracts).toContain(`>${perCase} variants: point, trace, records<`);
    expect(contracts).toContain(`>from this run: ${index.n_cases} cases, ${index.n_variants} variants<`);
    // the retired optimizer is named only as history, never in a diagram of the current system
    for (const name of ['01-the-app.svg', '02-lanes.svg', '03-web-app.svg', '04-the-science.svg', '05-data-contracts.svg']) expect(svg(name)).not.toMatch(/COBYLA/);
  });

  it('the architecture modal, the Introduction and the Implementation figures', () => {
    const [en, es] = WORDS[inputs];
    const body = ARCHITECTURE.tabs.map(t => `${t.body_en} ${t.body_es}`).join(' ');
    expect(body).toContain(`an operating point of ${en} inputs`);
    expect(body).toContain(`punto de operación de ${es} entradas`);
    expect(source('src/content/introduction.tsx')).toContain(`p('${inputs} inputs', '${inputs} entradas')`);
    expect(source('src/content/implementation.tsx')).toContain(`p('${inputs} inputs, 4 families', '${inputs} entradas, 4 familias')`);
    expect(source('src/content/implementation.tsx')).toContain(`p('${index.n_variants} variants with traces', '${index.n_variants} variantes con trazas')`);
  });
});
