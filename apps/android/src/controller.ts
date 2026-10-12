import Constants from 'expo-constants';
import { AppState } from 'react-native';
import { type Address } from 'viem';
import { bytesToHex } from '@noble/hashes/utils.js';
import { calculateRisk, type RiskInput, type RiskQuote, type Side } from '../../../packages/domain/risk';
import { approve, digest, type Plan } from '../../../packages/domain/plan';
import { parseUnits, ceilDiv, integer } from '../../../packages/domain/units';
import { positionFacts,settlementFacts,netAccountFacts,settlementEventId,actualTxHash,type Fact } from '../../../packages/domain/receipts';
import { resolveConfig, TESTNET, type MarketConfig } from '../../../packages/perpl/config';
import { decodeBook, type Book } from '../../../packages/perpl/book';
import { PerplHttp } from '../../../packages/perpl/http';
import { type ApiCredential, assertCredential } from '../../../packages/perpl/auth';
import { TradingSocket, type SocketLike } from '../../../packages/perpl/socket';
import { applyInventory, emptyInventory, admission, order, type Inventory, type Position, type Order } from '../../../packages/perpl/inventory';
import { record, list, safeNumber, u64 } from '../../../packages/perpl/codec';
import { enroll, hasEnrollmentPolicy, type EnrollmentPolicy } from '../../../packages/perpl/enrollment';
import { importVenueKey } from '../../../packages/perpl/import';
import { orderHistory } from '../../../packages/perpl/history';
import { Coordinator, requestOutcome, type JournalRow, type ExecutionContext } from '../../../packages/execution/coordinator';
import {NotSentError} from '../../../packages/execution/transport-error';
import { workflow, linkedStops } from '../../../packages/execution/workflow';
import { NativeStore, loadKey, saveKey } from './storage';
import { WalletManager, type Identity } from './wallet';
import { balances, verifyChain, OwnerTransactions, type Balances, type OwnerAction } from './chain';

