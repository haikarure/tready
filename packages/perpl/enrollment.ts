import { hashTypedData, type TypedDataDefinition, type Address } from 'viem';
import { base64urlnopad } from '@scure/base';
import { bytesToHex } from '@noble/hashes/utils.js';
import { record, text, safeNumber } from './codec';
import { generateKey, possessionSignature, type ApiCredential } from './auth';
import { PerplHttp } from './http';
import { TESTNET } from './config';

export interface TypedField { name:string; type:string }
export interface EnrollmentPolicy { domainName:string; domainVersion:string; verifyingContract:Address; primaryType:string; addressField:string; publicKeyField:string; scopeField:string; expiryField:string; types:Record<string,TypedField[]>; statement:string }
export interface EnrollmentExpectation { wallet:string; publicKey:string; scope:number; expiry:number; origin:string; label:string; requestedAt:number }
export const ENROLLMENT_LABEL='Tready Android testnet';
export const ENROLLMENT_STATEMENT='I authorize the creation of Perpl API key with the specified scope and parameters';
export const ENROLLMENT_DOMAIN_FIELDS:TypedField[]=[{name:'name',type:'string'},{name:'version',type:'string'},{name:'chainId',type:'uint256'},{name:'verifyingContract',type:'address'},{name:'salt',type:'bytes32'}];
export const ENROLLMENT_MESSAGE_FIELDS:TypedField[]=[{name:'signer',type:'address'},{name:'statement',type:'string'},{name:'publicKey',type:'string'},{name:'scope',type:'string'},{name:'label',type:'string'},{name:'expiresAt',type:'string'},{name:'ipCidrs',type:'string'},{name:'origin',type:'string'},{name:'builderId',type:'string'},{name:'maxBuilderFeePer100K',type:'string'},{name:'time',type:'uint64'}];
function fields(value:unknown):value is TypedField[]{
  if(!Array.isArray(value)||!value.length)return false;
  return value.every(f=>f&&typeof f==='object'&&Object.keys(f).length===2&&typeof f.name==='string'&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(f.name)&&typeof f.type==='string'&&/^(address|string|bytes32|uint8|uint64|uint256)$/.test(f.type))&&new Set(value.map(f=>f.name)).size===value.length;
}
function sameFields(actual:unknown,expected:TypedField[]):boolean {
  return fields(actual)&&actual.length===expected.length&&actual.every((f,i)=>f.name===expected[i]!.name&&f.type===expected[i]!.type);
}
export function hasEnrollmentPolicy(value:unknown):value is EnrollmentPolicy {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const p=value as Record<string,unknown>;
  const required=['domainName','domainVersion','primaryType','addressField','publicKeyField','scopeField','expiryField'];
  if(!required.every(field=>typeof p[field]==='string'&&(p[field] as string).trim().length>0)||typeof p.verifyingContract!=='string'||!/^0x[0-9a-f]{40}$/i.test(p.verifyingContract)||p.statement!==ENROLLMENT_STATEMENT)return false;
  const graph=p.types as Record<string,unknown>|undefined;
  if(!graph||typeof graph!=='object'||Array.isArray(graph)||Object.keys(graph).length!==2||!sameFields(graph.EIP712Domain,ENROLLMENT_DOMAIN_FIELDS))return false;
  const primary=graph[p.primaryType as string];
  if(!Array.isArray(primary))return false;
  // The non-builder flow is the only authority supported by this app. Schema policy
  // cannot silently omit an authorization field even when config is incomplete.
  const names:Record<string,string>={signer:p.addressField as string,publicKey:p.publicKeyField as string,scope:p.scopeField as string,expiresAt:p.expiryField as string};
  const expected=ENROLLMENT_MESSAGE_FIELDS.map(f=>({...f,name:names[f.name]??f.name}));
  return sameFields(primary,expected);
}
// The live vendor payload reports chainId as 0x-hex and the Ed25519 public key as base64url,
// while the client holds them as a number and 0x-hex. Normalize the encoding before comparing
// so a correct payload is not rejected; the compared values themselves stay strict.
function wireInteger(value:unknown):number {
  if(typeof value==='string'&&/^0x[0-9a-fA-F]+$/.test(value)){
    const parsed=Number.parseInt(value.slice(2),16);
    if(Number.isSafeInteger(parsed)&&parsed>=0)return parsed;
    throw new Error('WIRE_INTEGER_UNSUPPORTED');
  }
  return safeNumber(value);
}
function publicKeyFingerprint(value:unknown):string {
  const raw=text(value).trim();
  const bare=raw.replace(/^0x/i,'');
  if(/^[0-9a-fA-F]{64}$/.test(bare))return `0x${bare.toLowerCase()}`;
  if(/^[0-9a-zA-Z_-]+={0,2}$/.test(raw)){
    const unpadded=raw.replace(/=+$/,'');
    if(unpadded.length>=42&&unpadded.length<=44){
      try{const bytes=base64urlnopad.decode(unpadded);if(bytes.length===32)return `0x${bytesToHex(bytes)}`;}catch{/* fall through to rejection */}
    }
  }
  throw new Error('ENROLLMENT_PUBLIC_KEY_UNSUPPORTED');
}
// This policy must be pinned from a vendor-confirmed payload before signing.
export function validateEnrollment(payload:unknown,policy:EnrollmentPolicy|null,expected:EnrollmentExpectation,now=Date.now()):TypedDataDefinition {
  if(!hasEnrollmentPolicy(policy))throw new Error('ENROLLMENT_SCHEMA_CONFIRMATION_REQUIRED');
  const value=record(payload);const domain=record(value.domain);const message=record(value.message);
  if(wireInteger(domain.chainId)!==10143||domain.name!==policy.domainName||domain.version!==policy.domainVersion||text(domain.verifyingContract).toLowerCase()!==policy.verifyingContract.toLowerCase()||value.primaryType!==policy.primaryType)throw new Error('ENROLLMENT_DOMAIN_MISMATCH');
  if(text(message[policy.addressField]).toLowerCase()!==expected.wallet.toLowerCase()||publicKeyFingerprint(message[policy.publicKeyField])!==expected.publicKey.toLowerCase()||safeNumber(message[policy.scopeField])!==expected.scope||safeNumber(message[policy.expiryField])!==expected.expiry)throw new Error('ENROLLMENT_CAPABILITY_MISMATCH');
  const types=record(value.types);
  if(Object.keys(types).length!==2||Object.keys(types).some(k=>!(k in policy.types))||Object.entries(policy.types).some(([name,expected])=>!sameFields(types[name],expected)))throw new Error('ENROLLMENT_TYPE_UNSUPPORTED');
  const exactKeys=(actual:Record<string,unknown>,names:string[])=>Object.keys(actual).length===names.length&&names.every(name=>Object.hasOwn(actual,name));
  if(!exactKeys(value,['domain','primaryType','types','message'])||!exactKeys(domain,policy.types.EIP712Domain!.map(f=>f.name))||!exactKeys(message,policy.types[policy.primaryType]!.map(f=>f.name)))throw new Error('ENROLLMENT_FIELDS_UNSUPPORTED');
  if(!/^0x[0-9a-f]{64}$/i.test(text(domain.salt)))throw new Error('ENROLLMENT_SALT_INVALID');
  let originValid=false;try{const url=new URL(expected.origin);originValid=url.protocol==='https:'&&url.origin===expected.origin;}catch{/* reject */}
  if(!originValid||message.origin!==expected.origin||message.label!==expected.label||message.statement!==policy.statement||message.ipCidrs!==''||wireInteger(message.builderId)!==0||wireInteger(message.maxBuilderFeePer100K)!==0)throw new Error('ENROLLMENT_AUTHORITY_MISMATCH');
  const time=wireInteger(message.time);
  if(!Number.isSafeInteger(expected.requestedAt)||!Number.isSafeInteger(expected.expiry)||expected.expiry<=now||expected.requestedAt>now||now-expected.requestedAt>120_000||time<expected.requestedAt-60_000||time>now+60_000)throw new Error('ENROLLMENT_CHALLENGE_EXPIRED');
  const checked={domain:{...domain},primaryType:policy.primaryType,types:Object.fromEntries(Object.entries(policy.types).map(([name,definitions])=>[name,definitions.map(f=>({...f}))])),message:{...message}} as unknown as TypedDataDefinition;
  hashTypedData(checked); // Reject malformed EIP-712 primitive values before asking the wallet.
  return checked;
}
export async function enroll(http:PerplHttp,origin:string,wallet:Address,sign:(typed:TypedDataDefinition)=>Promise<`0x${string}`>,policy:EnrollmentPolicy|null,authorized:()=>boolean=()=>false):Promise<ApiCredential>{
  if(!origin.startsWith('https://')||!hasEnrollmentPolicy(policy))throw new Error('Domain/whitelist dan schema enrollment belum siap.');
  const {secret,publicKey}=await generateKey();const requestedAt=Date.now();const expiry=requestedAt+24*60*60_000;const scope=3;
  const expected:EnrollmentExpectation={wallet,publicKey,scope,expiry,origin,label:ENROLLMENT_LABEL,requestedAt};
  try{
    const response=record(await http.request('/v1/api-key/payload',{method:'POST',origin,body:{chain_id:10143,address:wallet,public_key:publicKey,scope_mask:scope,label:ENROLLMENT_LABEL,expires_at:expiry}}));
    const typed=validateEnrollment(response.typed_data,policy,expected);
    const mac=text(response.mac);if(!mac||mac.trim()!==mac)throw new Error('ENROLLMENT_MAC_MISSING');
    if(!authorized())throw new Error('API_SESSION_LOCKED');
    const signature=await sign(typed);const pop=await possessionSignature(hashTypedData(typed),secret);
    if(!authorized())throw new Error('API_SESSION_LOCKED');
    validateEnrollment(typed,policy,expected);
    const response2=record(await http.request('/v1/api-key/enroll',{method:'POST',origin,body:{chain_id:TESTNET.chainId,address:wallet,typed_data:typed,mac,signature,pop_signature:pop}}));
    const key=record(response2.api_key);
    if(text(key.address).toLowerCase()!==wallet.toLowerCase()||safeNumber(key.scope_mask)!==scope||safeNumber(key.expires_at)!==expiry||key.origin!==origin||key.label!==ENROLLMENT_LABEL||!Array.isArray(key.ip_cidrs)||key.ip_cidrs.length!==0||wireInteger(key.builder_id??0)!==0||wireInteger(key.max_builder_fee_per_100k??0)!==0)throw new Error('ENROLLED_KEY_BINDING_MISMATCH');
    const token=text(key.api_key);if(!token||token.trim()!==token)throw new Error('ENROLLED_KEY_TOKEN_MISSING');
    return {token,secret,wallet,expiresAt:expiry,scope};
  }catch(error){secret.fill(0);throw error;}
}
