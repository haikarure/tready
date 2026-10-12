import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {isAddress} from 'viem';
import {PerplHttp,ApiError} from '../packages/perpl/http';
import {generateKey} from '../packages/perpl/auth';
import {record,text} from '../packages/perpl/codec';
import {validateEnrollment,ENROLLMENT_DOMAIN_FIELDS,ENROLLMENT_MESSAGE_FIELDS,ENROLLMENT_STATEMENT,ENROLLMENT_LABEL,type EnrollmentPolicy} from '../packages/perpl/enrollment';
const origin='https://tready-archzxy.netlify.app';
const previous=JSON.parse(await readFile('artifacts/enroll-spike.json','utf8'));
const wallet=process.argv[2]??previous.probeWallet as string;
if(!isAddress(wallet))throw new Error('Provide only the public wallet address; no key is needed.');
const generated=await generateKey();const now=Date.now();
const policy:EnrollmentPolicy={domainName:'perpl.xyz',domainVersion:'1',verifyingContract:'0x0000000000000000000000000000000000000000',primaryType:'PerplRegisterApiKey',addressField:'signer',publicKeyField:'publicKey',scopeField:'scope',expiryField:'expiresAt',statement:ENROLLMENT_STATEMENT,types:{EIP712Domain:ENROLLMENT_DOMAIN_FIELDS,PerplRegisterApiKey:ENROLLMENT_MESSAGE_FIELDS}};
const expected={wallet,publicKey:generated.publicKey,scope:3,expiry:now+86_400_000,origin,label:ENROLLMENT_LABEL,requestedAt:now};
let status:number|null=null;let schemaAccepted=false;let error:string|null=null;
try{const value=record(await new PerplHttp().request('/v1/api-key/payload',{method:'POST',origin,body:{chain_id:10143,address:wallet,public_key:generated.publicKey,scope_mask:3,label:expected.label,expires_at:expected.expiry}}));status=200;try{validateEnrollment(value.typed_data,policy,expected);schemaAccepted=true;}catch(e){error=e instanceof Error?e.message:'SCHEMA_REJECTED';}}
catch(e){status=e instanceof ApiError?e.status:null;error=e instanceof ApiError?`Perpl HTTP ${e.status}`:'NETWORK_FAILED';}
finally{generated.secret.fill(0);}
let confirmedPolicyFile:string|null=null;
if(schemaAccepted){
  // Export only the hardcoded policy validated against this accepted own-Origin
  // challenge. Never persist the MAC, dynamic challenge or generated secret.
  await mkdir('.tooling/enrollment',{recursive:true});
  confirmedPolicyFile='.tooling/enrollment/own-origin-policy.json';
  await writeFile(confirmedPolicyFile,JSON.stringify(policy,null,2)+'\n');
}
const report={checkedAt:new Date().toISOString(),classification:'own_origin_unsigned_payload_readiness_only',origin,wallet,status,schemaAccepted,error,confirmedPolicyFile,enrollCalled:false,walletSignatureProduced:false,apiKeyCreated:false,otherOriginsUsed:false};
await mkdir('artifacts/remediation',{recursive:true});await writeFile('artifacts/remediation/origin.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
