import type { Params } from '../lib/contract.types';

export type FocusState = { caseId: string; variantId: string; params: Params; stageId: string };
const key = 'oreflow.focus.state.v1';

export function readFocusState(): FocusState | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as FocusState;
    return value.caseId && value.variantId && value.params && value.stageId ? value : null;
  } catch { return null; }
}

export function writeFocusState(state: FocusState) {
  sessionStorage.setItem(key, JSON.stringify(state));
}
