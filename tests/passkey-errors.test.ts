import {describe,it,expect} from 'vitest';
import {passkeyFailureMessage} from '../packages/wallet/passkey-error';

describe('passkey provider failures',()=>{
  it('distinguishes native provider setup, missing credential, cancellation and PRF failures inside SDK causes',()=>{
    const wrapped=(code:string)=>({code:'PASSKEY_OPERATION_FAILED',cause:{code}});
    expect(passkeyFailureMessage(wrapped('NoCreateOption'))).toContain('Aktifkan provider');
    expect(passkeyFailureMessage({code:'PASSKEY_OPERATION_FAILED',cause:{error:'NoCreateOption',message:'No create option.'}})).toContain('Aktifkan provider');
    expect(passkeyFailureMessage(wrapped('NoCredentials'))).toContain('tidak ditemukan');
    expect(passkeyFailureMessage(wrapped('UserCancelled'))).toContain('dibatalkan');
    expect(passkeyFailureMessage({code:'PRF_UNAVAILABLE'})).toContain('PRF');
  });
  it('never copies unknown errors or sensitive native details, even with cyclic causes',()=>{
    const error:{message:string;code:string;cause?:unknown}={message:'secret PRF bytes synthetic',code:'UnknownError'};
    error.cause=error;
    const result=passkeyFailureMessage(error);
    expect(result).not.toContain(error.message);
    expect(result).not.toContain(error.code);
    expect(result).toContain('Periksa provider');
  });
});