export interface Form { side:Side;budget:string;stop:string;leverage:string;entryBps:string;stressBps:string;funding:string }
export interface Receipt { id:string;mode:'testnet'|'replay';title:string;createdAt:number;details:string;txHash?:string;facts?:Fact[] }
export interface View { ready:boolean;busy:boolean;error:string|null;marketError:string|null;mode:'testnet'|'replay';config:MarketConfig|null;book:Book|null;rpcVerified:boolean;identity:Identity|null;unlocked:boolean;apiReady:boolean;balances:Balances|null;inventory:Inventory;journal:JournalRow[];receipts:Receipt[];replayPosition:{side:Side;size:bigint;entry:bigint;stop:bigint;protected:boolean}|null;replayStatus:string }
const id=()=>bytesToHex(crypto.getRandomValues(new Uint8Array(12)));
export function userError(error:unknown):string {
  if(error instanceof Error){
    const known=/^(API_|NETWORK_|DEPLOYMENT_|CONFIG_|ENROLLMENT_|WALLET_|PASSKEY_|HISTORY_|PLAN_|ENTRY_|OPERATION_|COMMAND_|SOCKET_|PRF_|INTEGER_|UINT|WIRE_|AMOUNT_|WITHDRAW_)/;
    if(known.test(error.message))return error.message.split(/[ :\n]/,1)[0]!.replaceAll('_',' ').slice(0,160);
    if(error.message.length<180&&!/(private|secret|0x[0-9a-f]{64}|signature|token)/i.test(error.message))return error.message;
  }
  return 'Langkah belum selesai. Periksa koneksi, sesi, dan status transaksi sebelum mencoba lagi.';
}
export class TreadyController {
  state:View={ready:false,busy:false,error:null,marketError:null,mode:'testnet',config:null,book:null,rpcVerified:false,identity:null,unlocked:false,apiReady:false,balances:null,inventory:emptyInventory(id()),journal:[],receipts:[],replayPosition:null,replayStatus:'flat'};
  private listeners=new Set<()=>void>();private store!:NativeStore;private wallet!:WalletManager;private owner!:OwnerTransactions;private coordinator!:Coordinator;
  private key:ApiCredential|null=null;private http=new PerplHttp();private socket:TradingSocket;
  private poll:ReturnType<typeof setInterval>|null=null;private publicBusy=false;private rpcBusy=false;private configAt=0;private destroyed=false;private eventQueue:Promise<void>=Promise.resolve();private floor=0n;private syncing=false;
  private readonly extra=(Constants.expoConfig?.extra??{}) as {rpId?:string;origin?:string;enrollmentPolicy?:EnrollmentPolicy|null};
  constructor(){this.socket=new TradingSocket(url=>new WebSocket(url) as unknown as SocketLike,data=>{const epoch=this.state.inventory.epoch;this.eventQueue=this.eventQueue.then(()=>epoch===this.state.inventory.epoch&&this.key&&this.wallet?.unlocked?this.message(data):undefined).catch(error=>{this.patch({error:userError(error),apiReady:false});this.socket.close();});},()=>this.disconnected());}
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  snapshot=()=>this.state;
  private patch(value:Partial<View>):void{if(this.destroyed)return;this.state={...this.state,...value};for(const l of this.listeners)l();}
  async initialize():Promise<void>{
    try{this.store=await NativeStore.open();this.wallet=new WalletManager(this.store,this.extra.rpId??'',()=>this.locked());await this.wallet.initialize();this.owner=new OwnerTransactions(this.wallet,this.store);this.coordinator=new Coordinator(this.store,command=>{if(!this.key||!this.wallet.unlocked||AppState.currentState!=='active'||this.state.mode!=='testnet')throw new NotSentError('Sesi terkunci sebelum command dikirim.');this.socket.send(command,this.key);});
      const rows=await this.store.receipts();this.patch({ready:true,identity:this.wallet.identity,journal:await this.store.rows(),receipts:rows.map(r=>JSON.parse(r.value) as Receipt)});this.startPublic();
    }catch(error){this.patch({error:userError(error)});}
  }
  private startPublic():void{void this.refreshPublic();if(!this.poll)this.poll=setInterval(()=>void this.refreshPublic(),2500);}
  private async refreshPublic():Promise<void>{
    if(this.publicBusy||this.destroyed)return;this.publicBusy=true;
    try{let cfg=this.state.config;if(!cfg||Date.now()-this.configAt>30_000){cfg=resolveConfig(await this.http.request('/v1/pub/context'));this.configAt=Date.now();this.patch({config:cfg,rpcVerified:false});this.checkRPC(cfg);}
      const book=decodeBook(await this.http.request(`/v1/market-data/${cfg.marketId}/book?levels=100`),Date.now());this.patch({book,marketError:null});
    }catch(error){this.patch({marketError:userError(error)});}finally{this.publicBusy=false;}
  }
  private checkRPC(cfg:MarketConfig):void{if(this.rpcBusy)return;this.rpcBusy=true;void verifyChain(cfg).then(()=>{if(this.state.config?.digest===cfg.digest)this.patch({rpcVerified:true});}).catch(()=>this.patch({rpcVerified:false})).finally(()=>{this.rpcBusy=false;});}
  get passkeyConfigured():boolean{return !!this.extra.rpId;}
  get enrollmentConfigured():boolean{return !!this.extra.origin&&hasEnrollmentPolicy(this.extra.enrollmentPolicy);}
  async task(action:()=>Promise<void>):Promise<boolean>{if(this.state.busy)return false;this.patch({busy:true,error:null});try{await action();return true;}catch(error){this.patch({error:userError(error)});return false;}finally{this.patch({busy:false,unlocked:this.wallet?.unlocked??false});}}
  async unlock(create=false):Promise<void>{await this.task(async()=>{if(this.state.mode!=='testnet')throw new Error('Pilih mode testnet untuk login.');const identity=await this.wallet.unlock(create);this.patch({identity,unlocked:true});await this.refreshBalance();const key=await loadKey(identity.address);if(key){assertCredential(key);if(key.wallet.toLowerCase()!==identity.address.toLowerCase())throw new Error('API_WALLET_MISMATCH');this.key=key;await this.connect();}});}
  lock():void{this.wallet?.lock();}
  private locked():void{this.key?.secret.fill(0);this.key=null;this.socket.close();this.patch({unlocked:false,apiReady:false,inventory:{...this.state.inventory,epoch:id(),continuous:false}});void this.markUnknown();}
  private async markUnknown():Promise<void>{if(!this.store)return;for(const row of await this.store.rows())if(['sent','forwarded','prepared'].includes(row.status))await this.store.update(row.id,'unknown','Sesi/koneksi terputus; cek hasil asli.');this.patch({journal:await this.store.rows()});}
  private disconnected():void{this.patch({apiReady:false,inventory:{...this.state.inventory,continuous:false}});void this.markUnknown();}
  pause():void{if(this.poll)clearInterval(this.poll);this.poll=null;this.lock();}
  resume():void{this.startPublic();}
  destroy():void{this.pause();this.destroyed=true;this.listeners.clear();}
  async refreshBalance():Promise<void>{if(this.state.identity&&this.state.config){await this.owner.reconcile();this.patch({balances:await balances(this.state.identity.address,this.state.config)});}}
  async ownerAction(action:OwnerAction,amount:string):Promise<void>{await this.task(async()=>{const cfg=this.state.config;if(!cfg||!this.state.rpcVerified)throw new Error('NETWORK_NOT_READY');if(action==='withdraw'){const a=admission(this.state.inventory,cfg,this.state.identity?.address??'',Date.now());if(a.reasons.length)throw new Error('Withdraw membutuhkan akun flat dan status terbaru.');}
    const hash=await this.owner.execute(action,cfg,['approve','create','deposit','withdraw'].includes(action)?parseUnits(amount,6):0n);await this.addReceipt({id:id(),mode:'testnet',title:action,createdAt:Date.now(),details:'Transaksi owner confirmed di Monad Testnet.',txHash:hash});await this.refreshBalance();});}
  async enrollKey():Promise<void>{await this.task(async()=>{const wallet=this.wallet.account;const session=this.wallet.sessionId;this.key=await enroll(this.http,this.extra.origin??'',wallet.address,typed=>wallet.signTypedData(typed),this.extra.enrollmentPolicy??null,()=>this.wallet.unlocked&&this.wallet.sessionId===session&&AppState.currentState==='active'&&this.state.mode==='testnet');try{await saveKey(this.key);}catch(error){this.key.secret.fill(0);this.key=null;throw error;}await this.connect();});}
  async importKey(token:string,secret:string):Promise<boolean>{return this.task(async()=>{
    const wallet=this.wallet.account;const session=this.wallet.sessionId;
    const authorized=()=>this.wallet.unlocked&&this.wallet.sessionId===session&&AppState.currentState==='active'&&this.state.mode==='testnet';
    const key=await importVenueKey(this.http,token,secret,wallet.address,authorized);
    try{await saveKey(key);if(!authorized())throw new Error('API_SESSION_LOCKED');}catch(error){key.secret.fill(0);throw error;}
    this.key?.secret.fill(0);this.key=key;await this.connect();
  });}
  private async connect():Promise<void>{if(!this.key||!this.wallet.unlocked)return;this.patch({apiReady:false,inventory:emptyInventory(id())});await this.socket.connect(this.key);}
  async recheck():Promise<void>{await this.task(async()=>{await this.refreshPublic();await this.refreshBalance();if(this.key&&this.wallet.unlocked){await this.connect();await this.reconcileHistory();}});}
  private async message(payload:unknown):Promise<void>{
    const m=record(payload);const mt=safeNumber(m.mt);
    if(mt===3&&m.cid!==undefined){const row=(await this.store.rows()).find(r=>r.command.sn===u64(m.cid));if(row){const status=record(m.status);await this.store.update(row.id,safeNumber(status.code)===0?'forwarded':'failed',safeNumber(status.code)===0?'Forwarded; fill belum dikonfirmasi.':'Gateway menolak sebelum chain execution.');}}
    if(mt===24){for(const value of list(m.d)){const o=order(value);const row=(await this.store.rows()).find(r=>r.id===o.request.toString()&&r.account===o.account.toString());if(row){const result=requestOutcome(row,o);if(result){await this.store.update(row.id,result.status==='failed'?'unknown':result.status,`Venue status ${o.status}, reason ${o.reason}${result.status==='failed'?'; cek outcome asli, jangan replacement.':''}`,result.nonFailureSeen);if(result.status!=='failed')this.floor=u64(record(m.at).b);await this.store.event(digest({kind:'order',...o.raw}),'order',o.raw);}}}}
    if([19,21,23,24,25,26,27,28,100].includes(mt)){
      const next=applyInventory(this.state.inventory,m,Date.now());const account=next.accounts.find(a=>a.instance===this.state.config?.instanceId);
      if(next.wallet&&this.state.identity&&next.wallet.toLowerCase()!==this.state.identity.address.toLowerCase())throw new Error('API_WALLET_MISMATCH');
      const ready=next.continuous&&next.walletReady&&next.ordersReady&&next.positionsReady;
      this.patch({inventory:next,apiReady:ready,journal:await this.store.rows()});
      if(!next.continuous&&mt===100){this.socket.close();this.disconnected();return;}
      if(mt===27&&this.state.config)for(const value of list(m.d)){
        const p=record(value);const cfg=this.state.config;if(u64(p.mkt)!==cfg.marketId)continue;
        await this.store.event(digest({kind:'position-snapshot',value:p}),'position-snapshot',p);
        const row=(await this.store.rows()).find(r=>r.kind==='entry'&&r.id===String(p.rq)&&r.account===String(p.acc));const saved=row?.planId?await this.store.plan(row.planId):null;
        await this.addReceipt({id:`position/${p.acc}/${p.pid}`,mode:'testnet',title:'Posisi aktual Perpl',createdAt:Date.now(),details:`Standing state venue · block ${record(p.at).b??'unknown'}. Fee snapshot adalah entry fee share; tidak dijumlahkan lagi dengan settlement fee.`,facts:positionFacts(p,cfg.priceDecimals,cfg.sizeDecimals,saved?integer(record(record(saved).quote).quantity):null),txHash:actualTxHash(p.at)});
        for(const value of list(p.e??[])){const event=record(value);let eventId:string;try{eventId=settlementEventId(event);}catch{this.patch({error:'Identity settlement belum lengkap; receipt net tetap unknown.'});continue;}
          if(await this.store.event(eventId,'settlement',event))await this.addReceipt({id:`settlement/${eventId}`,mode:'testnet',title:'Settlement event Perpl',createdAt:Date.now(),details:'Fee event sudah mencakup bagian entry dan close. Missing funding/history bukan nol. Net trade belum diklaim tanpa full reconciliation.',facts:settlementFacts(event,cfg.priceDecimals,cfg.sizeDecimals),txHash:actualTxHash(event.at)});
        }
      }
      if(mt===28)await this.addReceipt({id:`account-stats/${m.in}/${m.id}`,mode:'testnet',title:'Statistik akun Perpl',createdAt:Date.now(),details:'Net realized PnL dari AccountStats.trp; biaya tidak dikurangi kedua kali. Cakupan total akun berbeda dari satu trade.',facts:netAccountFacts(m)});
      if(account&&ready&&this.floor>0n&&!this.syncing)await this.synchronizeAfterOutcome();
    }
  }
  private async synchronizeAfterOutcome():Promise<void>{
    if(!this.key)return;this.syncing=true;const originalKey=this.key;this.socket.close();this.patch({apiReady:false,inventory:{...this.state.inventory,epoch:id(),continuous:false}});
    try{
      let next=emptyInventory(this.state.inventory.epoch);const key=this.key;
      const snapshots=await Promise.all(['/v1/trading/wallet','/v1/trading/orders','/v1/trading/positions'].map(target=>this.http.request(target,{key})));
      const minimum=snapshots.map(v=>u64(record(record(v).at).b)).reduce((a,b)=>a<b?a:b);
      if(minimum<this.floor){this.patch({error:'Venue snapshots belum mencapai hasil order. Tekan periksa ulang.'});return;}
      for(const snapshot of snapshots)next=applyInventory(next,snapshot,Date.now());
      // A new WS epoch supplies heartbeat sequence; REST block sn must never seed it.
      next.lastSequence=null;next.continuous=false;this.floor=0n;
      if(this.key!==originalKey||!this.wallet.unlocked)return;
      this.patch({inventory:next,apiReady:false});await this.refreshBalance();await this.connect();
    }finally{this.syncing=false;}
  }
  private async reconcileHistory():Promise<void>{if(!this.key)return;const rows=await this.store.rows();const unresolved=rows.filter(r=>['unknown','prepared','sent','forwarded'].includes(r.status));if(!unresolved.length)return;
    const history=await orderHistory(this.http,this.key,new Set(unresolved.map(r=>r.id)));
    for(const o of [...history.orders].reverse()){const row=(await this.store.rows()).find(r=>r.id===o.request.toString()&&r.account===o.account.toString());if(row){const outcome=requestOutcome(row,o);if(outcome)await this.store.update(row.id,outcome.status==='failed'?'unknown':outcome.status,`History venue status ${o.status}`,outcome.nonFailureSeen);}}
    this.patch({journal:await this.store.rows(),error:history.complete?null:'Riwayat belum lengkap; request yang belum ditemukan tetap unknown.'});
  }
  setMode(mode:View['mode']):void{this.lock();this.patch({mode,error:null});}
  risk(form:Form):{input:RiskInput;quote:RiskQuote}{
    const cfg=this.state.config;const book=this.state.book;if(!cfg||!book)throw new Error('Market belum tersedia.');
    const quoteEntry=(form.side==='long'?book.asks[0]:book.bids[0])?.price;if(!quoteEntry)throw new Error('Order book kosong.');
    if(!/^\d+$/.test(form.entryBps)||!/^\d+$/.test(form.stressBps))throw new Error('Bps harus bilangan bulat.');
    const entryBps=BigInt(form.entryBps);const stressBps=BigInt(form.stressBps);if(entryBps>1000n||stressBps>3000n)throw new Error('Batas skenario terlalu besar.');
    const stop=parseUnits(form.stop,cfg.priceDecimals);const long=form.side==='long';
    const acc=this.state.inventory.accounts.find(a=>a.instance===cfg.instanceId);
    const fee=cfg.takerFees[this.state.mode==='replay'?0:acc?.feeTier??0];if(fee===undefined)throw new Error('API_FEE_TIER_UNKNOWN');
    const input:RiskInput={side:form.side,budget:parseUnits(form.budget,6),quoteEntry,entryBound:long?ceilDiv(quoteEntry*(10000n+entryBps),10000n):quoteEntry*(10000n-entryBps)/10000n,stop,stressExit:long?stop*(10000n-stressBps)/10000n:ceilDiv(stop*(10000n+stressBps),10000n),leverage:Number(parseUnits(form.leverage,2)),maxLeverage:cfg.initialMargin,maintenanceDenominator:cfg.maintenanceMargin,takerFeeMicros:fee,fundingReserve:parseUnits(form.funding,6),operationalReserve:cfg.recycleFee*3n,availableCollateral:this.state.mode==='replay'?100_000_000n:(acc&&this.state.balances?.account?this.state.balances.account.balanceCNS-this.state.balances.account.lockedBalanceCNS:null),priceDecimals:cfg.priceDecimals,sizeDecimals:cfg.sizeDecimals,collateralDecimals:6,minNotional:cfg.minSettle};
    return {input,quote:calculateRisk(input)};
  }
  async makePlan(form:Form):Promise<Plan>{const {input,quote}=this.risk(form);const cfg=this.state.config!;const acc=this.state.inventory.accounts.find(a=>a.instance===cfg.instanceId);const now=Date.now();const plan:Plan={version:1,id:id(),revision:1,binding:{chainId:10143,instanceId:String(cfg.instanceId),exchange:cfg.exchange,collateral:cfg.collateral,marketId:String(cfg.marketId),perpetualId:String(cfg.perpetualId),accountId:acc?.id.toString()??'0',wallet:this.state.identity?.address??'replay'},input,quote,configDigest:cfg.digest,bookBlock:String(this.state.book!.block),receivedAt:now,expiresAt:now+30_000};await this.store.savePlan(plan.id,plan);return plan;}
  private context(flat=false):ExecutionContext{const cfg=this.state.config;if(!cfg||!this.key||!this.wallet.unlocked)throw new Error('API_SESSION_LOCKED');const a=this.state.inventory.accounts.find(x=>x.instance===cfg.instanceId);if(!a)throw new Error('API_ACCOUNT_MISSING');return {sessionId:this.wallet.sessionId,live:this.state.mode==='testnet'&&AppState.currentState==='active'&&this.state.rpcVerified,fresh:this.state.apiReady&&this.state.inventory.continuous&&Date.now()-this.state.inventory.receivedAt<=5000&&!this.syncing&&this.floor===0n,accountFlat:flat,lastForwarded:a.lfr,head:this.state.inventory.head,configDigest:cfg.digest,wallet:this.wallet.account.address,accountId:String(a.id)};}
  async submit(plan:Plan):Promise<boolean>{return this.task(async()=>{
    if(this.state.mode==='replay'){if(!plan.quote.executable||plan.quote.quantity<=0n||Date.now()>plan.expiresAt)throw new Error('PLAN_REVIEW_REQUIRED');if(this.state.replayPosition)throw new Error('Selesaikan posisi latihan sebelumnya.');this.patch({replayPosition:{side:plan.input.side,size:plan.quote.quantity,entry:plan.input.quoteEntry,stop:plan.input.stop,protected:false},replayStatus:'protection-pending'});await this.addReceipt({id:id(),mode:'replay',title:'Entry latihan',createdAt:Date.now(),details:'Synthetic fill; tidak ada order dikirim ke Perpl.'});return;}
    const cfg=this.state.config!;const a=admission(this.state.inventory,cfg,this.state.identity?.address??'',Date.now());if(a.reasons.length)throw new Error(a.reasons.join(' '));
    if(Date.now()-(this.state.book?.receivedAt??0)>3000)throw new Error('Quote basi. Periksa market lalu review lagi.');
    const latest=(plan.input.side==='long'?this.state.book!.asks[0]:this.state.book!.bids[0])?.price;
    if(!latest||(plan.input.side==='long'?latest>plan.input.entryBound||latest<=plan.input.stop:latest<plan.input.entryBound||latest>=plan.input.stop))throw new Error('Harga melewati parameter yang disetujui. Review lagi.');
    await this.refreshBalance();const chain=this.state.balances!.account;
    const currentBook=this.state.book;
    const currentPrice=(plan.input.side==='long'?currentBook?.asks[0]:currentBook?.bids[0])?.price;
    if(!currentBook||Date.now()-currentBook.receivedAt>3000||!currentPrice||(plan.input.side==='long'?currentPrice>plan.input.entryBound||currentPrice<=plan.input.stop:currentPrice<plan.input.entryBound||currentPrice>=plan.input.stop))throw new Error('Quote berubah atau basi setelah pengecekan akun. Review lagi.');
    if(!chain||chain.accountId!==a.account!.id||chain.frozen!==0||chain.lockedBalanceCNS!==0n||Object.values(chain.positions).some(x=>x!==0n)||chain.balanceCNS<plan.quote.margin+plan.quote.entryFee+plan.input.operationalReserve+plan.input.fundingReserve)throw new Error('ENTRY_CHAIN_ADMISSION_FAILED');
    if(cfg.takerFees[a.account!.feeTier]!==plan.input.takerFeeMicros)throw new Error('Fee berubah. Review lagi.');
    await this.coordinator.entry(plan,approve(plan,this.wallet.sessionId,Date.now()),this.context(true),cfg.ttlBlocks);this.patch({journal:await this.store.rows()});});}
  activePosition():Position|null{const acc=this.state.inventory.accounts.find(a=>a.instance===this.state.config?.instanceId);return acc?this.state.inventory.positions.find(p=>p.account===acc.id&&p.market===this.state.config?.marketId&&p.size>0n)??null:null;}
  async protect(stop:string):Promise<void>{await this.task(async()=>{if(this.state.mode==='replay'){const p=this.state.replayPosition;if(!p)throw new Error('Posisi latihan tidak ditemukan.');const price=parseUnits(stop,this.state.config!.priceDecimals);if(price<=0n||(p.side==='long'?price>=p.entry:price<=p.entry))throw new Error('Harga stop tidak sesuai side posisi.');this.patch({replayPosition:{...p,stop:price,protected:true},replayStatus:'active'});return;}const p=this.activePosition();if(!p)throw new Error('Posisi aktual tidak ditemukan.');if(linkedStops(p,this.state.inventory.orders).length)throw new Error('Stop lama masih ada. Batalkan dan tunggu konfirmasi sebelum memasang pengganti.');await this.coordinator.stop(p,parseUnits(stop,this.state.config!.priceDecimals),this.context());this.patch({journal:await this.store.rows()});});}
  async close():Promise<void>{await this.task(async()=>{if(this.state.mode==='replay'){this.patch({replayPosition:null,replayStatus:'flat'});await this.addReceipt({id:id(),mode:'replay',title:'Close latihan',createdAt:Date.now(),details:'Synthetic close; biaya, funding, dan PnL live belum dibuktikan.'});return;}const p=this.activePosition();if(!p)throw new Error('Posisi aktual tidak ditemukan.');await this.coordinator.close(p,Math.min(100,this.state.config!.maxSlippageBps),this.context(),this.state.config!.ttlBlocks);this.patch({journal:await this.store.rows()});});}
  async cancel(o:Order):Promise<void>{await this.task(async()=>{await this.coordinator.cancel(o,this.context(),this.state.config!.ttlBlocks);this.patch({journal:await this.store.rows()});});}
  status():string{if(this.state.mode==='replay')return this.state.replayStatus;const acc=this.state.inventory.accounts.find(a=>a.instance===this.state.config?.instanceId);return acc?workflow(this.state.inventory,this.state.journal,String(acc.id)):'unknown';}
  private async addReceipt(receipt:Receipt):Promise<void>{await this.store.receipt(receipt.id,receipt);this.patch({receipts:[receipt,...this.state.receipts.filter(r=>r.id!==receipt.id)].slice(0,30)});}
}
