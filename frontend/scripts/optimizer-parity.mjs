/** Local release validation only. CI continues to run the three default variants. */
import {spawn} from 'node:child_process';
import {mkdir, writeFile, readFile, realpath} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {admitAll, assertStable, parseArgs, planShards, readInventory, snapshot} from './optimizer-parity-lib.product.mjs';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(frontend, '..');
const children = new Set();
let interrupted = false;
function stopChild(child) {
  if (!children.has(child) || !Number.isInteger(child.pid)) return;
  if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {stdio:'ignore', windowsHide:true});
  else child.kill('SIGTERM');
}
function stopOwned() {
  interrupted = true;
  for (const child of children) stopChild(child);
}
process.on('SIGINT', stopOwned); process.on('SIGTERM', stopOwned);
const json = (path, value) => writeFile(path, JSON.stringify(value,null,2)+'\n', {flag:'wx'});

try {
  const options = parseArgs(process.argv.slice(2), repo);
  // Resolve an existing parent so a junction cannot redirect receipts into the checkout.
  const actualOut = join(await realpath(dirname(options.out)), options.out.split(/[\\/]/).at(-1));
  parseArgs(['--out', actualOut, '--workers', String(options.workers)], await realpath(repo));
  const derived=resolve(process.env.OF_DERIVED ?? join(repo,'data/derived'));
  const models=resolve(process.env.OF_MODELS ?? join(repo,'models'));
  const ids=readInventory(derived);
  if (ids.length !== 96) throw new Error(`Release requires all 96 variants; found ${ids.length}`);
  const shards=planShards(ids,options.workers);
  const timeout=Number(process.env.OF_PARITY_TIMEOUT ?? 900000);
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 3600000) throw new Error('OF_PARITY_TIMEOUT must be 1..3600000 milliseconds');
  const roots={source:join(frontend,'src'), runner:join(frontend,'scripts'), pipeline:join(repo,'data-pipeline/pipeline'),
    data:derived, models, contracts:join(repo,'docs/contracts'), version:join(repo,'VERSION'),
    package:join(frontend,'package.json'), lock:join(frontend,'package-lock.json'), config:join(frontend,'vite.config.ts'), tsconfig:join(frontend,'tsconfig.json')};
  // No output may become an input, including alternate model/data roots outside this checkout.
  for (const input of [derived,models]) {
    try { parseArgs(['--out',actualOut], await realpath(input)); }
    catch { throw new Error('Output must not be inside model/data inputs'); }
  }
  await mkdir(actualOut); // a fresh directory is mandatory; no old worker reports can be reused
  const before=snapshot(roots);
  await json(join(actualOut,'before.json'),before);
  const plan={schema:'oreflow.optimizer-parity-plan/v1', mode:options.plan?'PLAN_ONLY':'RUN', expected:ids, shards, source_sha256:before.sha256,
    node:process.version, timeout_ms:timeout, test_file:join(frontend,'src/test/optimizer-parity.test.ts')};
  await json(join(actualOut,'plan.json'),plan);
  if (options.plan) {
    console.log(`PLAN ONLY: ${ids.length} variants in ${shards.length} disjoint shards; no parity executed`);
  } else {
    const jobs=shards.map((shard,index) => new Promise((accept,reject) => {
      const prefix=join(actualOut,`worker-${index+1}`);
      const argv=[join(frontend,'node_modules/vitest/vitest.mjs'),'run','src/test/optimizer-parity.test.ts','--maxWorkers','1','--no-file-parallelism',
        '--reporter','json','--outputFile',`${prefix}.json`];
      const child=spawn(process.execPath,argv,{cwd:frontend,windowsHide:true,stdio:['ignore','pipe','pipe'],
        env:{...process.env,OF_PARITY:'full',OF_PARITY_SHARD:shard.shard,OF_PARITY_TIMEOUT:String(timeout),OF_DERIVED:derived,OF_MODELS:models}});
      children.add(child);
      const chunks=[]; let bytes=0, overflow=false;
      for (const stream of [child.stdout,child.stderr]) stream.on('data',chunk => {
        bytes+=chunk.length;
        if (bytes <= 1024*1024) chunks.push(chunk);
        else if (!overflow) { overflow=true; stopChild(child); }
      });
      child.on('error',error => {children.delete(child); reject(error);});
      child.on('close',async (exitCode,signal) => {
        children.delete(child);
        try {
          await writeFile(`${prefix}.log`,Buffer.concat(chunks),{flag:'wx'});
          let report=null, reportError=null;
          try { report=JSON.parse(await readFile(`${prefix}.json`,'utf8')); } catch(error) { reportError=error.message; }
          accept({shard:shard.shard,exitCode,signal,overflow,reportError,report});
        } catch(error) {reject(error);}
      });
    }));
    const settled=await Promise.allSettled(jobs);
    const after=snapshot(roots);
    await json(join(actualOut,'after.json'),after);
    const results=settled.filter(r=>r.status==='fulfilled').map(r=>r.value);
    let admitted=[], error=null;
    try {
      if (interrupted || settled.some(r=>r.status==='rejected') || results.some(r=>r.overflow || r.reportError)) throw new Error('Interrupted, malformed, missing or failed worker evidence');
      assertStable(before,after);
      admitted=admitAll(shards,results,plan.test_file);
      if (JSON.stringify(admitted)!==JSON.stringify(ids)) throw new Error('Aggregate inventory mismatch');
    } catch(problem) {error=problem.message;}
    const summary={schema:'oreflow.optimizer-parity-result/v1',success:error===null,expected:ids,admitted,error,source_sha256:before.sha256,
      final_source_sha256:after.sha256,workers:results.map(({report,...status})=>status)};
    await json(join(actualOut,'result.json'),summary);
    if (error) throw new Error(error);
    console.log(`PASS: ${admitted.length}/${ids.length} actual variants; ${shards.length} shards; inputs unchanged`);
  }
} catch(error) {
  stopOwned(); console.error(`Optimizer parity rejected: ${error.message}`); process.exitCode=1;
} finally {
  process.off('SIGINT',stopOwned); process.off('SIGTERM',stopOwned);
}
