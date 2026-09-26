/**
 * Element contents of minerals from formulas and standard atomic weights (port of engine/chemistry.py).
 * Formulas allow decimal subscripts and nested parentheses; oxide grades such as P2O5 and MgO are
 * reported from their element through the oxide's own formula weight.
 */
import { atomicWeights, mineralTable, oxideTable } from './constants';

const TOKEN = /([A-Z][a-z]?|\(|\)|\d+(?:\.\d+)?)/g;
const isDigit = (token: string) => token[0] >= '0' && token[0] <= '9';

export function parseFormula(formula: string): Record<string, number> {
  const clean = formula.replace(/ /g, '');
  const tokens = clean.match(TOKEN) ?? [];
  if (tokens.join('') !== clean) throw new Error(`unparseable formula: ${formula}`);
  const stack: Array<Record<string, number>> = [{}];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === '(') { stack.push({}); i += 1; continue; }
    if (token === ')') {
      const group = stack.pop() as Record<string, number>;
      let count = 1.0;
      if (i + 1 < tokens.length && isDigit(tokens[i + 1])) { count = Number(tokens[i + 1]); i += 1; }
      const top = stack[stack.length - 1];
      for (const [element, n] of Object.entries(group)) top[element] = (top[element] ?? 0.0) + n * count;
      i += 1;
      continue;
    }
    if (isDigit(token)) throw new Error(`misplaced count in formula: ${formula}`);
    let count = 1.0;
    if (i + 1 < tokens.length && isDigit(tokens[i + 1])) { count = Number(tokens[i + 1]); i += 1; }
    const top = stack[stack.length - 1];
    top[token] = (top[token] ?? 0.0) + count;
    i += 1;
  }
  if (stack.length !== 1) throw new Error(`unbalanced parentheses: ${formula}`);
  return stack[0];
}

export function formulaWeight(formula: string): number {
  let total = 0.0;
  for (const [element, n] of Object.entries(parseFormula(formula))) total += atomicWeights[element] * n;
  return total;
}

export function massFractions(formula: string): Record<string, number> {
  const counts = parseFormula(formula);
  let total = 0.0;
  for (const [element, n] of Object.entries(counts)) total += atomicWeights[element] * n;
  const out: Record<string, number> = {};
  for (const [element, n] of Object.entries(counts)) out[element] = atomicWeights[element] * n / total;
  return out;
}

export function oxideFactor(oxide: string): number {
  const entry = oxideTable[oxide];
  const counts = parseFormula(entry.formula);
  return formulaWeight(entry.formula) / (atomicWeights[entry.element] * counts[entry.element]);
}

const compositionCache = new Map<string, Record<string, number>>();

export function mineralComposition(mineralId: string): Record<string, number> {
  const cached = compositionCache.get(mineralId);
  if (cached) return cached;
  const entry = mineralTable[mineralId];
  let out: Record<string, number>;
  if (entry.formula) out = massFractions(entry.formula);
  else {
    const composition = entry.composition as Record<string, number>;
    let total = 0.0;
    for (const v of Object.values(composition)) total += v;
    out = {};
    for (const [element, value] of Object.entries(composition)) out[element] = value / total;
  }
  compositionCache.set(mineralId, out);
  return out;
}

export function speciesContent(composition: Record<string, number>, species: string): number {
  if (species in composition) return composition[species];
  if (species in oxideTable) return (composition[oxideTable[species].element] ?? 0.0) * oxideFactor(species);
  return 0.0;
}
