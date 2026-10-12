import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { hexToBytes } from '@noble/hashes/utils.js';
import { PerplHttp } from '../packages/perpl/http';
import { TradingSocket, type SocketLike } from '../packages/perpl/socket';
import { applyInventory, emptyInventory } from '../packages/perpl/inventory';
import { record, safeNumber } from '../packages/perpl/codec';
import type { ApiCredential } from '../packages/perpl/auth';

// Read-only audit of production adapters using an already locally exported venue key.
// No enrollment, account mutation, trade command, origin substitution, or full payload logging.
const candidates = (await readdir('.')).filter(name => /^perpl-api-key.*\.txt$/.test(name));
if (candidates.length !== 1) throw new Error('AUDIT_EXPECTS_ONE_LOCAL_KEY_EXPORT');
const raw = await readFile(candidates[0]!, 'utf8');
const token = raw.match(/API Key \(X-API-Key header\):\s*(\S+)/)?.[1];
const seed = raw.match(/0x[0-9a-fA-F]{64}/)?.[0];
if (!token || !seed) throw new Error('KEY_FILE_UNPARSED');
const key: ApiCredential = { token, secret: hexToBytes(seed.slice(2)), wallet: '0x0000000000000000000000000000000000000000', expiresAt: 0, scope: 3 };
const http = new PerplHttp();
const results: Array<{ target: string; ok: boolean; mt?: number; error?: string }> = [];
let rest = emptyInventory('audit-rest');
for (const target of ['/v1/trading/wallet', '/v1/trading/orders', '/v1/trading/positions']) {
  try {
    const value = await http.request(target, { key });
    rest = applyInventory(rest, value, Date.now());
    results.push({ target, ok: true, mt: safeNumber(record(value).mt) });
  } catch (error) { results.push({ target, ok: false, error: error instanceof Error ? error.message : 'READ_FAILED' }); }
}
let inventory = emptyInventory('audit-ws');
let heartbeats = 0;
let disconnected = false;
let parseError: string | null = null;
let completed = false;
const messages: number[] = [];
const sentTypes: number[] = [];
let resolveDone!: () => void;
const done = new Promise<void>(resolve => { resolveDone = resolve; });
const socket = new TradingSocket(url => {
  const native = new WebSocket(url);
  const send = native.send.bind(native);
  native.send = data => {
    const mt = Number(JSON.parse(String(data)).mt);
    if (![1, 29].includes(mt)) throw new Error('AUDIT_WRITE_FRAME_FORBIDDEN');
    sentTypes.push(mt); send(data);
  };
  return native as unknown as SocketLike;
}, value => {
  try {
    const mt = safeNumber(record(value).mt); messages.push(mt);
    inventory = applyInventory(inventory, value, Date.now());
    if (mt === 100) heartbeats++;
    if (inventory.walletReady && inventory.ordersReady && inventory.positionsReady && heartbeats >= 3) { completed = true; resolveDone(); }
  } catch (error) { parseError = error instanceof Error ? error.message : 'DECODE_FAILED'; resolveDone(); }
}, () => { disconnected = true; resolveDone(); });
const timeout = setTimeout(resolveDone, 18_000);
try { await socket.connect(key); await done; }
finally { clearTimeout(timeout); socket.close(); key.secret.fill(0); }
const report = {
  checkedAt: new Date().toISOString(), classification: 'read_only_production_HTTP_socket_inventory_adapters_in_Node',
  rest: { results, allSnapshotsReady: rest.walletReady && rest.ordersReady && rest.positionsReady, accountCount: rest.accounts.length, orderCount: rest.orders.length, positionCount: rest.positions.length },
  websocket: { completed, disconnected, parseError, sentTypes, messages, heartbeats, allSnapshotsReady: inventory.walletReady && inventory.ordersReady && inventory.positionsReady, continuous: inventory.continuous, headPositive: inventory.head > 0n, accountCount: inventory.accounts.length, orderCount: inventory.orders.length, positionCount: inventory.positions.length },
  limitations: ['Venue-created key, not enrolled through Android/Mera.', 'Node transport, not native Android WebSocket or SecureStore.', 'No proof of actual trade scope, fills, triggers, owner actions, or nonempty position/order decoding.'],
};
await mkdir('artifacts/audit', { recursive: true });
await writeFile('artifacts/audit/transport.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!completed || parseError || !results.every(r => r.ok)) process.exitCode = 1;
