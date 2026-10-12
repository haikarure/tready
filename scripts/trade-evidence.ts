import {readFile,readdir,writeFile} from 'node:fs/promises';
import {hexToBytes} from '@noble/hashes/utils.js';
import {PerplHttp} from '../packages/perpl/http';
import {TESTNET} from '../packages/perpl/config';
import {orderHistory} from '../packages/perpl/history';
import {record,u64} from '../packages/perpl/codec';
import {createPublicClient,http} from 'viem';
import {monadTestnet} from 'viem/chains';
import {actualTxHash} from '../packages/domain/receipts';
const proof=JSON.parse(await readFile('artifacts/remediation/trade-smoke.json','utf8'));
const files=(await readdir('.')).filter(f=>/^perpl-api-key.*\.txt$/.test(f));if(files.length!==1)throw new Error('KEY_FILE_COUNT');
const raw=await readFile(files[0]!,'utf8');const token=raw.match(/API Key \(X-API-Key header\):\s*(\S+)/)?.[1];const seed=raw.match(/0x[0-9a-fA-F]{64}/)?.[0];if(!token||!seed)throw new Error('KEY_FORMAT');
const key={token,secret:hexToBytes(seed.slice(2)),wallet:'0x'+'0'.repeat(40),scope:3,expiresAt:0};
const rpc=createPublicClient({chain:monadTestnet,transport:http(TESTNET.rpc,{retryCount:0,timeout:12_000})});
try{
 const requests=new Set<string>(proof.journal.map((r:{id:string})=>r.id));const history=await orderHistory(new PerplHttp(),key,requests);
 const entries=[];
 for(const o of history.orders.filter(o=>requests.has(String(o.request))&&String(o.account)===proof.accountId)){
  const at=record(o.raw.at);let txHash=actualTxHash(at)??null;
  // Zero txid on some lifecycle events is not chain evidence; do not manufacture a
  // chain link from a default transaction index that could identify an unrelated tx.
  let confirmed=false;if(txHash){const receipt=await rpc.getTransactionReceipt({hash:txHash as `0x${string}`}).catch(()=>null);confirmed=receipt?.status==='success'&&receipt.blockNumber===u64(at.b);}
  entries.push({requestId:String(o.request),orderId:String(o.id),status:o.status,reason:o.reason,block:at.b===undefined?null:String(at.b),transactionIndex:at.tx===undefined?null:String(at.tx),txHash,confirmed,actualSizeLots:String(o.raw.fs),explorer:txHash?`https://testnet.monadscan.com/tx/${txHash}`:null});
 }
 const report={checkedAt:new Date().toISOString(),classification:'read_only_order_history_and_chain_receipt_resolution_for_existing_smoke_trade',historyComplete:history.complete,foundRequests:[...history.found],entries,newOrdersSent:0};
 await writeFile('artifacts/remediation/trade-evidence.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{key.secret.fill(0);}
