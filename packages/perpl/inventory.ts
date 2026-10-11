import { bool, list, record, safeNumber, text, u64 } from './codec';
import { integer } from '../domain/units';
import type { MarketConfig } from './config';

export interface Account { id: bigint; instance: bigint; balance: bigint; locked: bigint; lfr: bigint; frozen: boolean; forwarding: boolean; feeTier: number }
export interface Position { id: bigint; account: bigint; market: bigint; side: 'long'|'short'; size: bigint; entry: bigint; entryResidue: number; collateral: bigint; fees: bigint; status: number; request: bigint; raw: Record<string,unknown> }
export interface Order { id: bigint; request: bigint; account: bigint; market: bigint; status: number; reason: number; type: number; size: bigint; triggerPrice: bigint | null; triggerCondition: number | null; linkedPosition: bigint | null; raw: Record<string,unknown> }
export interface Inventory { epoch: string; wallet: string | null; accounts: Account[]; positions: Position[]; orders: Order[]; walletReady: boolean; positionsReady: boolean; ordersReady: boolean; lastSequence: bigint | null; receivedAt: number; head: bigint; continuous: boolean }
export const emptyInventory = (epoch: string): Inventory => ({epoch,wallet:null,accounts:[],positions:[],orders:[],walletReady:false,positionsReady:false,ordersReady:false,lastSequence:null,receivedAt:0,head:0n,continuous:false});
export function account(value: unknown): Account { const a = record(value); return {id:u64(a.id),instance:u64(a.in),balance:integer(a.b),locked:u64(a.lb),lfr:u64(a.lfr),frozen:bool(a.fr),forwarding:bool(a.fw),feeTier:safeNumber(a.ft)}; }
export function position(value: unknown): Position { const p = record(value); const sd = safeNumber(p.sd); if (sd!==1&&sd!==2) throw new Error('POSITION_SIDE_INVALID'); return {id:u64(p.pid),account:u64(p.acc),market:u64(p.mkt),side:sd===1?'long':'short',size:u64(p.s),entry:u64(p.ep),entryResidue:p.epr===undefined?0:safeNumber(p.epr),collateral:integer(p.c),fees:integer(p.fee),status:safeNumber(p.st),request:u64(p.rq),raw:p}; }
export function order(value: unknown): Order { const o=record(value); return {id:u64(o.oid),request:u64(o.rq),account:u64(o.acc),market:u64(o.mkt),status:safeNumber(o.st),reason:safeNumber(o.sr),type:safeNumber(o.t),size:u64(o.os),triggerPrice:o.tp===undefined?null:u64(o.tp),triggerCondition:o.tpc===undefined?null:safeNumber(o.tpc),linkedPosition:o.lp===undefined?null:u64(o.lp),raw:o}; }
const replace = <T>(values:T[], incoming:T, key:(v:T)=>string):T[] => [...values.filter(v=>key(v)!==key(incoming)),incoming];
export function applyInventory(state: Inventory, payload: unknown, now: number): Inventory {
  const m=record(payload); const mt=safeNumber(m.mt); let next={...state};
  if (mt===19) { next={...next,wallet:text(m.addr),accounts:list(m.as??[]).map(account),walletReady:true,lastSequence:u64(m.sn),continuous:true}; }
  else if (mt===23) { next.orders=list(m.d).map(order); next.ordersReady=true; }
  else if (mt===26) { next.positions=list(m.d).map(position); next.positionsReady=true; }
  else if (mt===21) { const a=account(m); next.accounts=replace(next.accounts,a,a=>`${a.instance}/${a.id}`); }
  else if (mt===24) { for(const item of list(m.d)){const o=order(item); const values=next.orders.filter(v=>v.id!==o.id||v.account!==o.account||v.market!==o.market); next.orders=o.raw.r!==true&&[1,2,3,8,9].includes(o.status)?[...values,o]:values;} }
  else if (mt===27) { for(const item of list(m.d)){const p=position(item); const values=next.positions.filter(v=>v.id!==p.id||v.account!==p.account||v.market!==p.market); next.positions=p.status===1&&p.size>0n?[...values,p]:values;} }
  else if (mt===100) { const sequence=u64(m.sn); if (next.lastSequence===null||sequence!==next.lastSequence+1n) next.continuous=false; next.lastSequence=sequence; next.head=u64(m.h); }
  // Perpl initializes sequence from WalletSnapshot; only heartbeats advance it.
  if (m.at!==undefined) { const at=record(m.at); if (at.b!==undefined) next.head=u64(at.b)>next.head?u64(at.b):next.head; }
  next.receivedAt=now;
  return next;
}
export function admission(state: Inventory, cfg: MarketConfig, wallet: string, now: number): { account: Account | null; reasons: string[] } {
  const reasons:string[]=[]; const acc=state.accounts.find(a=>a.instance===cfg.instanceId)??null;
  if (!state.continuous||!state.walletReady||!state.ordersReady||!state.positionsReady||now-state.receivedAt>5000) reasons.push('Status akun belum fresh atau koneksi perlu dipulihkan.');
  if (!state.wallet||state.wallet.toLowerCase()!==wallet.toLowerCase()) reasons.push('Wallet API tidak cocok dengan Mera.');
  if (!acc) reasons.push('Akun Perpl belum tersedia.');
  else { if(acc.frozen) reasons.push('Akun dibekukan.'); if(!acc.forwarding) reasons.push('Order forwarding belum aktif.'); if(state.positions.some(p=>p.account===acc.id&&p.size>0n)) reasons.push('Selesaikan posisi aktif sebelum entry baru.'); if(state.orders.some(o=>o.account===acc.id)) reasons.push('Masih ada order aktif.'); if(acc.locked!==0n) reasons.push('Collateral masih terkunci.'); }
  if (!cfg.isOpen) reasons.push('Market sedang tutup.');
  return {account:acc,reasons};
}
