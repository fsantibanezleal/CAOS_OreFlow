/**
 * Closed ball-mill circuit: energy-specific population balance, cyclone, gravity bleed, water (port of
 * engine/grinding.py; theory in docs/methodologies/03_grinding-circuit.md). For each mineral the steady
 * state satisfies (T^-1(e) - diag(r)) p = f + s; valuable minerals are solved first because their
 * composites define the host-gangue source; composites are host-limited as a fixed point.
 */
import { bondEnergy, breakageMatrix, MillOperator, selectionEnergy } from './comminution';
import { constant } from './constants';
import { correctedCut, reducedPartition, sizeCluster, type PlittSizing } from './cyclone';
import { grid, type SizeGrid, type Vec } from './grid';
import { minusDiagonal, solve } from './linalg';
import type { Flags, OperatingPoint, Plant } from './model';
import type { ResolvedOre } from './ore';
import { RootError, solveDecreasing } from './roots';
import { partitionSpecies, speciesDefs, toMinerals, toSpecies, type Species, type SpeciesDef } from './species';
import { Stream } from './streams';

type ByMineral = Record<string, Vec>;

export type PassResult = { product: ByMineral; underflow: ByMineral; overflow: ByMineral; gravity: ByMineral; circulatingLoad: number };

export type GrindingResult = {
  energy_per_pass_kwh_t: number;
  specific_energy_kwh_t: number;
  power_kw: number;
  required_power_kw: number;
  power_limited: boolean;
  cut_um: number;
  bypass: number;
  circulating_load: number;
  target_p80_um: number;
  p80_um: number;
  feed_f80_um: number;
  streams: Record<string, Stream>;
  partition: Record<string, number[]>;
  sizing: PlittSizing | null;
  water: Record<string, number>;
  gold_circulating_load: number | null;
  defs: SpeciesDef[];
  overflow_species: Species;
  species_consistency: number;
  composite_scale: Vec;
};

const vsum = (v: Vec) => { let s = 0.0; for (let i = 0; i < v.length; i += 1) s += v[i]; return s; };

export class GrindingCircuit {
  readonly g: SizeGrid;
  readonly operators: Record<string, MillOperator> = {};
  readonly newFeedTph: number;
  readonly waterOver: number;
  readonly waterUnder: number;
  readonly bypass: number;
  readonly bleed: number;
  readonly rhoHost: number;
  private cutGuess: number;
  compositeScale: Vec;

  constructor(readonly ore: ResolvedOre, readonly plant: Plant, readonly op: OperatingPoint, readonly feed: ByMineral, readonly flags: Flags) {
    this.g = grid();
    const mill = plant.mill;
    const b = breakageMatrix(mill.beta0, mill.beta1, mill.beta2);
    const base = selectionEnergy(mill, op.work_index_kwh_t);
    for (const m of ore.ids) {
      const spec = ore.spec[m];
      const selection = new Float64Array(this.g.n);
      if (ore.valuable.includes(m)) {
        const lib = ore.liberation[m];
        for (let i = 0; i < this.g.n; i += 1) selection[i] = base[i] * (lib[i] * spec.grindability + (1.0 - lib[i]));
      } else {
        for (let i = 0; i < this.g.n; i += 1) selection[i] = base[i] * spec.grindability;
      }
      this.operators[m] = new MillOperator(selection, b);
    }
    let total = 0.0;
    for (const v of Object.values(feed)) total += vsum(v);
    this.newFeedTph = total;
    const waterDensity = constant('water.density_t_m3');
    const su = plant.cyclone.underflow_solids;
    this.waterOver = this.newFeedTph * op.water_m3_t * waterDensity;
    this.waterUnder = op.circulating_load * this.newFeedTph * (1.0 - su) / su;
    this.bypass = this.waterUnder / (this.waterUnder + this.waterOver);
    this.bleed = plant.gravity !== null ? op.gravity_bleed : 0.0;
    this.rhoHost = ore.density[ore.host];
    this.cutGuess = Math.log(Math.max(op.target_p80_um, 1.0));
    this.compositeScale = new Float64Array(this.g.n).fill(1.0);
    for (const m of ore.valuable) {
      const host = ore.spec[m].host;
      if (ore.spec[m].composite_content > 0.0 && host && host !== ore.host) {
        throw new Error(`composites of ${m} must be hosted by the balance gangue ${ore.host}`);
      }
    }
  }

