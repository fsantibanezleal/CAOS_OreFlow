/** Validate fetched records against the same schemas the producer document gate uses. */
import Ajv2020 from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';
import operatingSchema from '../../../docs/contracts/schemas/oreflow-contract-v1.schema.json';
import learningSchema from '../../../docs/contracts/schemas/oreflow-learning-v2.schema.json';
import type { OperatingContract } from '../generated/oreflow-contract-v1';
import type { LearningRecord } from '../generated/oreflow-learning-v2';
import { checkLearningEvidence } from './learning-evidence';

const ajv = new Ajv2020({ strict: true, allErrors: true, coerceTypes: false, useDefaults: false });
const operating = ajv.compile<OperatingContract>(operatingSchema);
const learning = ajv.compile<LearningRecord>(learningSchema);

function checkNumbers(value: unknown, path = '$'): void {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`Invalid artifact at ${path}: number must be finite and JSON-compatible`);
  }
  if (Array.isArray(value)) value.forEach((item, index) => checkNumbers(item, `${path}[${index}]`));
  else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) checkNumbers(item, `${path}.${key}`);
  }
}

function read<T>(name: string, validate: ValidateFunction<T>, payload: unknown): T {
  checkNumbers(payload);
  if (!validate(payload)) {
    const details = validate.errors?.slice(0, 5).map(error => `${error.instancePath || '/'} ${error.message}`).join('; ');
    throw new Error(`Invalid ${name}: ${details}`);
  }
  return payload;
}

export const readOperatingContract = (payload: unknown): OperatingContract => read('operating contract', operating, payload);
export function readLearningRecord(payload: unknown): LearningRecord {
  const record = read('learning record', learning, payload);
  checkLearningEvidence(record);
  return record;
}
