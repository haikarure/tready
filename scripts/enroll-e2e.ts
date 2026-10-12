import { mkdir, writeFile } from 'node:fs/promises';
import { hashTypedData, type TypedDataDefinition } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { generateKey, possessionSignature } from '../packages/perpl/auth';
import { PerplHttp, ApiError } from '../packages/perpl/http';
import { record, text, safeNumber } from '../packages/perpl/codec';
import { TESTNET } from '../packages/perpl/config';

// End-to-end enrollment probe against a throwaway EVM key: /v1/api-key/payload then
// /v1/api-key/enroll, never with an Origin header. The resulting key is bound to a freshly
// generated address nobody controls, so it cannot move funds; it exists only to prove the
// enrollment path is reachable and to reveal the real wire formats.
const http = new PerplHttp();
const owner = privateKeyToAccount(generatePrivateKey());
const { secret, publicKey } = await generateKey();
const expiresAt = Date.now() + 24 * 60 * 60_000;

const captured: Record<string, unknown> = {};
let typed: TypedDataDefinition | null = null;
let mac: string | null = null;

try {
  const response = record(await http.request('/v1/api-key/payload', {
    method: 'POST',
    body: {
      chain_id: TESTNET.chainId,
      address: owner.address,
      public_key: publicKey,
      scope_mask: 3,
      label: 'Tready enrollment probe',
      expires_at: expiresAt,
    },
  }));
  typed = response.typed_data as TypedDataDefinition;
  mac = text(response.mac);
  const message = record(typed.message);
  captured.message = message;
  captured.domain = record(typed.domain);
  captured.primaryType = typed.primaryType;
  captured.publicKeySent = publicKey;
  captured.expiresAtSent = expiresAt;
} catch (error) {
  const report = { classification: 'enrollment_probe_failed_at_payload', checkedAt: new Date().toISOString(), stage: 'payload', status: error instanceof ApiError ? error.status : null, error: error instanceof Error ? error.message : String(error) };
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/enroll-e2e.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  throw error;
}

const ownerSignature = await owner.signTypedData(typed!);
const popSignature = await possessionSignature(hashTypedData(typed!), secret);

let result: Record<string, unknown> | null = null;
let enrollError: string | null = null;
let enrollStatus: number | null = null;
try {
  result = record(await http.request('/v1/api-key/enroll', {
    method: 'POST',
    body: {
      chain_id: TESTNET.chainId,
      address: owner.address,
      typed_data: typed,
      mac,
      signature: ownerSignature,
      pop_signature: popSignature,
    },
  }));
} catch (error) {
  enrollError = error instanceof Error ? error.message : String(error);
  enrollStatus = error instanceof ApiError ? error.status : null;
}

// Prove the freshly enrolled key actually authenticates, and reveal the wallet it binds to.
let verification: Record<string, unknown> | null = null;
let verifyError: string | null = null;
const apiKey = result ? (record(result.api_key).api_key as unknown) : null;
if (typeof apiKey === 'string') {
  try {
    const wallet = record(await http.request('/v1/trading/wallet', {
      key: { token: apiKey, secret, wallet: owner.address, expiresAt, scope: 3 },
    }));
    verification = { ok: true, addr: wallet.addr, accounts: wallet.as };
  } catch (error) {
    verifyError = error instanceof Error ? error.message : String(error);
  }
}

const report = {
  classification: 'end_to_end_enrollment_probe_on_throwaway_wallet',
  checkedAt: new Date().toISOString(),
  noOriginHeaderSent: true,
  throwawayWallet: owner.address,
  scopeSent: 3,
  expiresAtSent: expiresAt,
  payload: {
    domain: captured.domain,
    primaryType: captured.primaryType,
    message: captured.message,
    publicKeySent: captured.publicKeySent,
  },
  enroll: {
    called: true,
    status: enrollStatus,
    error: enrollError,
    returnedApiKey: typeof apiKey === 'string',
    // Token is deliberately dropped: the artifact is committed and must stay secret-free.
    binding: (() => {
      if (!result) return null;
      const key = record(result.api_key);
      return { address: key.address, scope_mask: key.scope_mask, expires_at: key.expires_at, origin: key.origin };
    })(),
  },
  verification,
  verifyError,
  safeNumberProbe: (() => {
    // The vendor returns chainId as a hex string; safeNumber must be observed, not assumed.
    try {
      return { chainIdRaw: String(record(captured.domain ?? {}).chainId), safeNumberAccepts: safeNumber(String(record(captured.domain ?? {}).chainId)) };
    } catch (error) {
      return { chainIdRaw: String(record(captured.domain ?? {}).chainId), safeNumberAccepts: null, error: error instanceof Error ? error.message : String(error) };
    }
  })(),
  note: 'Key bound to a random unfunded wallet; it cannot move funds. Stored without any secret or token.',
};
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/enroll-e2e.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (typeof apiKey !== 'string' || !verification) process.exitCode = 1;
