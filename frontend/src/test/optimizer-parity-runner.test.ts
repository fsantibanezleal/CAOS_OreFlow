import {afterAll, expect, it} from 'vitest';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync} from 'node:fs';
import {join, resolve, dirname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {SUBSET, SUITE, selectInventory, readInventory, planShards, admitShard, admitAll, snapshot, assertStable, parseArgs} from '../../scripts/optimizer-parity-lib.mjs';

const repo=fileURLToPath(new URL('../../../',import.meta.url));
const base=resolve(process.env.OF_PARITY_TEST_TEMP ?? tmpdir());
mkdirSync(base,{recursive:true});
const temp=mkdtempSync(join(base,'parity-runner-'));
afterAll(()=>{
  if (dirname(realpathSync(temp)) !== realpathSync(base) || !temp.startsWith(base+sep)) throw new Error('Refuse unsafe fixture cleanup');
  rmSync(temp,{recursive:true});
});
const testFile=join(repo,'frontend/src/test/optimizer-parity.test.ts');
const ids=readInventory(join(repo,'data/derived'));
const fixture = (expected: string[]) => ({success:true,numTotalTests:expected.length,numPassedTests:expected.length,numFailedTests:0,numPendingTests:0,numTodoTests:0,numFailedTestSuites:0,numPendingTestSuites:0,
  testResults:[{name:testFile,status:'passed',startTime:1,endTime:2,assertionResults:expected.map(title=>({title,fullName:`${SUITE} ${title}`,ancestorTitles:[SUITE],status:'passed',failureMessages:[],duration:1}))}]});

it('adversarial: deterministic shards retain all 96 variants exactly once and preserve the three CI variants',()=>{
  expect(ids).toHaveLength(96);
  expect(selectInventory(ids)).toEqual([...SUBSET].sort());
  for(const workers of [1,2,3,8]) {
    const plan=planShards(ids,workers),flat=plan.flatMap(s=>s.ids);
    expect(flat.sort()).toEqual(ids);
    expect(new Set(flat).size).toBe(96);
    expect(plan.every(s=>s.ids.length>0)).toBe(true);
  }
  for(const shard of ['0/8','1/0','9/8','1.0/8','1/8junk','1/200','../8','']) expect(()=>selectInventory(ids,{full:true,shard})).toThrow();
  expect(()=>selectInventory(ids,{shard:'1/8'})).toThrow();
  expect(()=>selectInventory([...ids,ids[0]],{full:true})).toThrow();
});

it('adversarial: actual-format JSON must prove successful exact coverage rather than only green exits',()=>{
  const plan=planShards(ids,8);
  const results=plan.map(s=>({shard:s.shard,exitCode:0,signal:null,report:fixture(s.ids)}));
  expect(admitAll(plan,results,testFile)).toEqual(ids);
  expect(()=>admitAll(plan,results.slice(1),testFile)).toThrow();
  const expected=plan[0].ids;
  const corruptions: Array<(r: any) => void> = [
    r=>{r.success=false;},r=>{r.numPassedTests--;},r=>{r.numPendingTests=1;},r=>{r.numFailedTests=1;},r=>{r.numTodoTests=1;},
    r=>{r.testResults=[];},r=>{r.testResults[0].assertionResults.pop();},
    r=>{r.testResults[0].assertionResults[1]=r.testResults[0].assertionResults[0];},
    r=>{r.testResults[0].assertionResults[0].title='unexpected/case';},
    r=>{r.testResults[0].assertionResults[0].status='pending';},
    r=>{r.testResults[0].assertionResults[0].status='failed';},
    r=>{r.testResults[0].assertionResults[0].failureMessages=['error'];},
    r=>{r.testResults[0].name='another.test.ts';},r=>{r.testResults[0].endTime=null;},
    r=>{r.unhandledErrors=[{message:'unhandled'}];},r=>{r.wasInterrupted=true;}
  ];
  for(const corrupt of corruptions) {const r=fixture(expected);corrupt(r);expect(()=>admitShard(r,expected,testFile,0)).toThrow();}
  for(const r of [null,{},'not JSON',[]]) expect(()=>admitShard(r,expected,testFile,0)).toThrow();
  expect(()=>admitShard(fixture(expected),expected,testFile,1)).toThrow();
  expect(()=>admitShard(fixture(expected),expected,testFile,0,'SIGTERM')).toThrow();
  results[0].shard='2/8';expect(()=>admitAll(plan,results,testFile)).toThrow();
});

it('adversarial: admit real Vitest reporter output and reject an unrun reporter-fixture test',()=>{
  // Reporter fixtures only: these names never represent actual optimizer execution or release coverage.
  const root=join(temp,'reporter-fixture');mkdirSync(root);
  const path=join(root,'format.test.mjs');
  const names=['report_fixture/one','report_fixture/two'];
  writeFileSync(path,`describe(${JSON.stringify(SUITE)},()=>{${names.map(n=>`it(${JSON.stringify(n)},()=>{});`).join('')}});`);
  const argv=[join(repo,'frontend/node_modules/vitest/vitest.mjs'),'run','--root',root,'--globals','--maxWorkers','1','--no-file-parallelism','--reporter','json','--outputFile',join(root,'actual.json')];
  const completed=spawnSync(process.execPath,argv,{cwd:root,encoding:'utf8',timeout:30000,windowsHide:true});
  expect(completed.status,completed.stderr).toBe(0);
  const report=JSON.parse(readFileSync(join(root,'actual.json'),'utf8'));
  expect(admitShard(report,names,path,completed.status,completed.signal)).toEqual(names);
  const partial=spawnSync(process.execPath,[...argv,'--testNamePattern','report_fixture/one$'],{cwd:root,encoding:'utf8',timeout:30000,windowsHide:true});
  expect(partial.status,partial.stderr).toBe(0);
  expect(()=>admitShard(JSON.parse(readFileSync(join(root,'actual.json'),'utf8')),names,path,partial.status,partial.signal)).toThrow();
},70000);

it('adversarial: missing artifacts and shortened declared inventories fail closed',()=>{
  const root=join(temp,'derived');mkdirSync(join(root,'cases'),{recursive:true});mkdirSync(join(root,'manifests'));
  writeFileSync(join(root,'manifests/index.json'),JSON.stringify({n_cases:1,n_variants:1,cases:[{case_id:'case_a',variants:1}]}));
  expect(()=>readInventory(root)).toThrow();
  writeFileSync(join(root,'cases/case_a.json'),JSON.stringify({case_id:'case_a',variants:[{id:'one'}]}));
  expect(()=>readInventory(root)).toThrow();
  writeFileSync(join(root,'cases/case_a.json'),JSON.stringify({case_id:'case_a',variants:[{id:'one',methods:{optimization:{}}}]}));
  expect(readInventory(root)).toEqual(['case_a/one']);
  writeFileSync(join(root,'cases/unexpected.json'),'{}');expect(()=>readInventory(root)).toThrow();
});

it('adversarial: changed source bytes and added or missing input files invalidate admission',()=>{
  const root=join(temp,'inputs');mkdirSync(root);const path=join(root,'model');writeFileSync(path,'frozen');
  const before=snapshot({input:root});expect(()=>assertStable(before,snapshot({input:root}))).not.toThrow();
  writeFileSync(path,'changed');expect(()=>assertStable(before,snapshot({input:root}))).toThrow(/drift/);
  writeFileSync(path,'frozen');writeFileSync(join(root,'new'),'extra');expect(()=>assertStable(before,snapshot({input:root}))).toThrow(/drift/);
  rmSync(join(root,'new'));rmSync(path);expect(()=>assertStable(before,snapshot({input:root}))).toThrow(/drift/);
});

it('adversarial: invalid worker/output arguments fail and a real dry run never creates parity success',()=>{
  for(const args of [[],['--workers','0'],['--workers','9'],['--out','relative'],['--out',repo],['--unknown'],['--out',temp,'--workers','2','--workers','3']]) expect(()=>parseArgs(args,repo)).toThrow();
  const output=join(temp,'plan');
  const result=spawnSync(process.execPath,[join(repo,'frontend/scripts/optimizer-parity.mjs'),'--plan','--workers','8','--out',output],{encoding:'utf8',timeout:30000,windowsHide:true});
  expect(result.status,result.stderr).toBe(0);
  const plan=JSON.parse(readFileSync(join(output,'plan.json'),'utf8'));
  expect(plan.mode).toBe('PLAN_ONLY');expect(plan.expected).toHaveLength(96);expect(plan.shards).toHaveLength(8);
  expect(existsSync(join(output,'result.json'))).toBe(false);expect(existsSync(join(output,'worker-1.json'))).toBe(false);
  const again=spawnSync(process.execPath,[join(repo,'frontend/scripts/optimizer-parity.mjs'),'--plan','--out',output],{encoding:'utf8',timeout:30000,windowsHide:true});
  expect(again.status).not.toBe(0);
},40000);
