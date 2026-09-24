import type { Benchmark, CaseArtifact, CaseIndex, CaseManifest } from '../lib/contract.types';
import { APP_VERSION } from '../lib/version';
const base = import.meta.env.BASE_URL;
async function get<T>(path: string): Promise<T> { const response = await fetch(`${base}data/${path}?v=${APP_VERSION}`, { cache: 'no-store' }); if (!response.ok) throw new Error(`${response.status} ${path}`); return response.json() as Promise<T>; }
export const loadIndex = () => get<CaseIndex>('manifests/index.json');
export const loadManifest = (id: string) => get<CaseManifest>(`manifests/${id}.json`);
export const loadCase = (id: string) => get<CaseArtifact>(`cases/${id}.json`);
export const loadBenchmark = () => get<Benchmark>('benchmark.json');
