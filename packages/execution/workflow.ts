import type { Inventory, Order, Position } from '../perpl/inventory';
import type { JournalRow } from './coordinator';
export type Workflow='flat'|'entry-pending'|'protection-pending'|'active'|'closing'|'remaining'|'unknown'|'recovery';
export function protection(position:Position,orders:Order[]):Order|null {
  return orders.find(o=>o.account===position.account&&o.market===position.market&&o.linkedPosition===position.id&&o.type===(position.side==='long'?3:4)&&o.triggerPrice!==null&&o.triggerPrice>0n&&o.triggerCondition===(position.side==='long'?4:3)&&[8,9].includes(o.status))??null;
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
  return protection(p,inventory.orders)?'active':'recovery';
}
