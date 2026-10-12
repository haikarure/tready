import {describe,it,expect,vi} from 'vitest';
import {TradingSocket,type SocketLike} from '../packages/perpl/socket';
import {NotSentError} from '../packages/execution/transport-error';
const key={token:'synthetic-token',secret:new Uint8Array(32).fill(7),wallet:'0x'+'11'.repeat(20),scope:3,expiresAt:0};
describe('transport failure certainty',()=>{
  it('labels readiness/permission checks before emission and never calls send',async()=>{const send=vi.fn();const native:SocketLike={readyState:1,send,close:()=>{},onopen:null,onmessage:null,onerror:null,onclose:null};const socket=new TradingSocket(()=>native,()=>{},()=>{});await socket.connect(key);expect(()=>socket.send({mt:22},{...key,scope:1})).toThrow(NotSentError);expect(send).not.toHaveBeenCalled();socket.close();expect(()=>socket.send({mt:22},key)).toThrow(NotSentError);});
  it('preserves ambiguity once the underlying send is called',async()=>{const native:SocketLike={readyState:1,send:()=>{throw new Error('transport outcome unknown');},close:()=>{},onopen:null,onmessage:null,onerror:null,onclose:null};const socket=new TradingSocket(()=>native,()=>{},()=>{});await socket.connect(key);try{socket.send({mt:22},key);expect.fail();}catch(e){expect(e).not.toBeInstanceOf(NotSentError);expect((e as Error).message).toBe('transport outcome unknown');}finally{socket.close();}});
});
