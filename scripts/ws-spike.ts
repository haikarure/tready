import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { hexToBytes } from '@noble/hashes/utils.js';
import { encode, decode, record, safeNumber } from '../packages/perpl/codec';
import { signIn, type ApiCredential } from '../packages/perpl/auth';
import { TESTNET } from '../packages/perpl/config';

// Read-only WebSocket sign-in probe: authenticates the trading socket and records which
// message types arrive. Sends no order, cancel or any mutating command. The key file is
// discovered by pattern so no credential fragment is embedded in source.
const candidates = (await readdir('.')).filter(name => /^perpl-api-key.*\.txt$/.test(name));
const file = process.argv[2] ?? candidates[0];
if (!file) throw new Error('KEY_FILE_NOT_FOUND');
const raw = await readFile(file, 'utf8');
const token = raw.match(/API Key \(X-API-Key header\):\s*(\S+)/)?.[1];
const seed = raw.match(/0x[0-9a-fA-F]{64}/)?.[0];
if (!token || !seed) throw new Error('KEY_FILE_UNPARSED');
const key: ApiCredential = { token, secret: hexToBytes(seed.slice(2)), wallet: '0x0000000000000000000000000000000000000000', expiresAt: 0, scope: 3 };

const url = `${TESTNET.ws}/ws/v1/trading`;
const frame = await signIn(key);
const messages: Array<{ mt: number | null; addr: string | null; keys: string[] }> = [];
let opened = false;
let failure: string | null = null;

await new Promise<void>(resolve => {
  const socket = new WebSocket(url);
  const done = () => { try { socket.close(); } catch { /* already closed */ } resolve(); };
  const timer = setTimeout(done, 10_000);
  socket.onopen = () => { opened = true; socket.send(encode(frame)); };
  socket.onmessage = event => {
    try {
      const data = record(decode(String(event.data)));
      const mt = safeNumber(data.mt);
      messages.push({ mt: Number.isFinite(mt) ? mt : null, addr: typeof data.addr === 'string' ? data.addr : null, keys: Object.keys(data) });
      if (messages.length >= 6) { clearTimeout(timer); done(); }
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      clearTimeout(timer); done();
    }
  };
  socket.onerror = () => { failure = failure ?? 'socket error / handshake rejected'; clearTimeout(timer); done(); };
  socket.onclose = event => { failure = failure ?? `closed code=${event.code}`; clearTimeout(timer); done(); };
});

const report = {
  classification: 'read_only_authenticated_websocket_signin_probe',
  checkedAt: new Date().toISOString(),
  endpoint: url,
  opened,
  signInFrameMessageType: safeNumber(record(frame).mt),
  messages,
  failure,
  note: 'No order, cancel or mutating command was sent; only mt:29 sign-in and passive observation.',
};
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/ws-spike.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!messages.length) process.exitCode = 1;
