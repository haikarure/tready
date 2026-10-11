import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const apk='artifacts/tready-0.1.0-preview.apk';const data=await readFile(apk);
const output=execFileSync('.tooling/android-sdk/build-tools/36.0.0/apksigner',['verify','--verbose','--print-certs',apk],{encoding:'utf8'});
const fingerprint=output.match(/certificate SHA-256 digest: ([0-9a-f]+)/i)?.[1];
if(!fingerprint||fingerprint.length!==64)throw new Error('APK_CERTIFICATE_UNVERIFIED');
const sha256Cert=fingerprint.toUpperCase().match(/.{2}/g)!.join(':');
const association=[{relation:['delegate_permission/common.get_login_creds'],target:{namespace:'android_app',package_name:'xyz.tready.app',sha256_cert_fingerprints:[sha256Cert]}}];
await mkdir('apps/access/public/.well-known',{recursive:true});await writeFile('apps/access/public/.well-known/assetlinks.json',JSON.stringify(association,null,2)+'\n');
let commit='uncommitted';try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
const report={version:'0.1.0',build:1,package:'xyz.tready.app',network:'Monad Testnet',chainId:10143,file:'tready-0.1.0-preview.apk',bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),certificateSha256:sha256Cert,sourceCommit:commit,builtAt:new Date().toISOString(),supportedAbis:['arm64-v8a','x86_64'],classification:'standalone_preview_APK_not_production_release',limitations:['No owned rpId/whitelisted Origin configured.','Physical-device PRF, authenticated API, owner transactions and live trading are not verified.']};
await writeFile('artifacts/release.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
