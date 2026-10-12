import { createPasskeyWithPrfOutput, getPasskeyPrfOutput } from '@category-labs/mera';
import { verifyMessage } from 'viem';
import { deriveWallet } from '../packages/wallet/derive';

// Local test harness only. Never bundled into the Android app or public host.
let active: ReturnType<typeof deriveWallet> | null = null;
const rpId = location.hostname;
const message = 'Tready local virtual-authenticator test; no transaction or API authorization.';
function replace(prf: Uint8Array) {
  active?.session.end();
  const prfBytes = prf.length;
  active = deriveWallet(prf);
  return { address: active.address, prfBytes };
}
Object.assign(globalThis, {
  treadyPasskeyTest: {
    async create() {
      const result = await createPasskeyWithPrfOutput({
        rp: { id: rpId, name: 'Tready test only' },
        user: { name: 'Local test account', displayName: 'Local test account' }, timeout: 5000,
      });
      return { ...replace(result.prfOutput), credentialId: result.credentialId };
    },
    async restore(credentialId?: string) {
      const result = await getPasskeyPrfOutput({ rpId, timeout: 5000,
        ...(credentialId ? { credential: { credentialId } } : {}),
      });
      return { ...replace(result.prfOutput), credentialId: result.credentialId };
    },
    async signAndVerify() {
      if (!active) throw new Error('NO_TEST_SESSION');
      const signature = await active.account.signMessage({ message });
      return verifyMessage({ address: active.address, message, signature });
    },
    async lockAndTrySigning() {
      if (!active) throw new Error('NO_TEST_SESSION');
      active.session.end();
      try { await active.account.signMessage({ message }); return { rejected: false }; }
      catch { return { rejected: true }; }
    },
    async wrongRp() {
      try { await getPasskeyPrfOutput({ rpId: 'example.com', timeout: 1000 }); return { rejected: false }; }
      catch (error) { return { rejected: true, code: (error as { code?: string }).code }; }
    },
  },
});
