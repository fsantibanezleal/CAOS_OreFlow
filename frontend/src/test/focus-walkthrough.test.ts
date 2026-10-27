import { describe, expect, it } from 'vitest';
import { walkthroughUnits } from '../workbench/FocusWalkthrough';
import type { TopologyUnit } from '../engine/circuit';

const unit = (name: string): TopologyUnit => ({ unit: name, inputs: [], outputs: [], water_added_tph: 0 });

describe('Focus process walkthrough', () => {
  it('steps through equipment operations in the solved topology and skips junction and recycle bookkeeping', () => {
    const selected = walkthroughUnits([
      unit('crusher'), unit('mill_feed_junction'), unit('mill'), unit('sump'), unit('cyclone'),
      unit('underflow_return'), unit('gravity_split'), unit('rougher_junction'), unit('rougher'),
    ]);
    expect(selected.map(item => item.unit)).toEqual(['crusher', 'mill', 'sump', 'cyclone', 'gravity_split', 'rougher']);
  });

  it('keeps case-specific magnetic separation operations in the walkthrough', () => {
    expect(walkthroughUnits([unit('mill'), unit('cyclone'), unit('lims_link'), unit('lims_rougher'), unit('lims_cleaner')])
      .map(item => item.unit)).toEqual(['mill', 'cyclone', 'lims_link', 'lims_rougher', 'lims_cleaner']);
  });
});
