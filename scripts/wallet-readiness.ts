// Read-only checkpoint for the same native Mera wallet used in the APK.
// No key, signature, faucet request or transaction is produced by this script.
import {mkdir,writeFile} from 'node:fs/promises';
import {createPublicClient,http,erc20Abi,isAddress,formatUnits,type Address} from 'viem';
import {monadTestnet} from 'viem/chains';
import exchangeAbi from '../packages/perpl/exchange-abi.json';
import {readPerplAccount,type ChainAccount} from '../packages/perpl/chain-account';
import {PerplHttp} from '../packages/perpl/http';
import {resolveConfig,TESTNET} from '../packages/perpl/config';

const address=process.argv[2];
if(!address||!isAddress(address))throw new Error('Usage: ./scripts/dev.sh pnpm exec tsx scripts/wallet-readiness.ts 0xYOUR_PUBLIC_MERA_ADDRESS');
const wallet=address as Address;
const cfg=resolveConfig(await new PerplHttp().request('/v1/pub/context'));
const client=createPublicClient({chain:monadTestnet,transport:http(TESTNET.rpc,{retryCount:1,timeout:12_000})});
if(await client.getChainId()!==TESTNET.chainId)throw new Error('NETWORK_MISMATCH');
const block=await client.getBlockNumber();
const [mon,ausd,allowance,account]=await Promise.all([
  client.getBalance({address:wallet,blockNumber:block}),
  client.readContract({address:cfg.collateral as Address,abi:erc20Abi,functionName:'balanceOf',args:[wallet],blockNumber:block}),
  client.readContract({address:cfg.collateral as Address,abi:erc20Abi,functionName:'allowance',args:[wallet,cfg.exchange as Address],blockNumber:block}),
  readPerplAccount(async()=>await client.readContract({address:cfg.exchange as Address,abi:exchangeAbi,functionName:'getAccountByAddr',args:[wallet],blockNumber:block}) as unknown as ChainAccount,wallet),
]);
const a=account;
const hasAccount=!!a&&a.accountId>0n;
const report={checkedAt:new Date().toISOString(),classification:'read_only_native_wallet_funding_checkpoint',wallet,chainId:TESTNET.chainId,block:String(block),exchange:cfg.exchange,collateral:cfg.collateral,
  balances:{mon:formatUnits(mon,18),ausd:formatUnits(ausd,6),allowanceAusd:formatUnits(allowance,6),accountCollateralAusd:a?formatUnits(a.balanceCNS,6):null},
  minimumOpenAusd:formatUnits(cfg.minOpen,6),accountId:a?String(a.accountId):null,
  checks:{hasGasBalance:mon>0n,hasMinimumWalletCollateral:ausd>=cfg.minOpen,hasMinimumAllowance:allowance>=cfg.minOpen,hasAccount,accountMatches:a?a.accountAddr.toLowerCase()===wallet.toLowerCase():null,accountFlat:a?a.lockedBalanceCNS===0n&&Object.values(a.positions).every(v=>v===0n):null},
  next:!mon?'Claim testnet MON for this public wallet at https://faucet.monad.xyz.':!hasAccount&&ausd<cfg.minOpen?'In the APK, unlock the same wallet and request testnet AUSD.':!hasAccount&&allowance<cfg.minOpen?'In the APK, approve the displayed collateral amount.':!hasAccount?'In the APK, create the Perpl account with the displayed collateral amount.':'Verify forwarding and own-Origin API enrollment in the APK.',
  writes:false,apiKeyCreated:false,nativeTradeVerified:false};
await mkdir('artifacts/completion',{recursive:true});
await writeFile('artifacts/completion/wallet-readiness.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
