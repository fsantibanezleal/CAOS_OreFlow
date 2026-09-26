/**
 * Energy report (port of engine/energy.py; docs/methodologies/09_energy.md): crushing and grinding
 * energy, the Bond requirement and operating work index, and the Rittinger and Kick comparison laws
 * calibrated to Bond at the declared reference reduction; the comparison laws never enter the total.
 */
import { bondEnergy, operatingWorkIndex } from './comminution';
import { constant } from './constants';

export function referenceConstants(workIndex: number): [number, number] {
  const fRef = constant('bond.reference_feed_um');
  const pRef = constant('bond.reference_product_um');
  const reference = bondEnergy(workIndex, fRef, pRef);
  return [reference / (1.0 / pRef - 1.0 / fRef), reference / Math.log(fRef / pRef)];
}

export function rittinger(workIndex: number, f80: number, p80: number): number {
  const [k] = referenceConstants(workIndex);
  return k * (1.0 / p80 - 1.0 / f80);
}

export function kick(workIndex: number, f80: number, p80: number): number {
  const [, k] = referenceConstants(workIndex);
  return k * Math.log(f80 / p80);
}

export function energyReport(workIndex: number, crushingWorkIndex: number, crusherFeedF80: number, crusherP80: number,
  grindingEnergy: number, millF80: number, millP80: number): Record<string, number> {
  const crushing = bondEnergy(crushingWorkIndex, crusherFeedF80, crusherP80);
  const wio = operatingWorkIndex(grindingEnergy, millF80, millP80);
  return {
    specific_energy_crushing_kwh_t: crushing,
    specific_energy_grinding_kwh_t: grindingEnergy,
    specific_energy_total_kwh_t: crushing + grindingEnergy,
    bond_energy_kwh_t: bondEnergy(workIndex, millF80, millP80),
    operating_work_index_kwh_t: wio,
    bond_efficiency_ratio: workIndex / wio,
    energy_rittinger_kwh_t: rittinger(workIndex, millF80, millP80),
    energy_kick_kwh_t: kick(workIndex, millF80, millP80),
  };
}
