import {describe,expect,it,vi} from 'vitest';
import {validateEnrollment,enroll,type EnrollmentPolicy} from '../packages/perpl/enrollment';
import type {PerplHttp} from '../packages/perpl/http';
const wallet='0x1111111111111111111111111111111111111111' as const;
const expected={wallet,publicKey:'0x'+'77'.repeat(32),scope:3,expiry:1791800000000};
const policy:EnrollmentPolicy={domainName:'Synthetic Test Only',domainVersion:'1',verifyingContract:'0x2222222222222222222222222222222222222222',primaryType:'EnrollTest',addressField:'wallet',publicKeyField:'key',scopeField:'scope',expiryField:'expiry'};
const payload={domain:{name:policy.domainName,version:'1',chainId:10143,verifyingContract:policy.verifyingContract},primaryType:'EnrollTest',types:{EnrollTest:[{name:'wallet',type:'address'},{name:'key',type:'bytes32'},{name:'scope',type:'uint8'},{name:'expiry',type:'uint64'}]},message:{wallet,key:expected.publicKey,scope:3,expiry:expected.expiry}};
describe('enrollment authority checks (synthetic schema)',()=>{
  it('rejects missing policy before any API call or signature',async()=>{const request=vi.fn();const sign=vi.fn();await expect(enroll({request} as unknown as PerplHttp,'https://synthetic.example',wallet,sign,null,()=>true)).rejects.toThrow();expect(request).not.toHaveBeenCalled();expect(sign).not.toHaveBeenCalled();});
  it('binds typed-data chain, wallet, key, scope and expiry to approved fields',()=>{expect(()=>validateEnrollment(payload,policy,expected)).not.toThrow();expect(()=>validateEnrollment({...payload,domain:{...payload.domain,chainId:143}},policy,expected)).toThrow('DOMAIN');expect(()=>validateEnrollment({...payload,message:{...payload.message,scope:1}},policy,expected)).toThrow('CAPABILITY');expect(()=>validateEnrollment({...payload,message:{...payload.message,key:'0x'+'88'.repeat(32)}},policy,expected)).toThrow('CAPABILITY');});
  it('blocks injected type graphs rather than signing a permit',()=>{expect(()=>validateEnrollment({...payload,types:{...payload.types,Permit:[{name:'spender',type:'address'}]}},policy,expected)).toThrow('TYPE');});
});
