import {describe,expect,it,vi} from 'vitest';
import {base64urlnopad} from '@scure/base';
import {hexToBytes} from '@noble/hashes/utils.js';
import {hashTypedData,recoverTypedDataAddress} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import * as ed from '@noble/ed25519';
import {validateEnrollment,enroll,hasEnrollmentPolicy,type EnrollmentPolicy} from '../packages/perpl/enrollment';
import type {PerplHttp} from '../packages/perpl/http';
import {enrollmentPolicy as policy,enrollmentExpected as expected,enrollmentPayload,fixtureWallet as wallet} from './enrollment-fixture';
const payload=enrollmentPayload();
describe('enrollment authority checks',()=>{
  it('rejects missing policy before any API call or signature',async()=>{const request=vi.fn();const sign=vi.fn();await expect(enroll({request} as unknown as PerplHttp,expected.origin,wallet,sign,null,()=>true)).rejects.toThrow();expect(request).not.toHaveBeenCalled();expect(sign).not.toHaveBeenCalled();});
  it('rejects empty, incomplete and legacy policies before network/signing',async()=>{
    for(const value of [{},{...policy,expiryField:''},{...policy,verifyingContract:'invalid'},{...policy,types:undefined},{...policy,statement:'anything'}]){
      const request=vi.fn();const sign=vi.fn();const invalid=value as EnrollmentPolicy;
      expect(hasEnrollmentPolicy(value)).toBe(false);
      expect(()=>validateEnrollment(payload,invalid,expected)).toThrow('SCHEMA_CONFIRMATION_REQUIRED');
      await expect(enroll({request} as unknown as PerplHttp,expected.origin,wallet,sign,invalid,()=>true)).rejects.toThrow();
      expect(request).not.toHaveBeenCalled();expect(sign).not.toHaveBeenCalled();
    }
  });
  it('binds chain, wallet, key, scope and expiry to the requested authority',()=>{
    expect(()=>validateEnrollment(payload,policy,expected)).not.toThrow();
    expect(()=>validateEnrollment({...payload,domain:{...payload.domain,chainId:143}},policy,expected)).toThrow('DOMAIN');
    for(const mutation of [{signer:'0x'+'22'.repeat(20)},{scope:'1'},{publicKey:'0x'+'88'.repeat(32)},{expiresAt:String(expected.expiry+1)}])expect(()=>validateEnrollment({...payload,message:{...payload.message,...mutation}},policy,expected)).toThrow('CAPABILITY');
  });
  it('rejects extra, reordered, renamed, missing or changed type fields',()=>{
    const original=policy.types[policy.primaryType]!;
    const alternatives=[[...original,{name:'permit',type:'string'}],original.slice(1),[...original].reverse(),original.map((f,i)=>i===0?{...f,type:'string'}:f),original.map((f,i)=>i===0?{...f,name:'recipient'}:f)];
    for(const definitions of alternatives)expect(()=>validateEnrollment({...payload,types:{...payload.types,[policy.primaryType]:definitions}},policy,expected)).toThrow('TYPE');
    expect(()=>validateEnrollment({...payload,types:{...payload.types,Permit:[]}},policy,expected)).toThrow('TYPE');
    expect(()=>validateEnrollment({...payload,types:{[policy.primaryType]:original}},policy,expected)).toThrow('TYPE');
  });
  it('rejects extra unsigned fields as well as omitted signed fields',()=>{
    expect(()=>validateEnrollment({...payload,message:{...payload.message,extraAuthorization:'yes'}},policy,expected)).toThrow('FIELDS');
    expect(()=>validateEnrollment({...payload,domain:{...payload.domain,other:'value'}},policy,expected)).toThrow('FIELDS');
    const {origin,...rest}=payload.message;
    expect(()=>validateEnrollment({...payload,message:rest},policy,expected)).toThrow('FIELDS');
  });
  it('checks Origin, label, statement, CIDRs and all builder terms before signature',()=>{
    for(const change of [{origin:'https://unapproved.example'},{label:'other'},{statement:'Authorize other terms'},{ipCidrs:'0.0.0.0/0'},{builderId:'123'},{maxBuilderFeePer100K:'10000'}])expect(()=>validateEnrollment({...payload,message:{...payload.message,...change}},policy,expected)).toThrow('AUTHORITY');
    expect(()=>validateEnrollment(payload,policy,{...expected,origin:expected.origin+'/path'})).toThrow('AUTHORITY');
  });
  it('rejects malformed salt and expired/future challenge timestamps',()=>{
    expect(()=>validateEnrollment({...payload,domain:{...payload.domain,salt:'0x12'}},policy,expected)).toThrow('SALT');
    for(const time of [expected.requestedAt-60_001,expected.requestedAt+60_001])expect(()=>validateEnrollment({...payload,message:{...payload.message,time}},policy,expected,expected.requestedAt)).toThrow('CHALLENGE');
    expect(()=>validateEnrollment(payload,policy,expected,expected.requestedAt+120_001)).toThrow('CHALLENGE');
    expect(()=>validateEnrollment(payload,policy,{...expected,expiry:expected.requestedAt-1},expected.requestedAt)).toThrow();
  });
  it('copies validated data so later mutation cannot alter the approved authority',()=>{
    const input=enrollmentPayload();const checked=validateEnrollment(input,policy,expected);
    input.message.origin='https://mutated.example';expect((checked.message as Record<string,unknown>).origin).toBe(expected.origin);
  });
});
describe('observed vendor encodings',()=>{
  const encoded=base64urlnopad.encode(hexToBytes('77'.repeat(32)));
  const vendor={...payload,domain:{...payload.domain,chainId:'0x279f'},message:{...payload.message,publicKey:encoded,time:'0x'+expected.requestedAt.toString(16)}};
  it('accepts hex chain/time and base64url public key without changing values',()=>{expect(()=>validateEnrollment(vendor,policy,expected)).not.toThrow();});
  it('also accepts the original hex public key',()=>{expect(()=>validateEnrollment({...vendor,message:{...vendor.message,publicKey:expected.publicKey}},policy,expected)).not.toThrow();});
  it('rejects a base64url key for different bytes',()=>{expect(()=>validateEnrollment({...vendor,message:{...vendor.message,publicKey:base64urlnopad.encode(hexToBytes('88'.repeat(32)))}},policy,expected)).toThrow('CAPABILITY');});
  it('rejects hex for the wrong chain',()=>{expect(()=>validateEnrollment({...vendor,domain:{...vendor.domain,chainId:'0x27a0'}},policy,expected)).toThrow('DOMAIN');});
  it('rejects malformed key encodings',()=>{for(const publicKey of ['not-a-key','','z'.repeat(63)])expect(()=>validateEnrollment({...vendor,message:{...vendor.message,publicKey}},policy,expected)).toThrow('PUBLIC_KEY');});
});
describe('full mocked enrollment boundary',()=>{
  it('signs exact authority, verifies wallet and PoP, and binds the returned key',async()=>{
    // Public deterministic test signer; never funded or used by the app.
    const owner=privateKeyToAccount(('0x'+'01'.repeat(32)) as `0x${string}`);
    let challenge:ReturnType<typeof enrollmentPayload>|undefined;
    const request=vi.fn(async(target:string,options:{body:Record<string,unknown>})=>{
      const b=options.body;
      if(target.endsWith('/payload')){
        challenge=enrollmentPayload({...expected,wallet:owner.address,publicKey:String(b.public_key),scope:Number(b.scope_mask),expiry:Number(b.expires_at),requestedAt:Date.now()});
        return {typed_data:challenge,mac:'opaque-test-challenge'};
      }
      expect(b.typed_data).toEqual(challenge);expect(b.mac).toBe('opaque-test-challenge');
      const typed=b.typed_data as Parameters<typeof hashTypedData>[0];
      expect((await recoverTypedDataAddress({...typed,signature:b.signature as `0x${string}`})).toLowerCase()).toBe(owner.address.toLowerCase());
      expect(await ed.verifyAsync(hexToBytes(String(b.pop_signature).slice(2)),hexToBytes(hashTypedData(typed).slice(2)),hexToBytes(challenge!.message.publicKey.slice(2)))).toBe(true);
      return {api_key:{api_key:'synthetic-token',address:owner.address,scope_mask:3,expires_at:Number(challenge!.message.expiresAt),origin:expected.origin,label:expected.label,ip_cidrs:[]}};
    });
    const key=await enroll({request} as unknown as PerplHttp,expected.origin,owner.address,t=>owner.signTypedData(t),policy,()=>true);
    expect(key.wallet).toBe(owner.address);expect(request).toHaveBeenCalledTimes(2);key.secret.fill(0);
  });
  it('rejects altered authority before wallet signing or enroll request',async()=>{
    const sign=vi.fn();const request=vi.fn(async(_target:string,options:{body:Record<string,unknown>})=>{
      const data=enrollmentPayload({...expected,publicKey:String(options.body.public_key),expiry:Number(options.body.expires_at),requestedAt:Date.now()});
      return {typed_data:{...data,message:{...data.message,builderId:'5'}},mac:'test'};
    });
    await expect(enroll({request} as unknown as PerplHttp,expected.origin,wallet,sign,policy,()=>true)).rejects.toThrow('AUTHORITY');expect(sign).not.toHaveBeenCalled();expect(request).toHaveBeenCalledTimes(1);
  });
});
