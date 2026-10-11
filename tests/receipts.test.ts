import {describe,expect,it} from 'vitest';
import {netAccountFacts,settlementFacts,settlementEventId,actualTxHash} from '../packages/domain/receipts';
describe('financial provenance',()=>{
  it('uses vendor net stats without subtracting fees again',()=>{const facts=netAccountFacts({id:42,trp:'10000000',tf:'2000000'});expect(facts.find(f=>f.label==='PnL realized akun, net')?.value).toBe('10 AUSD');});
  it('preserves missing funding and distinguishes fee from its close component',()=>{const facts=settlementFacts({s:100,xp:820000,fee:'300000',cfee:'100000',dpnl:'1000000'},1,5);expect(facts.find(f=>f.label==='Funding event')?.value).toBe('Belum tersedia');expect(facts.find(f=>f.label==='Biaya event (termasuk close)')?.value).toBe('0.3 AUSD');});
  it('does not collapse inversion events sharing one log',()=>{const e={at:{b:100,tx:1,l:2},acc:42,mkt:16,pid:10,sr:2,sd:1};expect(settlementEventId(e)).not.toBe(settlementEventId({...e,pid:11,sr:1,sd:2}));expect(()=>settlementEventId({...e,at:{b:100}})).toThrow('INCOMPLETE');expect(actualTxHash({})).toBeUndefined();});
});
