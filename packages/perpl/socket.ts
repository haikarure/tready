import { decode, encode, record, safeNumber } from './codec';
import { assertCredential, signIn, type ApiCredential } from './auth';
import { TESTNET } from './config';

export interface SocketLike { readyState:number; send(data:string):void; close():void; onopen:((event:unknown)=>void)|null; onmessage:((event:{data:unknown})=>void)|null; onerror:((event:unknown)=>void)|null; onclose:((event:unknown)=>void)|null }
export class TradingSocket {
  private socket:SocketLike|null=null; private ping:ReturnType<typeof setInterval>|null=null; private generation=0;
  constructor(private factory:(url:string)=>SocketLike, private onMessage:(data:unknown)=>void, private onDisconnect:()=>void) {}
  async connect(key:ApiCredential):Promise<void> {
    this.close(); const gen=++this.generation; const frame=await signIn(key);
    if(gen!==this.generation) return;
    const socket=this.factory(`${TESTNET.ws}/ws/v1/trading`); this.socket=socket;
    socket.onopen=()=>{ if(gen!==this.generation)return; socket.send(encode(frame)); this.ping=setInterval(()=>{if(socket.readyState===1)socket.send(encode({mt:1,t:Date.now()}));},30_000); };
    socket.onmessage=e=>{ if(gen!==this.generation)return; try { const data=decode(String(e.data)); if(safeNumber(record(data).mt)!==2)this.onMessage(data); } catch { this.close(); this.onDisconnect(); } };
    const end=()=>{if(gen===this.generation){this.close();this.onDisconnect();}};
    socket.onerror=end; socket.onclose=end;
  }
  send(command:unknown,key:ApiCredential):void { assertCredential(key,Date.now(),true); if(this.socket?.readyState!==1)throw new Error('SOCKET_NOT_CONNECTED'); this.socket.send(encode(command)); }
  close():void { this.generation++; if(this.ping)clearInterval(this.ping); this.ping=null; const s=this.socket; this.socket=null; if(s){s.onclose=null;s.onerror=null;s.onmessage=null;s.close();} }
}
