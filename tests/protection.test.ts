import {describe,it,expect} from 'vitest';
import {emptyInventory,order,position} from '../packages/perpl/inventory';
import {stopCoverage,protection,workflow} from '../packages/execution/workflow';
import {p,o} from './fixtures';
const pos=position(p);
const status=(orders:ReturnType<typeof order>[])=>workflow({...emptyInventory('test'),continuous:true,positionsReady:true,ordersReady:true,positions:[pos],orders},[],'42');
describe('actual linked stop quantity and lifecycle',()=>{
  it('shows partial coverage and recovery for a stop of 1 lot against 100',()=>{const stop=order({...o,os:1});expect(stopCoverage(pos,[stop])).toMatchObject({status:'partial',covered:1n});expect(protection(pos,[stop])).toBeNull();expect(status([stop])).toBe('partial-protection');});
  it('counts remaining size rather than original order size',()=>{const stop=order({...o,os:100,fs:40});expect(stopCoverage(pos,[stop])).toMatchObject({status:'partial',covered:60n});});
  it('only marks one verified, waiting, sufficient-size stop as active',()=>{for(const os of [100,200]){const stop=order({...o,os});expect(stopCoverage(pos,[stop])).toMatchObject({status:'full',covered:100n});expect(status([stop])).toBe('active');}});
  it('does not claim coverage while trigger execution is pending',()=>{const stop=order({...o,st:9});expect(stopCoverage(pos,[stop]).status).toBe('triggered');expect(status([stop])).toBe('protection-pending');expect(protection(pos,[stop])).toBeNull();});
  it('never adds separate stops together as full protection',()=>{const stops=[order({...o,os:50}),order({...o,oid:3,os:50})];expect(stopCoverage(pos,stops).status).toBe('multiple');expect(status(stops)).toBe('recovery');});
  it('fails closed for wrong binding, removal, condition or malformed size',()=>{
    for(const change of [{acc:43},{mkt:17},{lp:2},{r:true}])expect(stopCoverage(pos,[order({...o,...change})]).status).toBe('none');
    for(const change of [{tpc:2},{fs:101},{fs:undefined}])expect(stopCoverage(pos,[order({...o,...change})]).status).toBe('unknown');
  });
});
