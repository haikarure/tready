import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

// Scan the prospective public source and Git history without logging secret material.
const secrets:Array<{kind:string;value:string}>=[];
for(const file of (await readdir('.')).filter(f=>/^perpl-api-key.*\.txt$/.test(f))){
  const raw=await readFile(file,'utf8');const token=raw.match(/API Key \(X-API-Key header\):\s*(\S+)/)?.[1];const seed=raw.match(/0x[0-9a-fA-F]{64}/)?.[0];
  if(token)secrets.push({kind:'venue token',value:token});if(seed){secrets.push({kind:'venue seed',value:seed.toLowerCase()},{kind:'venue seed',value:seed.slice(2).toLowerCase()});}
}
try{const value=(await readFile('.tooling/keys/preview.password','utf8')).trim();if(value)secrets.push({kind:'signing password',value});}catch{}
const paths=execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
let checked=0;
function inspect(data:Buffer,label:string){const raw=data.toString('utf8');for(const secret of secrets)if(secret.value.length>20&&(raw.includes(secret.value)||raw.toLowerCase().includes(secret.value.toLowerCase())))throw new Error(`PUBLICATION_SECRET_DETECTED (${secret.kind}; ${label})`);if(/gh[pousr]_[A-Za-z0-9]{30,}/.test(raw))throw new Error(`PUBLICATION_TOKEN_PATTERN_DETECTED (${label})`);checked++;}
for(const file of new Set(paths))inspect(await readFile(file),file);
const objects=execFileSync('git',['rev-list','--objects','--all'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const item of objects){const id=item.split(' ')[0]!;if(execFileSync('git',['cat-file','-t',id],{encoding:'utf8'}).trim()==='blob')inspect(execFileSync('git',['cat-file','blob',id]),`Git blob ${id}`);}
console.log(JSON.stringify({success:true,checkedFilesAndBlobs:checked,secretValuesPrinted:false,historyChecked:true}));
