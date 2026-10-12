import type { Inventory, Order, Position } from '../perpl/inventory';
import type { JournalRow } from './coordinator';
import { u64 } from '../perpl/codec';
export type Workflow='flat'|'entry-pending'|'protection-pending'|'partial-protection'|'active'|'closing'|'remaining'|'unknown'|'recovery';
export interface StopCoverage { status:'none'|'full'|'partial'|'triggered'|'unknown'|'multiple'; orders:Order[]; order:Order|null; covered:bigint|null }
export function linkedStops(position:Position,orders:Order[]):Order[] {
  return orders.filter(o=>o.account===position.account&&o.market===position.market&&o.linkedPosition===position.id&&o.type===(position.side==='long'?3:4)&&o.triggerPrice!==null&&o.triggerPrice>0n&&[8,9].includes(o.status)&&o.raw.r!==true);
}
export function stopCoverage(position:Position,orders:Order[]):StopCoverage {
  const linked=linkedStops(position,orders);
  const result={orders:linked,order:linked.length===1?linked[0]!:null,covered:null};
  if(!linked.length)return {...result,status:'none'};
  if(linked.length!==1)return {...result,status:'multiple'};
  const o=linked[0]!;
  if(o.status===9)return {...result,status:'triggered'};
  if(o.triggerCondition!==(position.side==='long'?4:3)||o.raw.fs===undefined)return {...result,status:'unknown'};
  try {
    const filled=u64(o.raw.fs);
    if(filled>o.size||position.size<=0n)return {...result,status:'unknown'};
    const remaining=o.size-filled;const covered=remaining<position.size?remaining:position.size;
    return {...result,status:covered>=position.size?'full':'partial',covered};
  }catch{return {...result,status:'unknown'};}
}
export function protection(position:Position,orders:Order[]):Order|null {
  const coverage=stopCoverage(position,orders);return coverage.status==='full'?coverage.order:null;
}
export function workflow(inventory:Inventory,journal:JournalRow[],account:string):Workflow {
  const operations=journal.filter(r=>r.account===account);
  if(operations.some(r=>r.status==='unknown'||r.status==='prepared'))return 'unknown';
  const pending=operations.find(r=>r.status==='sent'||r.status==='forwarded');
  if(pending)return pending.kind==='close'?'closing':pending.kind==='entry'?'entry-pending':'protection-pending';
  if(!inventory.continuous||!inventory.positionsReady||!inventory.ordersReady)return 'unknown';
  const positions=inventory.positions.filter(p=>p.account.toString()===account&&p.size>0n);
  if(positions.length===0)return inventory.orders.some(o=>o.account.toString()===account)?'recovery':'flat';
  if(positions.length!==1)return 'recovery';
  const p=positions[0]!;
  const latestClose=operations.filter(r=>r.kind==='close').sort((a,b)=>b.createdAt-a.createdAt)[0];
  const timestamp=(p.raw.ots as {t?:unknown}|undefined)?.t;
  const openedAt=timestamp===undefined?null:Number(timestamp);
  if(latestClose&&latestClose.status==='settled'&&openedAt!==null&&Number.isSafeInteger(openedAt)&&latestClose.createdAt>=openedAt)return 'remaining';
  const coverage=stopCoverage(p,inventory.orders);
  return coverage.status==='full'?'active':coverage.status==='partial'?'partial-protection':coverage.status==='triggered'?'protection-pending':'recovery';
}
