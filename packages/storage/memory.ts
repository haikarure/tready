import type { Command, Journal, JournalRow, RequestState } from '../execution/coordinator';

// Used only by synthetic traces/tests. Native production storage is SQLite.
export class MemoryJournal implements Journal {
  values:JournalRow[]=[]; private counters=new Map<string,bigint>();
  async prepare(account:string,last:bigint,kind:JournalRow['kind'],planId:string|null,create:(id:bigint)=>Command):Promise<JournalRow>{
    const local=this.counters.get(account)??0n; const rq=(local>last?local:last)+1n; const command=create(rq);
    const row:JournalRow={id:String(rq),account,kind,command,planId,status:'prepared',createdAt:Date.now(),nonFailureSeen:false,reason:null};
    this.counters.set(account,rq);this.values.push(row);return row;
  }
  async update(id:string,status:RequestState,reason?:string,seen?:boolean):Promise<void>{ const row=this.values.find(r=>r.id===id);if(!row)throw new Error('JOURNAL_MISSING'); row.status=status;if(reason)row.reason=reason;if(seen!==undefined)row.nonFailureSeen=seen; }
  async rows():Promise<JournalRow[]>{return this.values.map(v=>({...v}));}
  async unresolved(account:string):Promise<boolean>{return this.values.some(r=>r.account===account&&['prepared','sent','forwarded','unknown'].includes(r.status));}
}
