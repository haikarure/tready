import { mkdir, writeFile } from 'node:fs/promises';
import { createPublicClient,http,erc20Abi } from 'viem';
import { monadTestnet } from 'viem/chains';
import { PerplHttp } from '../packages/perpl/http';
import { TESTNET,resolveConfig } from '../packages/perpl/config';
import { decodeBook } from '../packages/perpl/book';

const api=new PerplHttp();const cfg=resolveConfig(await api.request('/v1/pub/context'));
const book=decodeBook(await api.request(`/v1/market-data/${cfg.marketId}/book?levels=100`),Date.now());
const rpc=createPublicClient({chain:monadTestnet,transport:http(TESTNET.rpc,{retryCount:0})});
const [chain,decimals,exchangeCode]=await Promise.all([rpc.getChainId(),rpc.readContract({address:cfg.collateral as `0x${string}`,abi:erc20Abi,functionName:'decimals'}),rpc.getCode({address:cfg.exchange as `0x${string}`})]);
if(chain!==10143||decimals!==6||!exchangeCode)throw new Error('INTEGRATION_PROBE_FAILED');
const report={classification:'read_only_public_integration_probe_no_signing_or_order',checkedAt:new Date().toISOString(),chain,collateralDecimals:decimals,exchangeCodeBytes:(exchangeCode.length-2)/2,instance:String(cfg.instanceId),market:String(cfg.marketId),collateral:cfg.collateral,exchange:cfg.exchange,configDigest:cfg.digest,bookBlock:String(book.block),bookTimestamp:book.timestamp,bidLevels:book.bids.length,askLevels:book.asks.length,limitations:['No passkey, owner signing, faucet claim, enrollment, authenticated API or live trade tested.']};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/integration-probe.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