  private gravityCurve(): Vec {
    const gp = this.plant.gravity as NonNullable<Plant['gravity']>;
    const out = new Float64Array(this.g.n);
    for (let i = 0; i < this.g.n; i += 1) out[i] = gp.max_recovery * (1.0 - Math.exp(-Math.pow(this.g.size[i] / gp.size_scale_um, 2.0)));
    return out;
  }

  /** One steady-state solve with composites scaled by `scale` per class (1 = declared content). */
  private pass(energyPerPass: number, cut: number, scale: Vec): [PassResult, Vec] {
    const { ore } = this;
    const n = this.g.n;
    const rf = this.bypass;
    const bleed = this.bleed;
    const sharp = this.plant.cyclone.sharpness;
    const yHost = reducedPartition(cut, sharp);
    const product: ByMineral = {};
    const under: ByMineral = {};
    const over: ByMineral = {};
    const grav: ByMineral = {};
    const hostSource = new Float64Array(n);
    const demand = new Float64Array(n);
    for (const m of ore.valuable) {
      const spec = ore.spec[m];
      const c = spec.composite_content;
      const lib = ore.liberation[m];
      const yLib = reducedPartition(correctedCut(cut, this.rhoHost, ore.density[m]), sharp);
      const yComp = c > 0.0 ? reducedPartition(correctedCut(cut, this.rhoHost, ore.compositeDensity(m)), sharp) : yLib;
      const gc = bleed > 0.0 && spec.gravity ? this.gravityCurve() : null;
      const lockedFraction = new Float64Array(n);
      const freeFraction = new Float64Array(n);
      const aLib = new Float64Array(n);
      const aComp = new Float64Array(n);
      const cUnder = new Float64Array(n);
      const gFrac = new Float64Array(n);
      for (let i = 0; i < n; i += 1) {
        const unliberated = 1.0 - lib[i];
        lockedFraction[i] = c > 0.0 ? unliberated * scale[i] : 0.0;
        freeFraction[i] = 1.0 - lockedFraction[i];
        aLib[i] = rf + (1.0 - rf) * yLib[i];
        aComp[i] = rf + (1.0 - rf) * yComp[i];
        cUnder[i] = freeFraction[i] * aLib[i] + lockedFraction[i] * aComp[i];
        if (gc !== null) {
          const gp = this.plant.gravity as NonNullable<Plant['gravity']>;
          gFrac[i] = bleed * (gc[i] * freeFraction[i] * aLib[i] + gp.composite_recovery * lockedFraction[i] * aComp[i]);
        } else if (bleed > 0.0) {
          gFrac[i] = bleed * (this.plant.gravity as NonNullable<Plant['gravity']>).gangue_yield * cUnder[i];
        }
      }
      const returning = new Float64Array(n);
      for (let i = 0; i < n; i += 1) returning[i] = cUnder[i] - gFrac[i];
      const p = solve(minusDiagonal(this.operators[m].inverse(energyPerPass), returning), this.feed[m]);
      const u = new Float64Array(n);
      const gv = new Float64Array(n);
      const o = new Float64Array(n);
      for (let i = 0; i < n; i += 1) { u[i] = cUnder[i] * p[i]; gv[i] = gFrac[i] * p[i]; o[i] = p[i] - u[i]; }
      product[m] = p; under[m] = u; grav[m] = gv; over[m] = o;
      if (c > 0.0) {
        for (let i = 0; i < n; i += 1) {
          demand[i] += (1.0 - lib[i]) * p[i] * (1.0 - c) / c;
          hostSource[i] += (1.0 - rf) * lockedFraction[i] * p[i] * (1.0 - c) / c * (yComp[i] - yHost[i]);
        }
      }
    }
    for (const m of ore.ids) {
      if (ore.valuable.includes(m)) continue;
      const y = m === ore.host ? yHost : reducedPartition(correctedCut(cut, this.rhoHost, ore.density[m]), sharp);
      const gYield = bleed > 0.0 ? bleed * (this.plant.gravity as NonNullable<Plant['gravity']>).gangue_yield : 0.0;
      const c0 = new Float64Array(n);
      const returning = new Float64Array(n);
      const rhs = new Float64Array(n);
      for (let i = 0; i < n; i += 1) {
        c0[i] = rf + (1.0 - rf) * y[i];
        returning[i] = (1.0 - gYield) * c0[i];
        const source = m === ore.host ? hostSource[i] : 0.0;
        rhs[i] = this.feed[m][i] + (1.0 - gYield) * source;
      }
      const p = solve(minusDiagonal(this.operators[m].inverse(energyPerPass), returning), rhs);
      const u = new Float64Array(n);
      const gv = new Float64Array(n);
      const o = new Float64Array(n);
      for (let i = 0; i < n; i += 1) {
        const source = m === ore.host ? hostSource[i] : 0.0;
        u[i] = c0[i] * p[i] + source;
        gv[i] = gYield * u[i];
        o[i] = p[i] - u[i];
      }
      product[m] = p; under[m] = u; grav[m] = gv; over[m] = o;
    }
    let totalUnder = 0.0;
    for (const u of Object.values(under)) totalUnder += vsum(u);
    return [{ product, underflow: under, overflow: over, gravity: grav, circulatingLoad: totalUnder / this.newFeedTph }, demand];
  }

