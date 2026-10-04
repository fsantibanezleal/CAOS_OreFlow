import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { TopologyUnit } from '../engine/circuit';
import { drawing, extent, fit, labelTexts, layout, placeLabels } from '../workbench/flowsheet';

// D-08, D-21 (review of 0.07.000): on the Circuit stage of every desktop size (the stage left by the rail at
// 1280 by 800 up to 2560 by 1440, less the hint's strip) every stream of every variant carries its label, in both
// languages; on a phone, where the drawing scrolls sideways, every outlet and the feed still name their streams (the
// final concentrate lost its label at 390 px). The placement is flowsheet.ts's, the one the diagram renders.
const derived = fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const contract = JSON.parse(readFileSync(join(derived, 'contract/operating_contract.json'), 'utf-8')) as { cases: Record<string, { primary: { species: string; unit: string } }> };
const files = readdirSync(join(derived, 'cases')).filter(f => f.endsWith('.json')).sort();
type Trace = { topology: TopologyUnit[]; concentrates: string[]; tails: string[]; streams: Record<string, { solids_tph: number; grades: Record<string, number> }>; point: Record<string, number> };
const DESKTOP: Array<[number, number]> = [[880, 560], [1190, 640], [1500, 820], [2140, 1180]];
const PHONE: [number, number] = [358, 420];
const INSET: [number, number, number, number] = [0, 0, 30, 0];

describe('the flowsheet labels every stream', () => {
  for (const file of files) {
    const artifact = JSON.parse(readFileSync(join(derived, 'cases', file), 'utf-8')) as { case_id: string; variants: Array<{ id: string; trace: Trace }> };
    it(artifact.case_id, () => {
      const primary = contract.cases[artifact.case_id].primary;
      for (const variant of artifact.variants) for (const lang of ['en', 'es'] as const) {
        const t = variant.trace;
        const plan = layout(t.topology, t.concentrates, t.tails);
        const texts = labelTexts(plan, t.streams, primary, t.point, lang);
        const missing = ([w, h]: [number, number]) => {
          const f = fit(extent(plan), { width: w, height: h }, INSET);
          const { labels } = placeLabels(plan, drawing(plan, f), f.frame, texts.edges.map(e => e.options));
          return plan.edges.filter((e, k) => !labels[k] && texts.edges[k].options.length);
        };
        for (const stage of DESKTOP) expect(missing(stage).map(e => e.stream), `${artifact.case_id}:${variant.id} ${lang} ${stage.join('x')}`).toEqual([]);
        expect(missing(PHONE).filter(e => e.to === null || e.from === null).map(e => e.stream), `${artifact.case_id}:${variant.id} ${lang} phone`).toEqual([]);
      }
    });
  }
});
