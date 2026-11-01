import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {close, compareScreen, marginClose} from './optimizer-parity-comparison';
import type {ScreenRecord} from '../engine/optimization-record';

const record = (): ScreenRecord => ({iterations:5,screened:30,rejected:{guard:2,interval:10},proposed:1,improved:0,
  proposals:[[4,84.22645759858217,85.08200976605274,0.999379591139013,1.009531049477672,1.1102230246251565e-16,false]]});
const problems = (change:(r:ScreenRecord)=>void) => { const a=record();change(a);const errors:string[]=[];compareScreen('start 0',a,record(),errors);return errors; };

it('adversarial: diagnostic zero allowance matches the actual zinc margin only at operand scale', () => {
  const artifact=JSON.parse(readFileSync(new URL('../../../data/derived/cases/zinc_sulfide.json',import.meta.url),'utf8'));
  const row=artifact.variants.find((v:{id:string})=>v.id==='harder_ore').methods.optimization.starts[0].screen.proposals[4];
  expect(row).toEqual(record().proposals[0]);
  expect(close(0,row[5])).toBe(false);
  expect(marginClose(0,row[5],row[3],row[3])).toBe(true);
  expect(problems(r=>{r.proposals[0][5]=0;})).toEqual([]);
  // No unit-scale absolute floor: these objective operands are tiny as well.
  expect(marginClose(0,1e-16,1e-9,1e-9)).toBe(false);
});
it('adversarial: wrong small and significant nonzero margins and nulls fail', () => {
  for (const value of [1e-14,1e-9,1e-6,null,NaN,Infinity]) expect(problems(r=>{r.proposals[0][5]=value;})).not.toEqual([]);
  expect(marginClose(1e-9,2e-9,1,1)).toBe(false);
  expect(marginClose(1e-9,1e-9*(1+5e-7),1,1)).toBe(true);
  expect(marginClose(null,0,1,1)).toBe(false);
  expect(marginClose(null,null,1,1)).toBe(true);
});
it('adversarial: physical proposal values retain relative tolerance and exact fields remain exact', () => {
  for (const column of [1,2,3,4] as const) expect(problems(r=>{r.proposals[0][column]!+=1e-3;})).not.toEqual([]);
  expect(close(0,1e-16)).toBe(false);
  expect(close(null,0)).toBe(false);
  expect(problems(r=>{r.proposals[0][0]++;})).not.toEqual([]);
  expect(problems(r=>{r.proposals[0][6]=true;})).not.toEqual([]);
  for (const key of ['iterations','screened','proposed','improved'] as const) expect(problems(r=>{r[key]++;})).not.toEqual([]);
  for (const key of ['guard','interval'] as const) expect(problems(r=>{r.rejected[key]++;})).not.toEqual([]);
  expect(problems(r=>{r.proposals.push([...r.proposals[0]]);})).not.toEqual([]);
  expect(problems(r=>{r.proposals=[];})).not.toEqual([]);
});
