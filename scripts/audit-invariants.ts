import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { validateEnrollment, ENROLLMENT_DOMAIN_FIELDS, ENROLLMENT_STATEMENT, type EnrollmentPolicy } from '../packages/perpl/enrollment';
import { Coordinator, requestOutcome, type ExecutionContext } from '../packages/execution/coordinator';
import { MemoryJournal } from '../packages/storage/memory';
import { approve } from '../packages/domain/plan';
import { order, position, emptyInventory } from '../packages/perpl/inventory';
import { protection, workflow } from '../packages/execution/workflow';
import { makePlan, o, p } from '../tests/fixtures';

// Offline audit reproductions only. Never signs, enrolls, sends a real order, or reads secrets.
const probe = JSON.parse(await readFile('artifacts/enroll-e2e.json', 'utf8'));
const schemas = JSON.parse(await readFile('artifacts/enroll-spike.json', 'utf8'));
const fields = schemas.attempts.find((a: { schema: unknown }) => a.schema)?.schema.messageFields;
const primaryType = probe.payload.primaryType;
const policy: EnrollmentPolicy = {
  domainName: 'perpl.xyz', domainVersion: '1',
  verifyingContract: '0x0000000000000000000000000000000000000000',
  primaryType, addressField: 'signer', publicKeyField: 'publicKey', scopeField: 'scope', expiryField: 'expiresAt',
  types:{EIP712Domain:ENROLLMENT_DOMAIN_FIELDS,[primaryType]:fields},statement:ENROLLMENT_STATEMENT,
};
const now=Date.now();
const expected = {
  wallet: probe.throwawayWallet, publicKey: probe.payload.publicKeySent,
  scope: probe.scopeSent, expiry: now+86_400_000, origin:'https://tready-archzxy.netlify.app',label:'Tready Android testnet',requestedAt:now,
};
const payload = {
  domain: probe.payload.domain, primaryType,
  message: { ...probe.payload.message, origin: expected.origin,label:expected.label,expiresAt:String(expected.expiry),time:now },
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' }, { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' },
      { name: 'salt', type: 'bytes32' },
    ],
    [primaryType]: fields,
  },
};
function accepted(value: unknown): boolean {
  try { validateEnrollment(value, policy, expected); return true; } catch { return false; }
}
assert(accepted(payload), 'baseline vendor-shaped payload must pass before mutation probes');
const mutations = [
  { name: 'unexpected_origin', value: { ...payload, message: { ...payload.message, origin: 'https://unapproved.example' } } },
  { name: 'unexpected_builder_fee', value: { ...payload, message: { ...payload.message, builderId: '123', maxBuilderFeePer100K: '10000' } } },
  { name: 'changed_primary_type_fields', value: { ...payload, types: { ...payload.types, [primaryType]: [...fields, { name: 'extraAuthorization', type: 'string' }] }, message: { ...payload.message, extraAuthorization: 'unexpected' } } },
];
const enrollment = mutations.map(m => ({ mutation: m.name, accepted: accepted(m.value), desiredAccepted: false }));
assert(enrollment.every(m=>!m.accepted),'Unauthorized enrollment mutation must be rejected');

// Inject an allowed asynchronous completion order: the venue outcome commits before a delayed
// local 'sent' write. This reproduces the state regression, not its frequency on native SQLite.
const journal = new MemoryJournal();
const originalUpdate = journal.update.bind(journal);
let settledBeforeSent = false;
journal.update = async (id, status, reason, seen) => {
  if (status === 'sent') {
    await originalUpdate(id, 'settled', 'Injected fast venue outcome', true);
    settledBeforeSent = (await journal.rows())[0]?.status === 'settled';
  }
  await originalUpdate(id, status, reason, seen);
};
const context: ExecutionContext = {
  sessionId: 's', live: true, fresh: true, accountFlat: true, lastForwarded: 7n, head: 100n,
  configDigest: 'config', wallet: '0x1111111111111111111111111111111111111111', accountId: '42',
};
const plan = makePlan();
let syntheticSends = 0;
await new Coordinator(journal, () => { syntheticSends++; }).entry(plan, approve(plan, 's', 1000), context, 20n, 2000);
const row = (await journal.rows())[0]!;
const replayOutcome = requestOutcome(row, order({ ...o, rq: Number(row.id), acc: Number(row.account) }));
const execution = {
  faultInjected: true, settledBeforeSent, finalStatus: row.status, nonFailureSeen: row.nonFailureSeen,
  unresolved: await journal.unresolved(context.accountId), laterOutcomeIgnored: replayOutcome === null,
  syntheticSends, realNetworkRequests: 0,
};
assert(row.status==='settled'&&row.nonFailureSeen&&!execution.unresolved,'Confirmed journal outcome must survive a late sent write');
const fullPosition = position(p);
const undersizedStop = order({ ...o, os: 1 });
const inventory = {
  ...emptyInventory('offline'), continuous: true, positionsReady: true, ordersReady: true,
  positions: [fullPosition], orders: [undersizedStop],
};
const stopCoverage = {
  positionLots: fullPosition.size.toString(), stopOriginalLots: undersizedStop.size.toString(),
  registered: protection(fullPosition, [undersizedStop]) !== null,
  workflow: workflow(inventory, [], fullPosition.account.toString()),
  desired: 'Show partial protection and enable a deliberate repair flow, rather than classify the whole position as active.',
};
assert(!stopCoverage.registered&&stopCoverage.workflow==='partial-protection','Undersized stop must permit deliberate protection repair');
const report = {
  checkedAt: new Date().toISOString(), classification: 'audit_regression_checks_no_signatures_or_network',success:true,
  enrollment: { baselineAccepted: accepted(payload), mutations: enrollment }, execution, stopCoverage,
  limitations: ['Journal race uses injected write ordering; native SQLite timing was not measured.', 'Enrollment mutations are local objects; no vendor request or wallet signature was made.'],
};
await mkdir('artifacts/remediation', { recursive: true });
await writeFile('artifacts/remediation/invariants.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
