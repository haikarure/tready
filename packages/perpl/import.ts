import {hexToBytes} from '@noble/hashes/utils.js';
import type {ApiCredential} from './auth';
import {assertCredential} from './auth';
import {PerplHttp} from './http';
import {applyInventory,emptyInventory} from './inventory';
import {record,safeNumber} from './codec';
import {TESTNET} from './config';

// A user-created venue key is a separate onboarding route supported by Perpl.
// Read authentication proves token/secret and wallet binding, not the server's trade scope.
export async function importVenueKey(http:PerplHttp,tokenInput:string,secretInput:string,wallet:string,authorized:()=>boolean,now=Date.now()):Promise<ApiCredential>{
  if(!authorized())throw new Error('API_SESSION_LOCKED');
  const token=tokenInput.trim();const seed=secretInput.trim().replace(/^0x/i,'');
  if(!token||token.length>2048||/[\s\r\n]/.test(token)||!/^[0-9a-f]{64}$/i.test(seed))throw new Error('API_KEY_IMPORT_INVALID');
  // Limit local use to 24h even if the user-created key has a longer venue expiry.
  const key:ApiCredential={token,secret:hexToBytes(seed),wallet,expiresAt:now+86_400_000,scope:3,source:'venue-import'};
  try{
    assertCredential(key,now);
    const payload=await http.request('/v1/trading/wallet',{key});
    if(safeNumber(record(payload).mt)!==19)throw new Error('API_KEY_IMPORT_SNAPSHOT_INVALID');
    const state=applyInventory(emptyInventory('key-import'),payload,Date.now());
    if(state.wallet?.toLowerCase()!==wallet.toLowerCase())throw new Error('API_WALLET_MISMATCH');
    if(!state.accounts.some(a=>a.instance===TESTNET.instanceId))throw new Error('API_ACCOUNT_MISSING');
    if(!authorized())throw new Error('API_SESSION_LOCKED');
    return key;
  }catch(error){key.secret.fill(0);throw error;}
}
