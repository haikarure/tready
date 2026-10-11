import { list, record, u64 } from './codec';
import { ceilDiv } from '../domain/units';
export interface Book { block: bigint; timestamp: number; receivedAt: number; bids: Level[]; asks: Level[] }
export interface Level { price: bigint; size: bigint }
export function decodeBook(payload: unknown, receivedAt: number): Book {
  const root = record(payload); const at = record(root.at);
  const levels = (input: unknown) => list(input).map(value => { const l = record(value); return { price: u64(l.p), size: u64(l.s) }; }).filter(l => l.price > 0n && l.size > 0n);
  const bids = levels(root.bid).sort((a,b) => a.price > b.price ? -1 : 1);
  const asks = levels(root.ask).sort((a,b) => a.price < b.price ? -1 : 1);
  return { block: u64(at.b), timestamp: Number(u64(at.t)), receivedAt, bids, asks };
}
export function depthEstimate(levels: Level[], quantity: bigint): { price: bigint | null; filled: bigint; complete: boolean } {
  let remaining = quantity; let cost = 0n;
  for (const l of levels) { const take = l.size < remaining ? l.size : remaining; cost += take * l.price; remaining -= take; if (remaining === 0n) break; }
  return { price: remaining > 0n || quantity <= 0n ? null : ceilDiv(cost, quantity), filled: quantity - remaining, complete: remaining === 0n && quantity > 0n };
}
