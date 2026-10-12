import { integer, formatUnits } from './units';
import { record, text } from '../perpl/codec';
export interface Fact {label:string;value:string}
const amount=(value:unknown)=>value===undefined||value===null?'Belum tersedia':`${formatUnits(integer(value),6)} AUSD`;
export function positionFacts(value:unknown,priceDecimals:number,sizeDecimals:number,plannedQuantity:bigint|null):Fact[]{
  const p=record(value);return [
    {label:'Account / position',value:`${integer(p.acc)} / ${integer(p.pid)}`},
    {label:'Quantity rencana',value:plannedQuantity===null?'Rencana tidak tersedia':`${formatUnits(plannedQuantity,sizeDecimals)} BTC`},
    {label:'Quantity tersisa aktual',value:`${formatUnits(integer(p.s),sizeDecimals)} BTC`},
    {label:'Entry venue (rounded)',value:formatUnits(integer(p.ep),priceDecimals)},
    {label:'Fee entry yang dialokasikan',value:amount(p.fee)},
  ];
}
export function settlementFacts(value:unknown,priceDecimals:number,sizeDecimals:number):Fact[]{
  const e=record(value);return [
    {label:'Quantity event',value:`${formatUnits(integer(e.s),sizeDecimals)} BTC`},
    {label:'Exit venue',value:e.xp===undefined?'Belum tersedia':formatUnits(integer(e.xp),priceDecimals)},
    {label:'Biaya event (termasuk close)',value:amount(e.fee)},
    {label:'Bagian biaya close',value:amount(e.cfee)},
    {label:'Funding event',value:amount(e.fnd)},
    {label:'Delta PnL venue',value:amount(e.dpnl)},
    {label:'PnL net trade lengkap',value:'Belum direkonsiliasi'},
  ];
}
export function netAccountFacts(value:unknown):Fact[]{const a=record(value);return [{label:'Account ID',value:String(integer(a.id))},{label:'PnL realized akun, net',value:amount(a.trp)},{label:'Total biaya akun',value:amount(a.tf)},{label:'Cakupan',value:'Lifetime akun, bukan satu trade'}];}
export function actualTxHash(value:unknown):string|undefined{const at=record(value);const hash=at.txid;if(hash===undefined)return undefined;const s=text(hash).replace(/^0x/i,'');return /^[0-9a-fA-F]{64}$/.test(s)&&!/^0{64}$/.test(s)?`0x${s.toLowerCase()}`:undefined;}
export function settlementEventId(value:unknown):string{
  const e=record(value);const at=record(e.at);
  // A closed/opened inversion can share a tx/log: include entity/reason identity.
  if(at.b===undefined||at.l===undefined||(at.txid===undefined&&at.tx===undefined))throw new Error('EVENT_IDENTITY_INCOMPLETE');
  return [10143,integer(at.b),at.txid??integer(at.tx),integer(at.l),integer(e.acc),integer(e.mkt),integer(e.pid),integer(e.sr),integer(e.sd)].join('/');
}
