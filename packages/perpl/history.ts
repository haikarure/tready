import { list, record, text } from './codec';
import { order, type Order } from './inventory';
import type { ApiCredential } from './auth';
import type { PerplHttp } from './http';
export async function orderHistory(http:PerplHttp,key:ApiCredential,requests:Set<string>,maxPages=10):Promise<{orders:Order[];complete:boolean;found:Set<string>}> {
  const orders:Order[]=[];const found=new Set<string>();const visited=new Set<string>();let cursor='';
  for(let n=0;n<maxPages;n++){
    const target=`/v1/trading/order-history?count=100${cursor?`&page=${encodeURIComponent(cursor)}`:''}`;
    const page=record(await http.request(target,{key}));
    for(const row of list(page.d)){const o=order(row);orders.push(o);if(requests.has(o.request.toString()))found.add(o.request.toString());}
    cursor=text(page.np);if(!cursor)return {orders,complete:true,found};
    if(visited.has(cursor))throw new Error('HISTORY_CURSOR_LOOP');visited.add(cursor);
  }
  // Unseen history is unknown even when open-orders is empty.
  return {orders,complete:false,found};
}
