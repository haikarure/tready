import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils.js';
import type { Journal, JournalRow, Command, RequestState } from '../../../packages/execution/coordinator';
import type { ApiCredential } from '../../../packages/perpl/auth';
import { decode, encode } from '../../../packages/perpl/codec';
import { canonical } from '../../../packages/domain/plan';

type StoredRow={id:string;account:string;kind:JournalRow['kind'];command:string;plan_id:string|null;status:RequestState;created_at:number;seen:number;reason:string|null};
const row=(r:StoredRow):JournalRow=>({id:r.id,account:r.account,kind:r.kind,command:decode(r.command) as Command,planId:r.plan_id,status:r.status,createdAt:r.created_at,nonFailureSeen:r.seen===1,reason:r.reason});
// Wire decode turns safe numeric fields back into numbers; normalize IDs on load.
const hydrate=(r:JournalRow):JournalRow=>({...r,command:{...r.command,rq:BigInt(r.command.rq),sn:BigInt(r.command.sn),acc:BigInt(r.command.acc),mkt:BigInt(r.command.mkt),s:BigInt(r.command.s),lb:BigInt(r.command.lb),...(r.command.p===undefined?{}:{p:BigInt(r.command.p)}),...(r.command.tp===undefined?{}:{tp:BigInt(r.command.tp)}),...(r.command.lp===undefined?{}:{lp:BigInt(r.command.lp)}),...(r.command.oid===undefined?{}:{oid:BigInt(r.command.oid)})}});
export class NativeStore implements Journal {
  private constructor(private db:SQLite.SQLiteDatabase){}
  static async open():Promise<NativeStore>{
    const db=await SQLite.openDatabaseAsync('tready-v1.db');
    await db.execAsync(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS counters(account TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,account TEXT NOT NULL,kind TEXT NOT NULL,command TEXT NOT NULL,plan_id TEXT,status TEXT NOT NULL,created_at INTEGER NOT NULL,seen INTEGER NOT NULL DEFAULT 0,reason TEXT);
      CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,kind TEXT NOT NULL,value TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS owner_transactions(hash TEXT PRIMARY KEY,action TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,value TEXT NOT NULL,created_at INTEGER NOT NULL);`);
    // No in-flight command is resent after process death.
    await db.runAsync("UPDATE requests SET status='unknown',reason='App restart: rekonsiliasi diperlukan.' WHERE status IN ('prepared','sent','forwarded')");
    return new NativeStore(db);
  }
  async prepare(account:string,last:bigint,kind:JournalRow['kind'],planId:string|null,create:(id:bigint)=>Command):Promise<JournalRow>{
    let result:JournalRow|undefined;
    await this.db.withExclusiveTransactionAsync(async tx=>{
      const old=await tx.getFirstAsync<{value:string}>('SELECT value FROM counters WHERE account=?',account);
      const local=BigInt(old?.value??0);const time=BigInt(Date.now());const rq=[local,last,time].reduce((a,b)=>a>b?a:b)+1n;
      const command=create(rq);if(command.acc.toString()!==account)throw new Error('ACCOUNT_MISMATCH');
      result={id:String(rq),account,kind,command,planId,status:'prepared',createdAt:Date.now(),nonFailureSeen:false,reason:null};
      await tx.runAsync('INSERT OR REPLACE INTO counters(account,value) VALUES(?,?)',account,String(rq));
      await tx.runAsync('INSERT INTO requests(id,account,kind,command,plan_id,status,created_at) VALUES(?,?,?,?,?,?,?)',result.id,account,kind,encode(command),planId,'prepared',result.createdAt);
    });
    if(!result)throw new Error('JOURNAL_COMMIT_FAILED');return result;
  }
  async update(id:string,status:RequestState,reason?:string,seen?:boolean):Promise<void>{
    await this.db.runAsync('UPDATE requests SET status=?,reason=COALESCE(?,reason),seen=COALESCE(?,seen) WHERE id=?',status,reason??null,seen===undefined?null:seen?1:0,id);
  }
  async rows():Promise<JournalRow[]>{return (await this.db.getAllAsync<StoredRow>('SELECT * FROM requests ORDER BY created_at DESC')).map(r=>hydrate(row(r)));}
  async unresolved(account:string):Promise<boolean>{return !!await this.db.getFirstAsync("SELECT id FROM requests WHERE account=? AND status IN ('prepared','sent','forwarded','unknown')",account);}
  async get<T>(key:string):Promise<T|null>{const r=await this.db.getFirstAsync<{value:string}>('SELECT value FROM meta WHERE key=?',key);return r?JSON.parse(r.value) as T:null;}
  async set(key:string,value:unknown):Promise<void>{await this.db.runAsync('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)',key,canonical(value));}
  async savePlan(id:string,value:unknown):Promise<void>{await this.db.runAsync('INSERT OR REPLACE INTO plans(id,value) VALUES(?,?)',id,canonical(value));}
  async plan(id:string):Promise<unknown|null>{const p=await this.db.getFirstAsync<{value:string}>('SELECT value FROM plans WHERE id=?',id);return p?JSON.parse(p.value):null;}
  async event(id:string,kind:string,value:unknown):Promise<boolean>{const result=await this.db.runAsync('INSERT OR IGNORE INTO events(id,kind,value,created_at) VALUES(?,?,?,?)',id,kind,canonical(value),Date.now());return result.changes>0;}
  async owner(hash:string,action:string,status:string):Promise<void>{await this.db.runAsync('INSERT INTO owner_transactions(hash,action,status,created_at) VALUES(?,?,?,?) ON CONFLICT(hash) DO UPDATE SET status=excluded.status',hash,action,status,Date.now());}
  async ownerPending():Promise<Array<{hash:string;action:string;status:string}>>{return this.db.getAllAsync("SELECT hash,action,status FROM owner_transactions WHERE status IN ('signed','sent','unknown')");}
  async receipt(id:string,value:unknown):Promise<void>{await this.db.runAsync('INSERT OR REPLACE INTO receipts(id,value,created_at) VALUES(?,?,?)',id,canonical(value),Date.now());}
  async receipts():Promise<Array<{id:string;value:string;created_at:number}>>{return this.db.getAllAsync('SELECT * FROM receipts ORDER BY created_at DESC LIMIT 30');}
}
const keyName=(wallet:string)=>`tready.10143.${wallet.toLowerCase()}.api`;
const secureOptions={requireAuthentication:true,authenticationPrompt:'Buka sesi trading Tready',keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
export async function saveKey(key:ApiCredential):Promise<void>{await SecureStore.setItemAsync(keyName(key.wallet),JSON.stringify({...key,secret:bytesToHex(key.secret)}),secureOptions);}
export async function loadKey(wallet:string):Promise<ApiCredential|null>{const raw=await SecureStore.getItemAsync(keyName(wallet),secureOptions);if(!raw)return null;const r=JSON.parse(raw) as Omit<ApiCredential,'secret'>&{secret:string};return {...r,secret:hexToBytes(r.secret)};}
