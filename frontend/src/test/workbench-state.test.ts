import { afterEach, describe, expect, it } from 'vitest';
import type { OperatingPoint } from '../engine/model';
import { useWorkbench } from '../workbench/state';

describe('case selection', () => {
  afterEach(() => useWorkbench.setState({
    caseId: '', variantId: 'nominal', base: null, point: null, view: 'circuit', section: 'feed',
    selectedUnit: null, advanced: false, source: 'case', sampleId: null, hourKey: null,
  }));

  it('preserves the active state when the selected case is selected again', () => {
    const point = { throughput_tph: 720 } as OperatingPoint;
    useWorkbench.setState({ caseId: 'copper_porphyry_soft', variantId: 'higher_throughput', base: point, point, selectedUnit: 'mill' });

    useWorkbench.getState().setCase('copper_porphyry_soft');

    expect(useWorkbench.getState()).toMatchObject({ caseId: 'copper_porphyry_soft', variantId: 'higher_throughput', base: point, point, selectedUnit: 'mill' });
  });

  it('clears the old point when a different case is selected', () => {
    const point = { throughput_tph: 720 } as OperatingPoint;
    useWorkbench.setState({ caseId: 'copper_porphyry_soft', variantId: 'higher_throughput', base: point, point, selectedUnit: 'mill' });

    useWorkbench.getState().setCase('refractory_gold');

    expect(useWorkbench.getState()).toMatchObject({ caseId: 'refractory_gold', variantId: 'nominal', base: null, point: null, selectedUnit: null });
  });
});
