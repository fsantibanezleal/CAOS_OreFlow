import {createHash} from 'node:crypto';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, resolve, relative, sep} from 'node:path';

export const SUITE = 'the browser reproduces the baked optimization records';
export const SUBSET = ['iron_magnetite_fine/nominal', 'copper_oxide/nominal', 'gold_free_milling/nominal'];
const fail = message => { throw new Error(message); };
export function selectInventory(ids, {full = false, shard} = {}) {
  if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string' || !/^[a-z0-9_]+\/[a-z0-9_]+$/.test(id)) || new Set(ids).size !== ids.length) fail('Invalid or duplicate variant inventory');
  const sorted = [...ids].sort();
  if (shard !== undefined) {
    if (!full || !/^[1-9]\d*\/[1-9]\d*$/.test(shard)) fail('OF_PARITY_SHARD requires full mode and index/count');
    const [index, count] = shard.split('/').map(Number);
    if (!Number.isSafeInteger(count) || count > sorted.length || index > count) fail('Invalid shard range');
    return sorted.filter((_, i) => i % count === index - 1);
  }
  if (full) return sorted;
  if (!SUBSET.every(id => ids.includes(id))) fail('Missing declared CI variant');
  return sorted.filter(id => SUBSET.includes(id));
}

export function readInventory(derived) {
  const index = JSON.parse(readFileSync(join(derived, 'manifests/index.json'), 'utf8'));
  if (!Array.isArray(index.cases) || index.cases.length !== index.n_cases || !index.cases.length) fail('Invalid declared cases');
  const cases = index.cases.map(c => c.case_id);
  if (new Set(cases).size !== cases.length || cases.some(id => typeof id !== 'string' || !/^[a-z0-9_]+$/.test(id))) fail('Invalid declared case IDs');
  const files = readdirSync(join(derived, 'cases')).filter(f => f.endsWith('.json')).sort();
  if (JSON.stringify(files) !== JSON.stringify(cases.map(id => `${id}.json`).sort())) fail('Case file inventory differs from manifest');
  const ids = [];
  for (const declared of index.cases) {
    const artifact = JSON.parse(readFileSync(join(derived, 'cases', `${declared.case_id}.json`), 'utf8'));
    if (artifact.case_id !== declared.case_id || !Array.isArray(artifact.variants) || artifact.variants.length !== declared.variants || !artifact.variants.length) fail('Variant inventory differs from manifest');
    for (const v of artifact.variants) {
      if (typeof v.id !== 'string' || !/^[a-z0-9_]+$/.test(v.id)) fail('Invalid variant ID');
      if (!v.methods?.optimization) fail('Missing optimization record');
      ids.push(`${artifact.case_id}/${v.id}`);
    }
  }
  if (ids.length !== index.n_variants) fail('Variant total differs from manifest');
  return selectInventory(ids, {full:true});
}

export function planShards(ids, workers) {
  if (!Number.isSafeInteger(workers) || workers < 1 || workers > 8 || workers > ids.length) fail('Workers must be 1..8 and not exceed inventory');
  const shards = Array.from({length:workers}, (_, i) => ({shard:`${i+1}/${workers}`, ids:selectInventory(ids, {full:true, shard:`${i+1}/${workers}`})}));
  const flat = shards.flatMap(s => s.ids);
  if (new Set(flat).size !== ids.length || flat.length !== ids.length) fail('Shards are not a disjoint cover');
  return shards;
}

