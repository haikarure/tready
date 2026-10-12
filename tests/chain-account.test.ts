import {describe,it,expect} from 'vitest';
import {BaseError,ContractFunctionRevertedError,encodeErrorResult,type Address,type Abi} from 'viem';
import exchangeAbi from '../packages/perpl/exchange-abi.json';
import {readPerplAccount,type ChainAccount} from '../packages/perpl/chain-account';

const wallet='0xb82BAea2b6F7F32c5BfD4B80b5b033F019fB7e54' as Address;
const other='0x1111111111111111111111111111111111111111' as Address;
const abi=exchangeAbi as Abi;
function absent(address:Address){
  const data=encodeErrorResult({abi,errorName:'AccountDoesNotExist',args:[address]});
  const revert=new ContractFunctionRevertedError({abi,data,functionName:'getAccountByAddr'});
  return new BaseError('Account lookup failed',{cause:revert});
}
describe('on-chain account absence',()=>{
  it('returns the registered account unchanged',async()=>{
    const account:ChainAccount={accountId:7n,balanceCNS:10n,lockedBalanceCNS:4n,frozen:0,accountAddr:wallet,positions:{bank1:1n,bank2:0n,bank3:0n,bank4:0n}};
    expect(await readPerplAccount(async()=>account,wallet)).toBe(account);
  });
  it('recognizes the actual venue absence error only for the requested wallet',async()=>{
    expect(encodeErrorResult({abi,errorName:'AccountDoesNotExist',args:[wallet]}).slice(0,10)).toBe('0x03a0e277');
    expect(await readPerplAccount(async()=>{throw absent(wallet);},wallet.toLowerCase() as Address)).toBeNull();
  });
  it('preserves RPC failures and reverts for another address',async()=>{
    const timeout=new Error('RPC timeout');
    await expect(readPerplAccount(async()=>{throw timeout;},wallet)).rejects.toBe(timeout);
    const mismatch=absent(other);
    await expect(readPerplAccount(async()=>{throw mismatch;},wallet)).rejects.toBe(mismatch);
  });
  it('does not infer absence from untyped errors or other contract reverts',async()=>{
    const spoof={data:{errorName:'AccountDoesNotExist',args:[wallet]}};
    await expect(readPerplAccount(async()=>{throw spoof;},wallet)).rejects.toBe(spoof);
    const revert=new ContractFunctionRevertedError({abi,data:'0xdeadbeef',functionName:'getAccountByAddr'});
    await expect(readPerplAccount(async()=>{throw revert;},wallet)).rejects.toBe(revert);
  });
});
