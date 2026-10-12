import * as ed from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { base64urlnopad } from '@scure/base';
import { TESTNET } from './config';

ed.hashes.sha512 = sha512;
ed.hashes.sha512Async = async message => sha512(message);
export interface ApiCredential { token: string; secret: Uint8Array; wallet: string; expiresAt: number; scope: number; source?:'venue-import'|'enrollment' }
export function assertCredential(key: ApiCredential, now = Date.now(), trade = false): void {
  if (key.secret.length !== 32 || !key.token || !/^0x[0-9a-fA-F]{40}$/.test(key.wallet) || !Number.isSafeInteger(key.expiresAt) || key.expiresAt < 0 || !Number.isInteger(key.scope) || key.scope < 1 || key.scope > 3 || (key.expiresAt !== 0 && key.expiresAt <= now)) throw new Error('API_KEY_INVALID_OR_EXPIRED');
  if (trade && !(key.scope & 2)) throw new Error('API_KEY_TRADE_SCOPE_REQUIRED');
}
export async function generateKey(): Promise<{ secret: Uint8Array; publicKey: string }> {
  const keys = await ed.keygenAsync();
  return { secret: keys.secretKey, publicKey: `0x${bytesToHex(keys.publicKey)}` };
}
export async function restHeaders(key: ApiCredential, method: string, target: string, body: string, now = Date.now()): Promise<Record<string,string>> {
  assertCredential(key, now);
  if (!target.startsWith('/v1/') || /[\r\n]/.test(target)) throw new Error('AUTH_TARGET_INVALID');
  const timestamp = String(now); const nonce = base64urlnopad.encode(crypto.getRandomValues(new Uint8Array(16)));
  const canonical = [TESTNET.chainId, method.toUpperCase(), target, timestamp, nonce, bytesToHex(sha256(utf8ToBytes(body)))].join('\n');
  const signature = base64urlnopad.encode(await ed.signAsync(utf8ToBytes(canonical), key.secret));
  return { 'X-API-Key': key.token, 'X-API-Timestamp': timestamp, 'X-API-Nonce': nonce, 'X-API-Signature': signature };
}
export async function signIn(key: ApiCredential, now = Date.now()): Promise<Record<string,unknown>> {
  assertCredential(key, now);
  const timestamp = String(now); const nonce = base64urlnopad.encode(crypto.getRandomValues(new Uint8Array(16)));
  const canonical = [TESTNET.chainId, 'trading-ws-signin', timestamp, nonce].join('\n');
  return { mt: 29, chain_id: TESTNET.chainId, api_key: key.token, timestamp, nonce, signature: base64urlnopad.encode(await ed.signAsync(utf8ToBytes(canonical), key.secret)) };
}
export async function possessionSignature(typedDataDigest: string, secret: Uint8Array): Promise<string> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(typedDataDigest)) throw new Error('EIP712_DIGEST_INVALID');
  return `0x${bytesToHex(await ed.signAsync(hexToBytes(typedDataDigest.slice(2)), secret))}`;
}
