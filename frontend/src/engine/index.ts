/**
 * The browser process engine: a line-by-line port of data-pipeline/pipeline/engine (PE-31). The Python
 * engine is canonical; frontend/src/test/parity.test.ts checks every baked variant against it.
 */
export { simulate, type CircuitResult } from './circuit';
export { validate, verdictSummary, decodeValue, type OperatingContract, type Verdict, type ContractError } from './contract';
export { trace, TRACE_SCHEMA, type Trace } from './trace';
export { sweep, gridPoints, type Axis, type SweepCell, type SweepRequest } from './sweep';
export type { Ore, Plant, OperatingPoint, Family } from './model';

import { simulate } from './circuit';
import type { OperatingPoint, Ore, Plant } from './model';
import { trace } from './trace';

/** One validated state to its trace: the call every live view makes. */
export function evaluate(ore: Ore, plant: Plant, point: OperatingPoint): ReturnType<typeof trace> {
  return trace(simulate(ore, plant, point), point, plant.family);
}
