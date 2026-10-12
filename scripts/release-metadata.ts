import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import type { ExpoConfig } from 'expo/config';
import { hasEnrollmentPolicy } from '../packages/perpl/enrollment';
const apk=process.argv[2]??'apps/android/android/app/build/outputs/apk/release/app-release.apk';const data=await readFile(apk);
// Read the installed artifact, not current environment or TS module interop.
const config=JSON.parse(execFileSync('unzip',['-p',apk,'assets/app.config'],{encoding:'utf8'})) as ExpoConfig;
const badging=execFileSync('.tooling/android-sdk/build-tools/36.0.0/aapt',['dump','badging',apk],{encoding:'utf8'});
const packageName=badging.match(/package: name='([^']+)'/)?.[1];
const build=Number(badging.match(/versionCode='(\d+)'/)?.[1]);
if(packageName!==config.android?.package||build!==config.android?.versionCode||!config.version)throw new Error('APK_CONFIG_MISMATCH');
const output=execFileSync('.tooling/android-sdk/build-tools/36.0.0/apksigner',['verify','--verbose','--print-certs',apk],{encoding:'utf8'});
const fingerprint=output.match(/certificate SHA-256 digest: ([0-9a-f]+)/i)?.[1];
if(!fingerprint||fingerprint.length!==64)throw new Error('APK_CERTIFICATE_UNVERIFIED');
const sha256Cert=fingerprint.toUpperCase().match(/.{2}/g)!.join(':');
const association=[{relation:['delegate_permission/common.get_login_creds'],target:{namespace:'android_app',package_name:'xyz.tready.app',sha256_cert_fingerprints:[sha256Cert]}}];
const associationJson=JSON.stringify(association,null,2)+'\n';
await mkdir('apps/access/public/.well-known',{recursive:true});await writeFile('apps/access/public/.well-known/assetlinks.json',associationJson);
// Netlify ZIP deploys can omit dot directories. A static internal rewrite
// serves the same signed association from a root JSON file with HTTP200.
await writeFile('apps/access/public/assetlinks.json',associationJson);
let commit='uncommitted';try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
const report={version:config.version,build,package:packageName,network:'Monad Testnet',chainId:10143,file:apk.split('/').at(-1)!,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),certificateSha256:sha256Cert,sourceCommit:commit,builtAt:new Date().toISOString(),rpId:config.extra?.rpId??'',origin:config.extra?.origin??'',enrollmentConfigured:hasEnrollmentPolicy(config.extra?.enrollmentPolicy),supportedAbis:['arm64-v8a','x86_64'],classification:'standalone_preview_APK_not_production_release',limitations:['Authenticated reads were verified in Node; native owner transactions and live trading are not verified.','Native PRF/provider, hardware biometrics and provider sync require separate verification.']};
await writeFile('artifacts/release.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
