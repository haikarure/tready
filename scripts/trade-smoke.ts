import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {writeFileSync,existsSync,readFileSync,mkdirSync} from 'node:fs';
import {hexToBytes} from '@noble/hashes/utils.js';
import {PerplHttp} from '../packages/perpl/http';
import {TradingSocket,type SocketLike} from '../packages/perpl/socket';
import {TESTNET,resolveConfig} from '../packages/perpl/config';
import {applyInventory,emptyInventory,admission,order,type Inventory} from '../packages/perpl/inventory';
import {record,list,safeNumber,u64,encode,decode} from '../packages/perpl/codec';
import {decodeBook} from '../packages/perpl/book';
import {calculateRisk} from '../packages/domain/risk';
import {approve,type Plan} from '../packages/domain/plan';
import {ceilDiv} from '../packages/domain/units';
import {Coordinator,requestOutcome,type ExecutionContext} from '../packages/execution/coordinator';
import {MemoryJournal} from '../packages/storage/memory';
import {stopCoverage} from '../packages/execution/workflow';
import type {ApiCredential} from '../packages/perpl/auth';
import {createPublicClient,http as rpcHttp} from 'viem';
import {monadTestnet} from 'viem/chains';

// Explicit opt-in: one BTC lot on Monad testnet, only an initially flat account.
// No owner key, funding, enrollment or mainnet route. Unknown writes are never retried.
if(process.env.TREADY_ALLOW_TESTNET_TRADING!=='1')throw new Error('TESTNET_TRADE_OPT_IN_REQUIRED');
const files=(await readdir('.')).filter(f=>/^perpl-api-key.*\.txt$/.test(f));if(files.length!==1)throw new Error('KEY_FILE_COUNT');
const raw=await readFile(files[0]!,'utf8');const token=raw.match(/API Key \(X-API-Key header\):\s*(\S+)/)?.[1];const seed=raw.match(/0x[0-9a-fA-F]{64}/)?.[0];if(!token||!seed)throw new Error('KEY_FORMAT');
const key:ApiCredential={token,secret:hexToBytes(seed.slice(2)),wallet:'0x'+'0'.repeat(40),expiresAt:0,scope:3};
const h=new PerplHttp();const journal=new MemoryJournal();const dir='.tooling/trade-smoke';mkdirSync(dir,{recursive:true});
const journalFile=`${dir}/journal.json`;
if(existsSync(journalFile)&&list(decode(readFileSync(journalFile,'utf8'))).length)throw new Error('PRIOR_TRADE_JOURNAL_EXISTS_REVIEW_BEFORE_ANOTHER_RUN');
const persist=()=>writeFileSync(journalFile,encode(journal.values));
const prepare=journal.prepare.bind(journal);journal.prepare=async(...args)=>{const row=await prepare(...args);persist();return row;};
const update=journal.update.bind(journal);journal.update=async(...args)=>{await update(...args);persist();};
let inventory=emptyInventory('smoke');let disconnected=false;let parseError:string|null=null;let queue=Promise.resolve();
let accountId='';let sentCount=0;let entrySent=false;let closeSent=false;
const events:Array<Record<string,unknown>>=[];
const socket=new TradingSocket(url=>{
  const ws=new WebSocket(url);const send=ws.send.bind(ws);
  ws.send=data=>{const frame=record(decode(String(data)));const mt=safeNumber(frame.mt);if(![1,29,22].includes(mt))throw new Error('FRAME_FORBIDDEN');if(mt===22){if(u64(frame.acc).toString()!==accountId||u64(frame.mkt)!==TESTNET.marketId||u64(frame.s)>1n)throw new Error('SMOKE_SIZE_OR_ACCOUNT_BOUND');sentCount++;}send(data);};return ws as unknown as SocketLike;
},value=>{queue=queue.then(async()=>{
  const m=record(value);const mt=safeNumber(m.mt);
  if(mt===3&&m.cid!==undefined){const row=journal.values.find(r=>r.command.sn===u64(m.cid));if(row){const status=record(m.status);await journal.update(row.id,safeNumber(status.code)===0?'forwarded':'failed',`Gateway code ${safeNumber(status.code)}`);}}
  if(mt===24)for(const item of list(m.d)){const o=order(item);const row=journal.values.find(r=>r.id===String(o.request)&&r.account===String(o.account));if(row){const outcome=requestOutcome(row,o);if(outcome)await journal.update(row.id,outcome.status==='failed'?'unknown':outcome.status,`Venue status ${o.status}, reason ${o.reason}`,outcome.nonFailureSeen);events.push({kind:row.kind,requestId:row.id,status:o.status,reason:o.reason,account:o.account.toString(),market:o.market.toString(),orderId:o.id.toString(),at:m.at});}}
  inventory=applyInventory(inventory,value,Date.now());
}).catch(e=>{parseError=e instanceof Error?e.message:'DECODE_FAILED';});},()=>{disconnected=true;});
async function waitUntil(predicate:()=>boolean,timeout=20_000){const deadline=Date.now()+timeout;while(Date.now()<deadline){await queue;if(parseError||disconnected)throw new Error(parseError??'SOCKET_DISCONNECTED');if(predicate())return;await new Promise(r=>setTimeout(r,150));}throw new Error('SMOKE_OUTCOME_TIMEOUT_CHECK_HISTORY_NO_RETRY');}
async function snapshots(){let state=emptyInventory('rest');for(const path of ['/v1/trading/wallet','/v1/trading/orders','/v1/trading/positions'])state=applyInventory(state,await h.request(path,{key}),Date.now());return state;}
const cfg=resolveConfig(await h.request('/v1/pub/context'));
const rpc=createPublicClient({chain:monadTestnet,transport:rpcHttp(TESTNET.rpc,{retryCount:0,timeout:12_000})});
if(await rpc.getChainId()!==10143||cfg.chainId!==10143||cfg.marketId!==16n||cfg.instanceId!==12n)throw new Error('TESTNET_BINDING_MISMATCH');
let success=false;let error:string|null=null;let finalFlat=false;let actualStopCoverage:string|null=null;let positionId:string|null=null;
const coordinator=new Coordinator(journal,command=>socket.send(command,key));
const context=():ExecutionContext=>({sessionId:'testnet-cli',live:true,fresh:inventory.continuous&&Date.now()-inventory.receivedAt<5000,accountFlat:true,lastForwarded:inventory.accounts.find(a=>String(a.id)===accountId)!.lfr,head:inventory.head,configDigest:cfg.digest,wallet:key.wallet,accountId});
try{
  const initial=await snapshots();key.wallet=initial.wallet!;const account=initial.accounts.find(a=>a.instance===cfg.instanceId);
  if(!account||account.frozen||!account.forwarding||account.locked!==0n||initial.orders.length||initial.positions.length)throw new Error('SMOKE_REQUIRES_FLAT_READY_ACCOUNT');accountId=String(account.id);
  await socket.connect(key);await waitUntil(()=>inventory.walletReady&&inventory.ordersReady&&inventory.positionsReady&&inventory.head>0n);
  const a=admission(inventory,cfg,key.wallet,Date.now());if(a.reasons.length)throw new Error('SMOKE_ADMISSION_FAILED');
  const book=decodeBook(await h.request(`/v1/market-data/${cfg.marketId}/book?levels=100`),Date.now());const quoteEntry=book.asks[0]!.price;
  const input={side:'long' as const,budget:1_000_000n,quoteEntry,entryBound:ceilDiv(quoteEntry*10005n,10000n),stop:quoteEntry*99n/100n,stressExit:quoteEntry*989n/1000n,leverage:300,maxLeverage:cfg.initialMargin,maintenanceDenominator:cfg.maintenanceMargin,takerFeeMicros:cfg.takerFees[account.feeTier]!,fundingReserve:50_000n,operationalReserve:cfg.recycleFee*3n,availableCollateral:account.balance-account.locked,priceDecimals:cfg.priceDecimals,sizeDecimals:cfg.sizeDecimals,collateralDecimals:6,minNotional:cfg.minSettle,maxQuantity:1n};
  const quote=calculateRisk(input);if(!quote.executable||quote.quantity!==1n)throw new Error('SMOKE_QUOTE_UNEXECUTABLE');
  const now=Date.now();const plan:Plan={version:1,id:'testnet-single-lot-smoke',revision:1,binding:{chainId:10143,instanceId:String(cfg.instanceId),exchange:cfg.exchange,collateral:cfg.collateral,marketId:String(cfg.marketId),perpetualId:String(cfg.perpetualId),accountId,wallet:key.wallet},input,quote,configDigest:cfg.digest,bookBlock:String(book.block),receivedAt:now,expiresAt:now+30_000};
  entrySent=true;const entry=await coordinator.entry(plan,approve(plan,'testnet-cli',Date.now()),context(),cfg.ttlBlocks);
  await waitUntil(()=>journal.values.find(r=>r.id===entry.id)?.status==='settled'&&inventory.positions.some(p=>String(p.account)===accountId&&p.market===cfg.marketId&&p.size===1n));
  const position=inventory.positions.find(p=>String(p.account)===accountId&&p.market===cfg.marketId)!;positionId=String(position.id);
  const stop=await coordinator.stop(position,position.entry*99n/100n,context());
  await waitUntil(()=>journal.values.find(r=>r.id===stop.id)?.status==='settled'&&stopCoverage(position,inventory.orders).status==='full');actualStopCoverage=stopCoverage(position,inventory.orders).status;
  closeSent=true;const close=await coordinator.close(position,Math.min(100,cfg.maxSlippageBps),context(),cfg.ttlBlocks);
  await waitUntil(()=>journal.values.find(r=>r.id===close.id)?.status==='settled'&&!inventory.positions.some(p=>String(p.account)===accountId&&p.market===cfg.marketId&&p.size>0n));
  const final=await snapshots();finalFlat=final.positions.length===0&&final.orders.length===0&&final.accounts.find(a=>String(a.id)===accountId)?.locked===0n;
  success=finalFlat;
}catch(e){error=e instanceof Error?e.message:'SMOKE_FAILED';
  // Cleanup only after a known entry outcome; never replace an unknown request or close.
  if(entrySent&&!closeSent&&!await journal.unresolved(accountId)&&!disconnected){try{const state=await snapshots();const position=state.positions.find(p=>String(p.account)===accountId&&p.market===cfg.marketId&&p.size===1n);if(position){closeSent=true;const row=await coordinator.close(position,Math.min(100,cfg.maxSlippageBps),context(),cfg.ttlBlocks);await waitUntil(()=>journal.values.find(r=>r.id===row.id)?.status==='settled');}const final=await snapshots();finalFlat=final.positions.length===0&&final.orders.length===0;}catch{error+='; CLEANUP_NOT_CONFIRMED_REVIEW_VENUE';}}
}finally{socket.close();key.secret.fill(0);}
const report={checkedAt:new Date().toISOString(),classification:'actual_single_lot_Monad_testnet_venue_trade_through_production_core_in_Node',success,error,chainId:10143,marketId:'16',accountId,positionId,quantityLots:'1',actualStopCoverage,finalFlat,orderRequestsSent:sentCount,events,journal:journal.values.map(r=>({id:r.id,kind:r.kind,status:r.status,nonFailureSeen:r.nonFailureSeen})),limitations:['Venue UI API key; no native Mera enrollment or owner funding tested.','Node transport and disk-backed synthetic journal adapter; native socket/SQLite not verified by this test.','No claim of hardware passkey, sponsor eligibility or customer demand.']};
await mkdir('artifacts/remediation',{recursive:true});await writeFile('artifacts/remediation/trade-smoke.json',encode(report)+'\n');console.log(encode(report));if(!success)process.exitCode=1;
