import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { hexToBytes } from '@noble/hashes/utils.js';
import { PerplHttp } from '../packages/perpl/http';
import { TESTNET } from '../packages/perpl/config';
import type { ApiCredential } from '../packages/perpl/auth';

// Read-only probe for a locally exported Perpl API key. Never places an order and never
// prints the token or secret: only endpoint outcome plus the wallet the venue binds to.
// The key file is discovered by pattern so no credential fragment is embedded in source.
const candidates = (await readdir('.')).filter(name => /^perpl-api-key.*\.txt$/.test(name));
const file = process.argv[2] ?? candidates[0];
if (!file) throw new Error('KEY_FILE_NOT_FOUND');
const raw = await readFile(file, 'utf8');
const token = raw.match(/API Key \(X-API-Key header\):\s*(\S+)/)?.[1];
const seed = raw.match(/0x[0-9a-fA-F]{64}/)?.[0];
if (!token || !seed) throw new Error('KEY_FILE_UNPARSED');

const key: ApiCredential = {
  token,
  secret: hexToBytes(seed.slice(2)),
  wallet: '0x0000000000000000000000000000000000000000',
  expiresAt: 0,
  scope: 3,
};

const targets = ['/v1/trading/wallet', '/v1/trading/orders', '/v1/trading/positions'];
const origins: Array<string | undefined> = [undefined, 'https://testnet.perpl.xyz'];

type Attempt = {
  target: string;
  origin: string | null;
  ok: boolean;
  error: string | null;
  topLevelKeys: string[];
  wallets: string[];
};

const attempts: Attempt[] = [];
const http = new PerplHttp();

for (const target of targets) {
  let answered = false;
  for (const origin of origins) {
    try {
      const value = await http.request(target, { key, ...(origin ? { origin } : {}) });
      const encoded = JSON.stringify(value ?? null);
      const attempt: Attempt = {
        target,
        origin: origin ?? null,
        ok: true,
        error: null,
        topLevelKeys: value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value as Record<string, unknown>) : [],
        wallets: [...new Set(encoded.match(/0x[0-9a-fA-F]{40}/g) ?? [])],
      };
      // Full payload stays on stdout only; balances/nonce are not written to the committed artifact.
      if (process.env.KEY_SPIKE_VERBOSE && target === '/v1/trading/wallet') console.error('WALLET_PAYLOAD ' + encoded);
      attempts.push(attempt);
      answered = true;
      break;
    } catch (error) {
      attempts.push({
        target,
        origin: origin ?? null,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        topLevelKeys: [],
        wallets: [],
      });
    }
  }
  if (!answered) continue;
}

const report = {
  classification: 'read_only_authenticated_probe_no_order_submission',
  checkedAt: new Date().toISOString(),
  endpointBase: TESTNET.api,
  credentialShape: '32-byte ed25519 seed, scope 3, expiresAt 0, placeholder wallet (wallet is not part of the REST signature)',
  note: 'A second attempt adds Origin: https://testnet.perpl.xyz to distinguish an invalid key from a per-key origin restriction.',
  attempts,
};
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/key-spike.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!attempts.some(a => a.ok)) process.exitCode = 1;
