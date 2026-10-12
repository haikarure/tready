import {writeFile,mkdir} from 'node:fs/promises';
import {journalUpdate,recoverJournalSql} from '../packages/storage/transitions';
const statements=['CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,status TEXT,reason TEXT,seen INTEGER); DELETE FROM requests;'];
const literal=(v:string|number|null)=>v===null?'NULL':typeof v==='number'?String(v):`'${v.replaceAll("'","''")}'`;
function update(status:Parameters<typeof journalUpdate>[1],seen?:boolean){const q=journalUpdate('1',status,status,seen);let n=0;statements.push(q.sql.replaceAll('?',()=>literal(q.params[n++]!))+';');}
function start(){statements.push("DELETE FROM requests; INSERT INTO requests VALUES('1','prepared',NULL,0);");}
function check(name:string,status:string,seen:number){statements.push(`SELECT json_object('case',${literal(name)},'passed',status=${literal(status)} AND seen=${seen},'status',status,'seen',seen) FROM requests WHERE id='1';`);}
start();update('settled',true);for(const s of ['sent','forwarded','unknown','failed'] as const)update(s);check('confirmed outcome survives stale local/transport writes','settled',1);
start();update('forwarded');update('sent');check('forwarded survives delayed sent','forwarded',0);
start();update('failed');update('sent');update('forwarded');check('failure survives transport success','failed',0);update('settled',true);check('late venue success allowed','settled',1);
start();update('unknown');update('forwarded');check('unknown needs venue outcome','unknown',0);
statements.push("UPDATE requests SET status='sent',seen=1;",recoverJournalSql);check('restart repairs legacy confirmed status','settled',1);
await mkdir('.tooling/audit',{recursive:true});await writeFile('.tooling/audit/journal-probe.sql',statements.join('\n')+'\n');console.log('Production SQL probe generated; no secrets or real orders.');
