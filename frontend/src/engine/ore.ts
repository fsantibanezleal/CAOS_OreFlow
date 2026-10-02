/**
 * Resolve an ore at an operating point (port of engine/ore.py): mineral fractions, compositions,
 * densities and liberation. Head grades fix the valuable-mineral fractions through each carrier's
 * stoichiometric content; a trace carrier keeps its declared fraction and receives the content its
 * share of the head grade implies; the single gangue mineral declared with fraction 0 takes the balance.
 */
import { mineralComposition, speciesContent } from './chemistry';
import { constant, mineralTable } from './constants';
import { grid, type Vec } from './grid';
import type { MineralSpec, OperatingPoint, Ore } from './model';

export function gradeToFraction(value: number, unit: string): number {
  if (unit === '%') return value / 100.0;
  if (unit === 'g/t') return value / (100.0 * constant('units.gpt_per_pct'));
  throw new Error(`unsupported grade unit: ${unit}`);
}

export function fractionToGrade(value: number, unit: string): number {
  if (unit === '%') return value * 100.0;
  if (unit === 'g/t') return value * 100.0 * constant('units.gpt_per_pct');
  throw new Error(`unsupported grade unit: ${unit}`);
}

export class ResolvedOre {
  constructor(
    readonly ids: string[],
    readonly spec: Record<string, MineralSpec>,
    readonly fraction: Record<string, number>,
    readonly composition: Record<string, Record<string, number>>,
    readonly density: Record<string, number>,
    readonly valuable: string[],
    readonly host: string,
    readonly liberation: Record<string, Vec>,
    readonly species: string[],
    readonly units: Record<string, string>,
    readonly primary: string,
    readonly payables: string[],
    readonly crushingWorkIndex: number,
  ) {}

  compositeDensity(mineral: string): number {
    const s = this.spec[mineral];
    const c = s.composite_content;
    const host = s.host || this.host;
    return 1.0 / (c / this.density[mineral] + (1.0 - c) / this.density[host]);
  }

  content(mineral: string, species: string): number {
    return this.composition[mineral][species] ?? 0.0;
  }
}

/** The head grade is the ore's total assay of the payable (E-02): engine/ore.py's `_total_assay`, line for line. */
function totalAssay(ore: Ore, op: OperatingPoint, spec: Record<string, MineralSpec>, ids: string[],
  composition: Record<string, Record<string, number>>, fraction: Record<string, number>, balance: string): void {
  ore.payables.forEach((payable, index) => {
    const own = new Set(payable.carriers.map(c => c.mineral));
    const holders = ids.filter(m => !own.has(m) && (composition[m][payable.species] ?? 0.0) > 0.0);
    if (holders.length === 0) return;
    const others = new Set(ore.payables.filter(p => p !== payable).flatMap(p => p.carriers.map(c => c.mineral)));
    if (holders.some(m => others.has(m)) || payable.carriers.some(c => c.mode !== 'stoichiometric') || [...own].some(m => others.has(m))) {
      throw new Error(`${payable.species}: a carrier of another payable, or a trace carrier, holds it; not supported`);
    }
    const grade = gradeToFraction(index === 0 ? op.head_grade : payable.head_grade, payable.unit);
    const declared = ids.filter(m => !own.has(m) && !others.has(m) && m !== balance);
    let fDeclared = 0.0, xDeclared = 0.0, xOthers = 0.0, k = 0.0;
    for (const m of declared) fDeclared += spec[m].fraction * (composition[m][payable.species] ?? 0.0);
    for (const m of declared) xDeclared += spec[m].fraction;
    for (const m of others) xOthers += fraction[m];
    const cBalance = composition[balance][payable.species] ?? 0.0;
    for (const c of payable.carriers) k += c.share / composition[c.mineral][payable.species];
    const carried = (grade - fDeclared - cBalance * (1.0 - xDeclared - xOthers)) / (1.0 - cBalance * k);
    if (carried <= 0.0) throw new Error(`${payable.species}: the head grade is below what the gangue holds`);
    for (const c of payable.carriers) fraction[c.mineral] = carried * c.share / composition[c.mineral][payable.species];
  });
}