  /** Steady state with host-limited composites, the same rule as species.toSpecies. */
  run(energyPerPass: number, cut: number): PassResult {
    const n = this.g.n;
    let scale = new Float64Array(n).fill(1.0);
    const tolerance = constant('numerics.composite_scale_tolerance');
    let result: PassResult | null = null;
    for (let k = 0; k < constant('numerics.composite_scale_max_iterations'); k += 1) {
      const [r, demand] = this.pass(energyPerPass, cut, scale);
      result = r;
      const host = r.product[this.ore.host];
      const limited = new Float64Array(n).fill(1.0);
      let change = 0.0;
      for (let i = 0; i < n; i += 1) {
        if (demand[i] > host[i]) limited[i] = Math.max(host[i], 0.0) / demand[i];
        change = Math.max(change, Math.abs(limited[i] - scale[i]));
      }
      if (change <= tolerance) { this.compositeScale = limited; return r; }
      scale = limited;
    }
    this.flags.add('composite_scale_not_converged', 'Host-limited composites did not converge in the grinding circuit; the last pass is reported.');
    this.compositeScale = scale;
    return result as PassResult;
  }

  /** Underflow fraction (with bypass) of every particle class at the given host cut. */
  speciesUnderflow(cut: number, defs: SpeciesDef[]): Species {
    const rf = this.bypass;
    const sharp = this.plant.cyclone.sharpness;
    const out: Species = {};
    for (const d of defs) {
      const y = reducedPartition(correctedCut(cut, this.rhoHost, d.density), sharp);
      const v = new Float64Array(y.length);
      for (let i = 0; i < y.length; i += 1) v[i] = rf + (1.0 - rf) * y[i];
      out[d.id] = v;
    }
    return out;
  }

  solveCut(energyPerPass: number): number {
    const target = this.op.circulating_load;
    const [lo, hi] = constant<number[]>('grinding.cut_bracket_um').map(v => Math.log(v));
    const f = (x: number) => {
      const load = this.run(energyPerPass, Math.exp(x)).circulatingLoad;
      return load > 0.0 ? Math.log(load) - Math.log(target) : -Infinity;
    };
    const x = solveDecreasing(f, this.cutGuess, Math.log(constant('numerics.cut_search_step_ratio')), lo, hi);
    this.cutGuess = x;
    return Math.exp(x);
  }

