import { mkdir, writeFile } from 'node:fs/promises';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { generateKey } from '../packages/perpl/auth';
import { PerplHttp, ApiError } from '../packages/perpl/http';
import { TESTNET } from '../packages/perpl/config';

// Probes ONLY /v1/api-key/payload, which returns an EIP-712 signing challenge. It does not
// create, enroll or activate a key: /v1/api-key/enroll is never called. A throwaway EVM key
// is used so the probe does not borrow any real wallet identity.
// Origins are interleaved and repeated so a transient first-attempt failure cannot be
// mistaken for an origin rule.
const origins: Array<string | null> = [
  null,
  'https://tready-archzxy.netlify.app',
  null,
  'https://tready-archzxy.netlify.app',
  'https://testnet.perpl.xyz',
  'https://tready-archzxy.netlify.app',
];

const probeAccount = privateKeyToAccount(generatePrivateKey());
const expiresAt = Date.now() + 24 * 60 * 60_000;
const http = new PerplHttp();

type Attempt = {
  seq: number;
  origin: string | null;
  ok: boolean;
  status: number | null;
  error: string | null;
  schema: {
    domain: Record<string, unknown> | null;
    primaryType: string | null;
    typeNames: string[];
    messageFields: Array<{ name: string; type: string }>;
  } | null;
};

const attempts: Attempt[] = [];
for (const origin of origins) {
  const seq = attempts.length;
  try {
    const { publicKey } = await generateKey();
    const response = (await http.request('/v1/api-key/payload', {
      method: 'POST',
      origin: origin ?? undefined,
      body: {
        chain_id: TESTNET.chainId,
        address: probeAccount.address,
        public_key: publicKey,
        scope_mask: 3,
        label: 'Tready origin probe',
        expires_at: expiresAt,
      },
    })) as Record<string, unknown>;
    const typed = (response.typed_data ?? {}) as Record<string, unknown>;
    const domain = (typed.domain ?? null) as Record<string, unknown> | null;
    const types = (typed.types ?? {}) as Record<string, unknown>;
    const primaryType = typeof typed.primaryType === 'string' ? typed.primaryType : null;
    const messageFields = (primaryType && Array.isArray(types[primaryType]) ? types[primaryType] : []) as Array<{ name: string; type: string }>;
    attempts.push({
      seq,
      origin,
      ok: true,
      status: 200,
      error: null,
      schema: {
        domain,
        primaryType,
        typeNames: Object.keys(types),
        messageFields: messageFields.map(f => ({ name: String(f.name), type: String(f.type) })),
      },
    });
  } catch (error) {
    attempts.push({
      seq,
      origin,
      ok: false,
      status: error instanceof ApiError ? error.status : null,
      error: error instanceof Error ? error.message : String(error),
      schema: null,
    });
  }
}

const report = {
  classification: 'origin_whitelist_probe_no_key_created',
  checkedAt: new Date().toISOString(),
  endpoint: '/v1/api-key/payload',
  probeWallet: probeAccount.address,
  notCalled: ['/v1/api-key/enroll'],
  note: 'Payload returns an unsigned EIP-712 challenge; no signature was submitted and no API key was created.',
  summary: attempts.map(a => ({ seq: a.seq, origin: a.origin, status: a.status })),
  attempts,
};
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/enroll-spike.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!attempts.some(a => a.ok)) process.exitCode = 1;
