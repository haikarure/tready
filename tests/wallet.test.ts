import { describe,expect,it } from 'vitest';
import { recoverMessageAddress } from 'viem';
import { deriveWallet } from '../packages/wallet/derive';
describe('Mera derived owner lifecycle (synthetic PRF, no passkey/network)',()=>{
  it('restores the same identity and consumes the input PRF buffer',()=>{const input=new Uint8Array(32).fill(7);const a=deriveWallet(input);const b=deriveWallet(new Uint8Array(32).fill(7));expect(a.address).toBe(b.address);expect(input.every(n=>n===0)).toBe(true);a.session.end();b.session.end();});
  it('signs for the derived address and rejects every signature after lock',async()=>{const a=deriveWallet(new Uint8Array(32).fill(9));const signature=await a.account.signMessage({message:'Synthetic offline test; no authorization'});expect(await recoverMessageAddress({message:'Synthetic offline test; no authorization',signature})).toBe(a.address);a.session.end();await expect(a.account.signMessage({message:'after lock'})).rejects.toThrow();});
  it('never substitutes a random wallet when PRF is absent',()=>{expect(()=>deriveWallet(new Uint8Array(0))).toThrow('PRF');});
});