  overflowP80(energyPerPass: number): number {
    const cut = this.solveCut(energyPerPass);
    const result = this.run(energyPerPass, cut);
    const total = this.g.zeros();
    for (const mass of Object.values(result.overflow)) for (let i = 0; i < total.length; i += 1) total[i] += mass[i];
    return this.g.p80(total);
  }

  solve(): GrindingResult {
    const { op, plant, g } = this;
    const feedTotal = g.zeros();
    for (const mass of Object.values(this.feed)) for (let i = 0; i < feedTotal.length; i += 1) feedTotal[i] += mass[i];
    const f80 = g.p80(feedTotal);
    const [lo, hi] = constant<number[]>('grinding.energy_bracket_kwh_t').map(v => Math.log(v));
    const guess = Math.max(bondEnergy(op.work_index_kwh_t, f80, op.target_p80_um), constant('numerics.energy_guess_floor_kwh_t'))
      / (1.0 + op.circulating_load);
    const f = (x: number) => Math.log(this.overflowP80(Math.exp(x))) - Math.log(op.target_p80_um);
    let energy: number;
    try {
      energy = Math.exp(solveDecreasing(f, Math.log(guess), Math.log(2.0), lo, hi));
    } catch (error) {
      if (!(error instanceof RootError)) throw error;
      this.flags.add('target_unreachable', 'The target P80 cannot be reached at the design circulating load within the energy search range.');
      energy = f(hi) > 0.0 ? Math.exp(hi) : Math.exp(lo);
    }
    const required = energy * (1.0 + op.circulating_load) * this.newFeedTph;
    const limited = required > plant.mill.installed_power_kw;
    if (limited) {
      energy = plant.mill.installed_power_kw / ((1.0 + op.circulating_load) * this.newFeedTph);
      this.flags.add('power_limited', 'Required mill power exceeds the installed power; the circuit runs at installed power with a coarser product.');
    }
    let cut: number;
    try {
      cut = this.solveCut(energy);
    } catch (error) {
      if (!(error instanceof RootError)) throw error;
      this.flags.add('circulating_load_unreachable', 'The design circulating load cannot be held at this energy; the cut is at its search limit.');
      cut = constant<number[]>('grinding.cut_bracket_um')[1];
    }
    const result = this.run(energy, cut);
    return this.report(energy, cut, result, f80, required, limited);
  }

