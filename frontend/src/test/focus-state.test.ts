import { afterEach, expect, test, vi } from 'vitest';
import { readFocusState, writeFocusState } from '../workbench/focusState';
import type { Params } from '../lib/contract.types';

afterEach(() => vi.unstubAllGlobals());

test('focus state persists scenario, variant, controls and stage together', () => {
  const data = new Map<string,string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key,value),
  });
  const state = { caseId: 'gold_free_milling', variantId: 'nominal', params: { feed_tph: 800 } as Params, stageId: 'gravity' };
  writeFocusState(state);
  expect(readFocusState()).toEqual(state);
});

test('malformed focus state does not break route initialization', () => {
  vi.stubGlobal('sessionStorage', { getItem: () => '{broken' });
  expect(readFocusState()).toBeNull();
});