/** Admit actual completed Vitest JSON, not merely a successful subprocess exit. */
export function admitShard(report, expected, testFile, exitCode, signal = null) {
  if (exitCode !== 0 || signal !== null) fail('Child did not exit successfully');
  if (!report || report.success !== true || report.wasInterrupted === true || report.numTotalTests !== expected.length || report.numPassedTests !== expected.length
      || report.numFailedTests !== 0 || report.numPendingTests !== 0 || report.numTodoTests !== 0
      || report.numFailedTestSuites !== 0 || report.numPendingTestSuites !== 0 || (report.numRuntimeErrorTestSuites ?? 0) !== 0 || (report.unhandledErrors?.length ?? 0) !== 0) fail('Incomplete or failed Vitest totals');
  if (!Array.isArray(report.testResults) || report.testResults.length !== 1) fail('Missing or unexpected test file');
  const file = report.testResults[0];
  if (resolve(file.name ?? '') !== resolve(testFile) || file.status !== 'passed' || !Number.isFinite(file.startTime) || !Number.isFinite(file.endTime) || file.endTime < file.startTime
      || !Array.isArray(file.assertionResults) || file.assertionResults.length !== expected.length) fail('Invalid completed test file');
  const seen = new Set();
  for (const test of file.assertionResults) {
    if (test.status !== 'passed' || !expected.includes(test.title) || seen.has(test.title)
        || test.fullName !== `${SUITE} ${test.title}` || JSON.stringify(test.ancestorTitles) !== JSON.stringify([SUITE])
        || !Array.isArray(test.failureMessages) || test.failureMessages.length || !Number.isFinite(test.duration) || test.duration < 0) fail('Missing, duplicate, unexpected or unrun assertion');
    seen.add(test.title);
  }
  if (seen.size !== expected.length) fail('Missing successful variants');
  return [...seen].sort();
}

export function admitAll(plan, results, testFile) {
  if (!Array.isArray(results) || results.length !== plan.length) fail('Missing worker evidence');
  const ids = [];
  for (let i=0; i<plan.length; i++) {
    if (results[i]?.shard !== plan[i].shard) fail('Unexpected shard evidence');
    ids.push(...admitShard(results[i].report, plan[i].ids, testFile, results[i].exitCode, results[i].signal));
  }
  if (new Set(ids).size !== ids.length || ids.length !== plan.flatMap(s => s.ids).length) fail('Duplicate aggregate coverage');
  return ids.sort();
}

export function snapshot(roots) {
  const files = {};
  function visit(path, key) {
    const stat = statSync(path);
    if (stat.isDirectory()) for (const name of readdirSync(path).sort()) {
      if (!['__pycache__','.pytest_cache'].includes(name)) visit(join(path,name), `${key}/${name}`);
    }
    else if (stat.isFile()) files[key] = createHash('sha256').update(readFileSync(path)).digest('hex');
    else fail(`Unsupported input ${key}`);
  }
  for (const [label,path] of Object.entries(roots).sort(([a],[b]) => a.localeCompare(b))) visit(path,label);
  return {sha256:createHash('sha256').update(JSON.stringify(files)).digest('hex'), files};
}
export function assertStable(before, after) {
  if (!before || !after || before.sha256 !== after.sha256 || JSON.stringify(before.files) !== JSON.stringify(after.files)) fail('Source/model/data drift');
}

export function parseArgs(args, repo) {
  let workers=2, out, plan=false;
  const seen = new Set();
  for (let i=0; i<args.length; i++) {
    const arg=args[i];
    if (seen.has(arg)) fail('Duplicate option'); seen.add(arg);
    if (arg==='--plan') plan=true;
    else if (arg==='--workers') { const value=args[++i]; if (!/^[1-8]$/.test(value ?? '')) fail('Workers must be 1..8'); workers=Number(value); }
    else if (arg==='--out') out=args[++i];
    else fail(`Unknown option ${arg}`);
  }
  if (typeof out !== 'string' || !out.length || !/^(?:[a-zA-Z]:[\\/]|\/)/.test(out)) fail('An absolute external --out directory is required');
  out=resolve(out);
  const inside=relative(repo,out);
  if (!inside || (!inside.startsWith(`..${sep}`) && inside!=='..' && !/^[a-zA-Z]:/.test(inside))) fail('Output must be outside the repository');
  return {workers,out,plan};
}
