import { createPasskeyWithPrfOutput, getPasskeyPrfOutput, type PasskeyCredentialMetadata } from '@category-labs/mera';
import { reactNativeWebAuthnClient } from '@category-labs/mera/react-native-webauthn-client';
import { bytesToHex } from '@noble/hashes/utils.js';
import { deriveWallet } from '../../../packages/wallet/derive';
import { passkeyFailureMessage } from '../../../packages/wallet/passkey-error';
import type { NativeStore } from './storage';

export interface Identity { address:`0x${string}`; credential:PasskeyCredentialMetadata; rpId:string; derivationVersion:1 }
// First use may include unlocking/selecting a provider vault before its ceremony.
const PASSKEY_TIMEOUT_MS=300_000;
export class WalletManager {
  private wallet:ReturnType<typeof deriveWallet>|null=null;
  private timer:ReturnType<typeof setTimeout>|null=null;
  identity:Identity|null=null; sessionId=''; expiresAt=0;
  constructor(private store:NativeStore,private rpId:string,private onLock:()=>void){}
  async initialize():Promise<void>{this.identity=await this.store.get<Identity>('identity');if(this.identity&&this.identity.rpId!==this.rpId)throw new Error('PASSKEY_DOMAIN_CHANGED');}
  async unlock(create=false):Promise<Identity>{
    if(!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(this.rpId))throw new Error('Domain passkey belum dikonfigurasi. Ikuti panduan setup.');
    const ceremony=()=>create?createPasskeyWithPrfOutput({rp:{id:this.rpId,name:'Tready'},user:{name:'Tready wallet',displayName:'Tready wallet'},timeout:PASSKEY_TIMEOUT_MS,webAuthnClient:reactNativeWebAuthnClient}):getPasskeyPrfOutput({rpId:this.rpId,credential:this.identity?.credential,timeout:PASSKEY_TIMEOUT_MS,webAuthnClient:reactNativeWebAuthnClient});
    const result=await ceremony().catch(error=>{throw new Error(passkeyFailureMessage(error));});
    this.lock(false);const wallet=deriveWallet(result.prfOutput);
    if(this.identity&&!create&&this.identity.address.toLowerCase()!==wallet.address.toLowerCase()){wallet.session.end();throw new Error('WALLET_IDENTITY_MISMATCH');}
    const identity:Identity={address:wallet.address,credential:{credentialId:result.credentialId},rpId:this.rpId,derivationVersion:1};
    try{await this.store.set('identity',identity);}catch(error){wallet.session.end();throw error;}
    this.identity=identity;this.wallet=wallet;this.sessionId=bytesToHex(crypto.getRandomValues(new Uint8Array(16)));this.expiresAt=Date.now()+15*60_000;this.timer=setTimeout(()=>this.lock(),15*60_000);return identity;
  }
  get account(){if(!this.wallet||Date.now()>=this.expiresAt){this.lock();throw new Error('Sesi terkunci. Buka passkey lagi.');}return this.wallet.account;}
  get unlocked():boolean{return this.wallet!==null&&Date.now()<this.expiresAt;}
  lock(notify=true):void{if(this.timer)clearTimeout(this.timer);this.timer=null;this.wallet?.session.end();this.wallet=null;this.sessionId='';this.expiresAt=0;if(notify)this.onLock();}
}
