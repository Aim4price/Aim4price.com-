import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../lib/capture-requests.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const requestId = '11111111-1111-4111-8111-111111111111';
const assetId = '22222222-2222-4222-8222-222222222222';

function fixture(overrides = {}, locked = true) {
  const row = { id: requestId, public_reference: 'A4P-INV-TEST', request_type: 'invoice', submission_channel: 'dealer_upload',
    status: 'needs_information', owner_user_id: 'owner-one', submitted_by_user_id: 'dealer-one', asset_register_item_id: assetId,
    final_invoice_id: null, final_fuel_slip_id: null, version: 3, requester_note: 'Original instructions', ...overrides };
  const queries = [];
  const client = { release() {}, async query(sql, values = []) {
    queries.push({ sql, values });
    if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ locked }] };
    if (/update public.document_capture_requests/.test(sql)) { row.status = 'in_progress'; row.version++; }
    return { rows: sql.includes('from public.document_capture_requests') ? [row] : [] };
  } };
  const exports = {};
  vm.runInNewContext(compiled, { exports, Buffer, process, require(id) {
    if (id === './db') return { getDb: () => ({ connect: async () => client }) };
    if (id === './asset-usage') return {};
    return require(id);
  } });
  const input = { actor: { actorType: 'owner', userId: 'owner-one', displayName: 'Owner' }, action: 'reply', message: 'Use Tractor 2',
    expectedVersion: 3, expectedOwnerUserId: 'owner-one', expectedAssetId: assetId };
  return { send: (changes = {}) => exports.sendCaptureCustomerMessage(requestId, { ...input, ...changes }), queries };
}

test('reply returns the request to admin and records the message without a ledger write or approval', async () => {
  const f = fixture(); const result = await f.send();
  assert.equal(result.status, 'in_progress');
  assert.ok(f.queries.some(q => q.sql === 'commit'));
  const event = f.queries.find(q => q.sql.includes('insert into public.document_capture_events'));
  assert.equal(event.values[1], 'note_added');
  assert.equal(event.values[7], 'Customer reply: Use Tractor 2');
  assert.ok(!f.queries.some(q => /asset_invoices|fuel_slips|owner_approved/.test(q.sql + q.values.join(' '))));
});

test('owner correction is a message to admin, never owner approval', async () => {
  const f = fixture({ status: 'awaiting_owner' });
  assert.equal((await f.send({ action: 'correction' })).status, 'in_progress');
  assert.ok(f.queries.some(q => q.values.includes('Correction requested: Use Tractor 2')));
  assert.ok(!f.queries.some(q => q.values.includes('owner_approved')));
});

test('only the submitting dealer can reply, and a dealer cannot request an owner correction', async () => {
  await fixture().send({ actor: { actorType: 'dealer', userId: 'dealer-one', displayName: 'Dealer' } });
  await assert.rejects(fixture().send({ actor: { actorType: 'dealer', userId: 'other-dealer', displayName: 'Other' } }), /SCOPE_FORBIDDEN/);
  await assert.rejects(fixture({ status: 'awaiting_owner' }).send({ action: 'correction', actor: { actorType: 'dealer', userId: 'dealer-one', displayName: 'Dealer' } }), /STATUS_INVALID/);
});

test('wrong owners, moved assets, stale forms, completed outputs and concurrent finalization cannot mutate the request', async () => {
  const cases = [
    [fixture(), { actor: { actorType: 'owner', userId: 'other-owner', displayName: 'Other' } }, /SCOPE_FORBIDDEN/],
    [fixture(), { expectedAssetId: 'different-asset' }, /SCOPE_FORBIDDEN/],
    [fixture(), { expectedVersion: 2 }, /REQUEST_CHANGED/],
    [fixture({ status: 'completed' }), {}, /STATUS_INVALID/],
    [fixture({ final_invoice_id: 'existing-output' }), {}, /STATUS_INVALID/],
    [fixture({}, false), {}, /FINALIZATION_IN_PROGRESS/],
  ];
  for (const [f, input, error] of cases) {
    await assert.rejects(f.send(input), error);
    assert.ok(f.queries.some(q => q.sql === 'rollback'));
    assert.ok(!f.queries.some(q => q.sql.includes('update public.document_capture_requests')));
  }
});
