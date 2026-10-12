import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {PerplHttp,ApiError} from '../packages/perpl/http';
import {generateKey} from '../packages/perpl/auth';
import {record,text} from '../packages/perpl/codec';
import {validateEnrollment,ENROLLMENT_DOMAIN_FIELDS,ENROLLMENT_MESSAGE_FIELDS,ENROLLMENT_STATEMENT,type EnrollmentPolicy} from '../packages/perpl/enrollment';
const origin='https://tready-archzxy.netlify.app';
const previous=JSON.parse(await readFile('artifacts/enroll-spike.json','utf8'));
const wallet=previous.probeWallet as string;
const generated=await generateKey();const now=Date.now();
const policy:EnrollmentPolicy={domainName:'perpl.xyz',domainVersion:'1',verifyingContract:'0x0000000000000000000000000000000000000000',primaryType:'PerplRegisterApiKey',addressField:'signer',publicKeyField:'publicKey',scopeField:'scope',expiryField:'expiresAt',statement:ENROLLMENT_STATEMENT,types:{EIP712Domain:ENROLLMENT_DOMAIN_FIELDS,PerplRegisterApiKey:ENROLLMENT_MESSAGE_FIELDS}};
const expected={wallet,publicKey:generated.publicKey,scope:3,expiry:now+86_400_000,origin,label:'Tready Android testnet',requestedAt:now};
let status:number|null=null;let schemaAccepted=false;let error:string|null=null;
try{const value=record(await new PerplHttp().request('/v1/api-key/payload',{method:'POST',origin,body:{chain_id:10143,address:wallet,public_key:generated.publicKey,scope_mask:3,label:expected.label,expires_at:expected.expiry}}));status=200;try{validateEnrollment(value.typed_data,policy,expected);schemaAccepted=true;}catch(e){error=e instanceof Error?e.message:'SCHEMA_REJECTED';}}
catch(e){status=e instanceof ApiError?e.status:null;error=e instanceof ApiError?`Perpl HTTP ${e.status}`:'NETWORK_FAILED';}
finally{generated.secret.fill(0);}
const report={checkedAt:new Date().toISOString(),classification:'own_origin_unsigned_payload_readiness_only',origin,status,schemaAccepted,error,enrollCalled:false,walletSignatureProduced:false,otherOriginsUsed:false};
await mkdir('artifacts/remediation',{recursive:true});await writeFile('artifacts/remediation/origin.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
