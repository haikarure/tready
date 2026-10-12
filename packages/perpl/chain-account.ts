import { BaseError, ContractFunctionRevertedError, type Address } from 'viem';

export interface ChainAccount {
  accountId:bigint; balanceCNS:bigint; lockedBalanceCNS:bigint; frozen:number;
  accountAddr:Address;
  positions:{bank1:bigint;bank2:bigint;bank3:bigint;bank4:bigint};
}

// The venue reverts for a wallet that has not opened an account. Only its
// decoded, address-matched error establishes absence; RPC failures remain errors.
export async function readPerplAccount(load:()=>Promise<ChainAccount>,wallet:Address):Promise<ChainAccount|null> {
  try { return await load(); }
  catch(error) {
    const revert=error instanceof BaseError
      ? error.walk(cause=>cause instanceof ContractFunctionRevertedError)
      : undefined;
    if(revert instanceof ContractFunctionRevertedError
      && revert.data?.errorName==='AccountDoesNotExist'
      && typeof revert.data.args?.[0]==='string'
      && revert.data.args[0].toLowerCase()===wallet.toLowerCase())return null;
    throw error;
  }
}
