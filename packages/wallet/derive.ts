import { createSecp256k1SigningSession, getEvmAddress } from '@category-labs/mera';
import { toViemAccount } from '@category-labs/mera/viem';
import { HDKey } from '@scure/bip32';
import { entropyToMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export const DERIVATION_VERSION = 1;
export function deriveWallet(prf:Uint8Array) {
  if(prf.length!==32)throw new Error('PRF_UNAVAILABLE');
  const seed=mnemonicToSeedSync(entropyToMnemonic(prf,wordlist));
  const master=HDKey.fromMasterSeed(seed);
  const node=master.derive("m/44'/60'/0'/0/0");
  if(!node.privateKey)throw new Error('DERIVATION_FAILED');
  const session=createSecp256k1SigningSession({privateKey:node.privateKey});
  const address=getEvmAddress(session.publicKey);
  node.wipePrivateData();master.wipePrivateData();seed.fill(0);prf.fill(0);
  return {address,session,account:toViemAccount(session),derivationVersion:DERIVATION_VERSION};
}
