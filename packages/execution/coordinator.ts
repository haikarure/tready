import { assertApproval, type Plan, type Approval } from '../domain/plan';
import { u64 } from '../domain/units';
import type { Order, Position } from '../perpl/inventory';
import {NotSentError} from './transport-error';

export interface Command { mt:22; sn:bigint; rq:bigint; mkt:bigint; acc:bigint; t:number; p?:bigint; s:bigint; fl:number; lv:number; lb:bigint; ms?:number; tp?:bigint; tpc?:number; lp?:bigint; oid?:bigint }
export type RequestState='prepared'|'sent'|'forwarded'|'settled'|'failed'|'unknown';
export interface JournalRow { id:string; account:string; kind:'entry'|'stop'|'close'|'cancel'; command:Command; planId:string|null; status:RequestState; createdAt:number; nonFailureSeen:boolean; reason:string|null }
export interface Journal {
  prepare(account:string,lastForwarded:bigint,kind:JournalRow['kind'],planId:string|null,create:(request:bigint)=>Command):Promise<JournalRow>;
  update(id:string,status:RequestState,reason?:string,nonFailureSeen?:boolean):Promise<void>;
  rows():Promise<JournalRow[]>;
  unresolved(account:string):Promise<boolean>;
}
export interface ExecutionContext { sessionId:string; live:boolean; fresh:boolean; accountFlat:boolean; lastForwarded:bigint; head:bigint; configDigest:string; wallet:string; accountId:string }
export class Coordinator {
  private busy=false;
  constructor(private journal:Journal,private send:(command:Command)=>void) {}
  async entry(plan:Plan,approval:Approval,context:ExecutionContext,ttl:bigint,now=Date.now()):Promise<JournalRow> {
    assertApproval(plan,approval,context.sessionId,now);
    if(!context.live||!context.fresh||!context.accountFlat||context.configDigest!==plan.configDigest||context.wallet.toLowerCase()!==plan.binding.wallet.toLowerCase()||context.accountId!==plan.binding.accountId)throw new Error('ENTRY_ADMISSION_FAILED');
    return this.dispatch(context,'entry',plan.id,rq=>({mt:22,sn:rq,rq,mkt:u64(plan.binding.marketId),acc:u64(plan.binding.accountId),t:plan.input.side==='long'?1:2,p:plan.input.entryBound,s:plan.quote.quantity,fl:4,lv:plan.input.leverage,lb:context.head+ttl}));
  }
  async stop(position:Position,stop:bigint,context:ExecutionContext,now=Date.now()):Promise<JournalRow> {
    if(stop<=0n||position.size<=0n||(position.side==='long'?stop>=position.entry:stop<=position.entry))throw new Error('STOP_INVALID');
    return this.dispatch(context,'stop',null,rq=>({mt:22,sn:rq,rq,mkt:position.market,acc:position.account,t:position.side==='long'?3:4,p:0n,s:position.size,fl:4,lv:0,lb:0n,tp:stop,tpc:position.side==='long'?4:3,lp:position.id}),now);
  }
  async close(position:Position,slippageBps:number,context:ExecutionContext,ttl:bigint,now=Date.now()):Promise<JournalRow> {
    if(position.size<=0n||!Number.isInteger(slippageBps)||slippageBps<=0||slippageBps>65535)throw new Error('CLOSE_INVALID');
    return this.dispatch(context,'close',null,rq=>({mt:22,sn:rq,rq,mkt:position.market,acc:position.account,t:position.side==='long'?3:4,p:0n,s:position.size,fl:4,lv:0,lb:context.head+ttl,ms:slippageBps}),now);
  }
  async cancel(order:Order,context:ExecutionContext,ttl:bigint):Promise<JournalRow> {
    return this.dispatch(context,'cancel',null,rq=>({mt:22,sn:rq,rq,mkt:order.market,acc:order.account,t:5,oid:order.id,s:0n,fl:0,lv:0,lb:context.head+ttl}));
  }
  private async dispatch(context:ExecutionContext,kind:JournalRow['kind'],planId:string|null,create:(rq:bigint)=>Command,_now=Date.now()):Promise<JournalRow> {
    if(this.busy||!context.live||!context.fresh||context.head<=0n)throw new Error('OPERATION_BUSY_OR_UNKNOWN');
    this.busy=true;
    try {
      if(await this.journal.unresolved(context.accountId))throw new Error('OPERATION_BUSY_OR_UNKNOWN');
      const row=await this.journal.prepare(context.accountId,context.lastForwarded,kind,planId,create);
      if(row.command.acc.toString()!==context.accountId)throw new Error('COMMAND_ACCOUNT_MISMATCH');
      try { this.send(row.command); await this.journal.update(row.id,'sent'); }
      catch(error) { await this.journal.update(row.id,error instanceof NotSentError?'failed':'unknown',error instanceof NotSentError?'Command belum dikirim. Periksa sesi dan review sebelum mencoba lagi.':'Outcome belum dikonfirmasi. Periksa journal dan venue.'); throw error; }
      // An outcome can commit while the transport write is completing.
      return (await this.journal.rows()).find(r=>r.id===row.id&&r.account===row.account)??row;
    } finally {this.busy=false;}
  }
}
export function requestOutcome(row:JournalRow,update:Order):{status:RequestState;nonFailureSeen:boolean}|null {
  if(update.request.toString()!==row.id||update.account.toString()!==row.account)return null;
  if(row.nonFailureSeen)return null;
  if(update.status===7)return row.status==='failed'?null:{status:'failed',nonFailureSeen:false};
  if([2,3,4,5,8,9,10].includes(update.status))return {status:'settled',nonFailureSeen:true};
  return null;
}
