import {describe,it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {journalUpdate,recoverJournalSql} from '../packages/storage/transitions';
import {Coordinator} from '../packages/execution/coordinator';
import {MemoryJournal} from '../packages/storage/memory';
import {approve} from '../packages/domain/plan';
import {makePlan} from './fixtures';

function database(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE requests(id TEXT PRIMARY KEY,status TEXT,reason TEXT,seen INTEGER); INSERT INTO requests VALUES(\'1\',\'prepared\',NULL,0)');return db;}
function update(db:DatabaseSync,status:Parameters<typeof journalUpdate>[1],seen?:boolean){const query=journalUpdate('1',status,status,seen);return db.prepare(query.sql).run(...query.params);}
function row(db:DatabaseSync){return db.prepare('SELECT * FROM requests WHERE id=?').get('1');}
describe('atomic durable journal transitions on SQLite',()=>{
  it('never overwrites confirmed outcome with sent, ack, disconnect or failure',()=>{const db=database();try{update(db,'settled',true);for(const status of ['sent','forwarded','unknown','failed'] as const)expect(update(db,status).changes).toBe(0);expect(row(db)).toMatchObject({status:'settled',seen:1,reason:'settled'});}finally{db.close();}});
  it('preserves forward ack against a later local sent update',()=>{const db=database();try{update(db,'forwarded');expect(update(db,'sent').changes).toBe(0);expect(row(db)?.status).toBe('forwarded');}finally{db.close();}});
  it('does not replace a failure with transport success but accepts late venue success',()=>{const db=database();try{update(db,'failed');update(db,'sent');update(db,'forwarded');expect(row(db)?.status).toBe('failed');update(db,'settled',true);expect(row(db)).toMatchObject({status:'settled',seen:1});}finally{db.close();}});
  it('retains unknown until venue outcome, instead of a transport-only ack',()=>{const db=database();try{update(db,'unknown');update(db,'sent');update(db,'forwarded');expect(row(db)?.status).toBe('unknown');update(db,'settled');expect(row(db)?.status).toBe('settled');}finally{db.close();}});
  it('repairs legacy seen/status inconsistency and never resends inflight after restart',()=>{const db=database();try{db.exec("UPDATE requests SET status='sent',seen=1; INSERT INTO requests VALUES('2','forwarded',NULL,0)");db.exec(recoverJournalSql);expect(row(db)).toMatchObject({status:'settled',seen:1});expect(db.prepare("SELECT status FROM requests WHERE id='2'").get()?.status).toBe('unknown');}finally{db.close();}});
  it('rejects contradictory outcome flags',()=>{expect(()=>journalUpdate('1','sent',undefined,true)).toThrow('OUTCOME');expect(()=>journalUpdate('1','settled',undefined,false)).toThrow('OUTCOME');});
});
describe('coordinator completion ordering',()=>{
  it('returns the committed outcome and leaves no pending request after fast success',async()=>{
    const journal=new MemoryJournal();const original=journal.update.bind(journal);
    journal.update=async(id,status,reason,seen)=>{if(status==='sent')await original(id,'settled','fast venue success',true);await original(id,status,reason,seen);};
    const p=makePlan();const ctx={sessionId:'s',live:true,fresh:true,accountFlat:true,lastForwarded:7n,head:100n,configDigest:'config',wallet:p.binding.wallet,accountId:p.binding.accountId};
    const result=await new Coordinator(journal,()=>{}).entry(p,approve(p,'s',1000),ctx,20n,2000);
    expect(result.status).toBe('settled');expect(await journal.unresolved(ctx.accountId)).toBe(false);
  });
  it('keeps database request IDs unique across accounts',async()=>{const journal=new MemoryJournal();const create=(account:string)=>(rq:bigint)=>({mt:22 as const,sn:rq,rq,mkt:16n,acc:BigInt(account),t:1,s:1n,fl:4,lv:100,lb:1n});const a=await journal.prepare('42',0n,'entry',null,create('42'));const b=await journal.prepare('43',0n,'entry',null,create('43'));expect(a.id).not.toBe(b.id);});
});
