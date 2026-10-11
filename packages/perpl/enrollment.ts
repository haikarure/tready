import { hashTypedData, type TypedDataDefinition, type Address } from 'viem';
import { record, text, safeNumber } from './codec';
import { generateKey, possessionSignature, type ApiCredential } from './auth';
import { PerplHttp } from './http';
import { TESTNET } from './config';

export interface EnrollmentPolicy { domainName:string; domainVersion:string; verifyingContract:Address; primaryType:string; addressField:string; publicKeyField:string; scopeField:string; expiryField:string }
// This policy must be pinned from a vendor-confirmed payload before signing.
export function validateEnrollment(payload:unknown,policy:EnrollmentPolicy|null,expected:{wallet:string;publicKey:string;scope:number;expiry:number}):TypedDataDefinition {
  if(!policy)throw new Error('ENROLLMENT_SCHEMA_CONFIRMATION_REQUIRED');
  const value=record(payload);const domain=record(value.domain);const message=record(value.message);
  if(safeNumber(domain.chainId)!==10143||domain.name!==policy.domainName||domain.version!==policy.domainVersion||text(domain.verifyingContract).toLowerCase()!==policy.verifyingContract.toLowerCase()||value.primaryType!==policy.primaryType)throw new Error('ENROLLMENT_DOMAIN_MISMATCH');
  if(text(message[policy.addressField]).toLowerCase()!==expected.wallet.toLowerCase()||text(message[policy.publicKeyField]).toLowerCase()!==expected.publicKey.toLowerCase()||safeNumber(message[policy.scopeField])!==expected.scope||safeNumber(message[policy.expiryField])!==expected.expiry)throw new Error('ENROLLMENT_CAPABILITY_MISMATCH');
  // Require exactly the audited enrollment type graph, no token permit/delegation types.
  const types=record(value.types);if(Object.keys(types).some(k=>k!=='EIP712Domain'&&k!==policy.primaryType))throw new Error('ENROLLMENT_TYPE_UNSUPPORTED');
  return value as unknown as TypedDataDefinition;
}
export async function enroll(http:PerplHttp,origin:string,wallet:Address,sign:(typed:TypedDataDefinition)=>Promise<`0x${string}`>,policy:EnrollmentPolicy|null,authorized:()=>boolean=()=>false):Promise<ApiCredential>{
  if(!origin.startsWith('https://')||!policy)throw new Error('Domain/whitelist dan schema enrollment belum siap.');
  const {secret,publicKey}=await generateKey();const expiry=Date.now()+24*60*60_000;const scope=3;
  try{
    const response=record(await http.request('/v1/api-key/payload',{method:'POST',origin,body:{chain_id:10143,address:wallet,public_key:publicKey,scope_mask:scope,label:'Tready Android testnet',expires_at:expiry}}));
    const typed=validateEnrollment(response.typed_data,policy,{wallet,publicKey,scope,expiry});
    if(!authorized())throw new Error('API_SESSION_LOCKED');
    const signature=await sign(typed);const pop=await possessionSignature(hashTypedData(typed),secret);
    if(!authorized())throw new Error('API_SESSION_LOCKED');
    const response2=record(await http.request('/v1/api-key/enroll',{method:'POST',origin,body:{chain_id:TESTNET.chainId,address:wallet,typed_data:response.typed_data,mac:text(response.mac),signature,pop_signature:pop}}));
    const key=record(response2.api_key);
    if(text(key.address).toLowerCase()!==wallet.toLowerCase()||safeNumber(key.scope_mask)!==scope||safeNumber(key.expires_at)!==expiry||key.origin!==origin)throw new Error('ENROLLED_KEY_BINDING_MISMATCH');
    return {token:text(key.api_key),secret,wallet,expiresAt:expiry,scope};
  }catch(error){secret.fill(0);throw error;}
}
