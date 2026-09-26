/**
 * The workbench state: which case and variant, the current operating point, and what is on screen.
 * The state travels in the URL (?case=, ?variant=, ?set= for the controls changed from the variant,
 * ?view=), so the focus view opens on exactly the state the workbench shows and returns to it, and a
 * state can be shared as a link (ADR-0070 rules 7 and 8).
 */
import { create } from 'zustand';
import type { OperatingPoint } from '../engine/model';

export type View = 'circuit' | 'grinding' | 'separation' | 'response' | 'methods' | 'case';
export type Section = 'feed' | 'classification' | 'separation';
export const VIEWS: View[] = ['circuit', 'grinding', 'separation', 'response', 'methods', 'case'];

export type WorkbenchState = {
  caseId: string;
  variantId: string;
  /** The variant's own point, the reference for "modified". */
  base: OperatingPoint | null;
  /** The point the engine runs: the variant's point with the user's changes. */
  point: OperatingPoint | null;
  view: View;
  section: Section;
  selectedUnit: string | null;
  advanced: boolean;
  setCase: (caseId: string) => void;
  setVariant: (variantId: string, base: OperatingPoint) => void;
  setValue: (name: keyof OperatingPoint, value: number) => void;
  setPoint: (point: OperatingPoint) => void;
  reset: () => void;
  setView: (view: View) => void;
  setSection: (section: Section) => void;
  selectUnit: (unit: string | null) => void;
  setAdvanced: (advanced: boolean) => void;
};

export const useWorkbench = create<WorkbenchState>(set => ({
  caseId: '',
  variantId: 'nominal',
  base: null,
  point: null,
  view: 'circuit',
  section: 'feed',
  selectedUnit: null,
  advanced: false,
  setCase: caseId => set({ caseId, variantId: 'nominal', base: null, point: null, selectedUnit: null }),
  setVariant: (variantId, base) => set({ variantId, base, point: { ...base } }),
  setValue: (name, value) => set(state => (state.point ? { point: { ...state.point, [name]: value } } : {})),
  setPoint: point => set({ point }),
  reset: () => set(state => (state.base ? { point: { ...state.base } } : {})),
  setView: view => set({ view }),
  setSection: section => set({ section }),
  selectUnit: selectedUnit => set({ selectedUnit }),
  setAdvanced: advanced => set({ advanced }),
}));

/** The inputs whose value differs from the variant's own point. */
export function changedInputs(base: OperatingPoint | null, point: OperatingPoint | null): Partial<OperatingPoint> {
  if (!base || !point) return {};
  const out: Partial<OperatingPoint> = {};
  for (const key of Object.keys(point) as Array<keyof OperatingPoint>) if (point[key] !== base[key]) out[key] = point[key];
  return out;
}

/** URL query for a state: case, variant, view and only the changed inputs. */
export function stateQuery(caseId: string, variantId: string, base: OperatingPoint | null, point: OperatingPoint | null, view?: View): string {
  const params = new URLSearchParams();
  params.set('case', caseId);
  params.set('variant', variantId);
  if (view) params.set('view', view);
  const changed = changedInputs(base, point);
  const pairs = Object.entries(changed).map(([k, v]) => `${k}:${v}`);
  if (pairs.length) params.set('set', pairs.join(','));
  return params.toString();
}

/** The changed inputs of a `set=` query value; unknown or non-numeric entries are dropped, the contract validates the rest. */
export function parseSet(value: string | null): Partial<Record<keyof OperatingPoint, number>> {
  const out: Partial<Record<keyof OperatingPoint, number>> = {};
  if (!value) return out;
  for (const pair of value.split(',')) {
    const [key, raw] = pair.split(':');
    const number = Number(raw);
    if (key && raw !== undefined && raw !== '' && Number.isFinite(number)) out[key as keyof OperatingPoint] = number;
  }
  return out;
}