export function resolve(ore: Ore, op: OperatingPoint): ResolvedOre {
  const spec: Record<string, MineralSpec> = {};
  for (const m of ore.minerals) spec[m.id] = m;
  const ids = ore.minerals.map(m => m.id);
  const species = [...ore.payables.map(p => p.species), ...ore.quality_species];
  const composition: Record<string, Record<string, number>> = {};
  for (const m of ids) {
    const base = mineralComposition(m);
    composition[m] = {};
    for (const s of species) composition[m][s] = speciesContent(base, s);
  }
  const fraction: Record<string, number> = {};
  const valuable: string[] = [];
  ore.payables.forEach((payable, index) => {
    const head = index === 0 ? op.head_grade : payable.head_grade;
    const grade = gradeToFraction(head, payable.unit);
    for (const carrier of payable.carriers) {
      if (!valuable.includes(carrier.mineral)) valuable.push(carrier.mineral);
      if (carrier.mode === 'stoichiometric') {
        const content = composition[carrier.mineral][payable.species];
        if (content <= 0.0) throw new Error(`${carrier.mineral} carries no ${payable.species}`);
        fraction[carrier.mineral] = (fraction[carrier.mineral] ?? 0.0) + grade * carrier.share / content;
      } else if (carrier.mode === 'trace') {
        const declared = spec[carrier.mineral].fraction;
        if (declared <= 0.0) throw new Error(`trace carrier ${carrier.mineral} needs a declared fraction`);
        fraction[carrier.mineral] = declared;
        composition[carrier.mineral][payable.species] = (composition[carrier.mineral][payable.species] ?? 0.0) + grade * carrier.share / declared;
      } else {
        throw new Error(`unknown carrier mode: ${carrier.mode}`);
      }
    }
  });
  const balance = ids.filter(m => !(m in fraction) && spec[m].fraction === 0.0);
  if (balance.length !== 1) throw new Error(`exactly one balance gangue mineral is required, found ${balance}`);
  totalAssay(ore, op, spec, ids, composition, fraction, balance[0]);
  for (const m of ids) if (!(m in fraction) && !balance.includes(m)) fraction[m] = spec[m].fraction;
  let declaredTotal = 0.0;
  for (const v of Object.values(fraction)) declaredTotal += v;
  const remainder = 1.0 - declaredTotal;
  if (remainder <= 0.0) throw new Error('declared and derived mineral fractions exceed the ore');
  fraction[balance[0]] = remainder;
  const g = grid();
  for (const m of ids) {
    const grains = spec[m].grains ?? null;
    if (grains === null) continue;
    // gravity-recoverable grains enter liberated with their own sizes (E-11): no liberation curve, no composites
    if (spec[m].liberation_size_um > 0.0 || spec[m].composite_content > 0.0) {
      throw new Error(`${m}: declared grains are liberated; a liberation size or composites cannot apply`);
    }
    const sizes = grains.size_um, passing = grains.passing;
    let bad = sizes.length !== passing.length || passing[0] !== 1.0 || passing[passing.length - 1] < 0.0 || !(0.0 < grains.lower_um && grains.lower_um < sizes[sizes.length - 1]);
    for (let i = 1; i < sizes.length; i += 1) if (sizes[i] >= sizes[i - 1] || passing[i] > passing[i - 1]) bad = true;
    if (bad) throw new Error(`${m}: grains need descending sizes, all passing the first, non-increasing passing and a lower size below the last`);
  }
  const liberation: Record<string, Vec> = {};
  for (const m of valuable) {
    const s = spec[m];
    const lib = new Float64Array(g.n);
    for (let i = 0; i < g.n; i += 1) lib[i] = s.liberation_size_um > 0.0 ? 1.0 / (1.0 + Math.pow(g.size[i] / s.liberation_size_um, s.liberation_slope)) : 1.0;
    liberation[m] = lib;
  }
  const units: Record<string, string> = {};
  for (const p of ore.payables) units[p.species] = p.unit;
  for (const s of ore.quality_species) units[s] ??= '%';
  const density: Record<string, number> = {};
  for (const m of ids) density[m] = mineralTable[m].density;
  return new ResolvedOre(ids, spec, fraction, composition, density, valuable, balance[0], liberation, species, units,
    ore.payables[0].species, ore.payables.map(p => p.species),
    ore.crushing_work_index_kwh_t * op.work_index_kwh_t / ore.work_index_kwh_t);
}
