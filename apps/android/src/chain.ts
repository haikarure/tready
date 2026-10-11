import { createPublicClient, createWalletClient, http, erc20Abi, encodeFunctionData, keccak256, type Address, type Hash } from 'viem';
import { monadTestnet } from 'viem/chains';
import exchangeAbi from '../../../packages/perpl/exchange-abi.json';
import { TESTNET, type MarketConfig } from '../../../packages/perpl/config';
import type { WalletManager } from './wallet';
import type { NativeStore } from './storage';

export const publicClient=createPublicClient({chain:monadTestnet,transport:http(TESTNET.rpc,{retryCount:0,timeout:12_000})});
export interface ChainAccount { accountId:bigint; balanceCNS:bigint; lockedBalanceCNS:bigint; frozen:number; accountAddr:Address; positions:{bank1:bigint;bank2:bigint;bank3:bigint;bank4:bigint} }
export interface Balances { mon:bigint; ausd:bigint; allowance:bigint; account:ChainAccount; block:bigint }
export async function verifyChain(cfg:MarketConfig):Promise<void>{
  const chain=await publicClient.getChainId();if(chain!==10143)throw new Error('NETWORK_MISMATCH');
  const [tokenCode,exchangeCode,decimals]=await Promise.all([publicClient.getCode({address:cfg.collateral as Address}),publicClient.getCode({address:cfg.exchange as Address}),publicClient.readContract({address:cfg.collateral as Address,abi:erc20Abi,functionName:'decimals'})]);
  if(!tokenCode||!exchangeCode||decimals!==6)throw new Error('DEPLOYMENT_MISMATCH');
}
export async function balances(address:Address,cfg:MarketConfig):Promise<Balances>{
  const block=await publicClient.getBlockNumber();
  const [mon,ausd,allowance,account]=await Promise.all([
    publicClient.getBalance({address,blockNumber:block}),
    publicClient.readContract({address:cfg.collateral as Address,abi:erc20Abi,functionName:'balanceOf',args:[address],blockNumber:block}),
    publicClient.readContract({address:cfg.collateral as Address,abi:erc20Abi,functionName:'allowance',args:[address,cfg.exchange as Address],blockNumber:block}),
    publicClient.readContract({address:cfg.exchange as Address,abi:exchangeAbi,functionName:'getAccountByAddr',args:[address],blockNumber:block}),
  ]);
  return {mon,ausd,allowance,account:account as unknown as ChainAccount,block};
}
export type OwnerAction='faucet'|'approve'|'create'|'deposit'|'forward'|'withdraw';
export class OwnerTransactions {
  private busy=false;
  constructor(private wallet:WalletManager,private store:NativeStore){}
  async execute(action:OwnerAction,cfg:MarketConfig,amount=0n):Promise<Hash>{
    if(this.busy)throw new Error('Transaksi lama perlu diperiksa dulu.');
    this.busy=true;
    try{
      if((await this.store.ownerPending()).length>0)throw new Error('Transaksi lama perlu diperiksa dulu.');
      const sessionId=this.wallet.sessionId;
      await verifyChain(cfg);const account=this.wallet.account;let to:Address;let data:`0x${string}`;
      if(action==='faucet'){
        to=TESTNET.faucet as Address;
        const abi=[{type:'function',name:'requestFunds',stateMutability:'nonpayable',inputs:[{name:'to',type:'address'}],outputs:[]}] as const;
        await publicClient.simulateContract({address:to,abi,functionName:'requestFunds',args:[account.address],account});
        data=encodeFunctionData({abi,functionName:'requestFunds',args:[account.address]});
      }else if(action==='approve'){
        if(amount<=0n)throw new Error('AMOUNT_INVALID');to=cfg.collateral as Address;
        await publicClient.simulateContract({address:to,abi:erc20Abi,functionName:'approve',args:[cfg.exchange as Address,amount],account});
        data=encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[cfg.exchange as Address,amount]});
      }else{
        to=cfg.exchange as Address;const name={create:'createAccount',deposit:'depositCollateral',forward:'allowOrderForwarding',withdraw:'withdrawCollateral'}[action];
        const args=action==='forward'?[true]:[amount];
        if(action==='create'&&amount<cfg.minOpen||action==='deposit'&&amount<cfg.minDeposit||action==='withdraw'&&amount<cfg.minWithdraw)throw new Error('AMOUNT_BELOW_VENUE_MINIMUM');
        if(action==='withdraw') {const b=await balances(account.address,cfg);if(Object.values(b.account.positions).some(x=>x!==0n)||b.account.lockedBalanceCNS!==0n||await this.store.unresolved(b.account.accountId.toString()))throw new Error('WITHDRAW_REQUIRES_FLAT_RECONCILED_ACCOUNT');}
        await publicClient.simulateContract({address:to,abi:exchangeAbi,functionName:name!,args,account});
        data=encodeFunctionData({abi:exchangeAbi,functionName:name!,args});
      }
      const client=createWalletClient({account,chain:monadTestnet,transport:http(TESTNET.rpc,{retryCount:0})});
      const request=await client.prepareTransactionRequest({account,to,data,value:0n});
      const raw=await client.signTransaction(request);const hash=keccak256(raw);
      await this.store.owner(hash,action,'signed');
      if(!this.wallet.unlocked||this.wallet.sessionId!==sessionId){await this.store.owner(hash,action,'not-broadcast');throw new Error('Sesi berakhir sebelum broadcast.');}
      try{
        await publicClient.sendRawTransaction({serializedTransaction:raw});await this.store.owner(hash,action,'sent');
        const receipt=await publicClient.waitForTransactionReceipt({hash,timeout:20_000});await this.store.owner(hash,action,receipt.status==='success'?'confirmed':'reverted');
        if(receipt.status!=='success')throw new Error('Transaksi reverted.');return hash;
      }catch(error){const existing=await publicClient.getTransactionReceipt({hash}).catch(()=>null);await this.store.owner(hash,action,existing?(existing.status==='success'?'confirmed':'reverted'):'unknown');throw error;}
    }finally{this.busy=false;}
  }
  async reconcile():Promise<void>{for(const tx of await this.store.ownerPending()){const receipt=await publicClient.getTransactionReceipt({hash:tx.hash as Hash}).catch(()=>null);if(receipt)await this.store.owner(tx.hash,tx.action,receipt.status==='success'?'confirmed':'reverted');}}
}
