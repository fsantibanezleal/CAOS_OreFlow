/**
 * Declared engine constants, atomic weights and mineral data (port of engine/constants.py).
 * The browser engine imports the same JSON files the Python engine reads, so both engines share one
 * source of truth; scripts/check_units.py rejects undeclared numeric literals in this directory.
 */
import constantsDoc from '../../../data-pipeline/pipeline/engine/data/constants.json';
import atomicDoc from '../../../data-pipeline/pipeline/engine/data/atomic_weights.json';
import mineralsDoc from '../../../data-pipeline/pipeline/engine/data/minerals.json';

type Entry = { value: unknown; unit: string; source: string };
const table = constantsDoc.constants as unknown as Record<string, Entry>;

export function constant<T = number>(key: string): T {
  const entry = table[key];
  if (!entry) throw new Error(`undeclared engine constant: ${key}`);
  return entry.value as T;
}

export type MineralEntry = {
  name: [string, string];
  formula?: string;
  composition?: Record<string, number>;
  density: number;
  source: string;
};

export const atomicWeights = atomicDoc.weights as Record<string, number>;
export const oxideTable = atomicDoc.oxides as Record<string, { element: string; formula: string }>;
export const mineralTable = mineralsDoc.minerals as unknown as Record<string, MineralEntry>;