  private report(energy: number, cut: number, r: PassResult, f80: number, required: number, limited: boolean): GrindingResult {
    const { ore, op, plant, g } = this;
    const n = g.n;
    const waterDensity = constant('water.density_t_m3');
    let millSolids = 0.0;
    for (const p of Object.values(r.product)) millSolids += vsum(p);
    const smd = plant.mill.discharge_solids;
    const waterMillDischarge = millSolids * (1.0 - smd) / smd;
    const waterCycloneFeed = this.waterOver + this.waterUnder;
    const millAddition = waterMillDischarge - this.waterUnder;
    const sumpAddition = waterCycloneFeed - waterMillDischarge;
    if (millAddition < 0.0) this.flags.add('mill_water_negative', 'The recycled underflow carries more water than the declared mill discharge density allows.');
    if (sumpAddition < 0.0) this.flags.add('sump_water_negative', 'The declared mill discharge is wetter than the cyclone feed; no sump dilution is possible.');
    const recycle: ByMineral = {};
    for (const m of ore.ids) {
      const v = new Float64Array(n);
      for (let i = 0; i < n; i += 1) v[i] = r.underflow[m][i] - r.gravity[m][i];
      recycle[m] = v;
    }
    const pick = (source: ByMineral, fn?: (m: string, i: number) => number) => {
      const out: ByMineral = {};
      for (const m of ore.ids) {
        const v = new Float64Array(n);
        for (let i = 0; i < n; i += 1) v[i] = fn ? fn(m, i) : source[m][i];
        out[m] = v;
      }
      return out;
    };
    const streams: Record<string, Stream> = {
      new_feed: new Stream(pick(this.feed), 0.0),
      mill_feed: new Stream(pick(this.feed, (m, i) => this.feed[m][i] + recycle[m][i]), waterMillDischarge),
      mill_discharge: new Stream(pick(r.product), waterMillDischarge),
      cyclone_feed: new Stream(pick(r.product), waterCycloneFeed),
      cyclone_underflow: new Stream(pick(r.underflow), this.waterUnder),
      cyclone_overflow: new Stream(pick(r.overflow), this.waterOver),
      recycle: new Stream(recycle, this.waterUnder),
    };
    if (this.bleed > 0.0) {
      streams.gravity_feed = new Stream(pick(r.underflow, (m, i) => this.bleed * r.underflow[m][i]), this.bleed * this.waterUnder);
      streams.gravity_concentrate = new Stream(pick(r.gravity), 0.0);
    }
    const totalOver = g.zeros();
    for (const mass of Object.values(r.overflow)) for (let i = 0; i < n; i += 1) totalOver[i] += mass[i];
    let solidsVolume = 0.0;
    for (const m of ore.ids) solidsVolume += vsum(r.product[m]) / ore.density[m];
    const rhoMean = millSolids / solidsVolume;
    const sizing = sizeCluster(plant.cyclone, correctedCut(cut, this.rhoHost, rhoMean), solidsVolume,
      waterCycloneFeed / waterDensity, millSolids, waterCycloneFeed);
    if (!sizing.in_pressure_window) this.flags.add('cyclone_pressure', `Plitt pressure ${sizing.pressure_kpa.toFixed(0)} kPa lies outside the declared operating window.`);
    const sharp = plant.cyclone.sharpness;
    const withBypass = (y: Vec) => Array.from(y, v => this.bypass + (1.0 - this.bypass) * v);
    const partition: Record<string, number[]> = { host: withBypass(reducedPartition(cut, sharp)) };
    for (const m of ore.valuable) partition[m] = withBypass(reducedPartition(correctedCut(cut, this.rhoHost, ore.density[m]), sharp));
    const gold = ore.valuable.filter(m => ore.spec[m].gravity);
    let goldCl: number | null = null;
    if (gold.length > 0) {
      let feedGold = 0.0;
      let underGold = 0.0;
      for (const m of gold) { feedGold += vsum(this.feed[m]); underGold += vsum(r.underflow[m]); }
      goldCl = feedGold > 0.0 ? underGold / feedGold : 0.0;
    }
    const defs = speciesDefs(ore);
    const productSpecies = toSpecies(new Stream(r.product, 0.0), ore, defs);
    const overflowSpecies = partitionSpecies(productSpecies, this.speciesUnderflow(cut, defs))[1];
    const rebuilt = toMinerals(overflowSpecies, defs, ore);
    let scale = 0.0;
    let worst = 0.0;
    for (const m of ore.ids) {
      for (let i = 0; i < n; i += 1) {
        scale = Math.max(scale, Math.abs(r.overflow[m][i]));
        worst = Math.max(worst, Math.abs(rebuilt[m][i] - r.overflow[m][i]));
      }
    }
    const specific = energy * (1.0 + op.circulating_load);
    return {
      energy_per_pass_kwh_t: energy, specific_energy_kwh_t: specific, power_kw: specific * this.newFeedTph,
      required_power_kw: required, power_limited: limited, cut_um: cut, bypass: this.bypass,
      circulating_load: r.circulatingLoad, target_p80_um: op.target_p80_um, p80_um: g.p80(totalOver), feed_f80_um: f80,
      streams, partition, sizing,
      water: { overflow_tph: this.waterOver, underflow_tph: this.waterUnder, mill_discharge_tph: waterMillDischarge,
        mill_addition_tph: millAddition, sump_addition_tph: sumpAddition },
      gold_circulating_load: goldCl, defs, overflow_species: overflowSpecies, species_consistency: worst / scale,
      composite_scale: Float64Array.from(this.compositeScale),
    };
  }
}
