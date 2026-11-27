import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const capture = read('lib/capture-requests.ts');
const migration = read('database/migrations/83-assisted-document-capture.sql');
const accountDeletion = read('lib/account-deletion.ts');
const retractionRoute = read('app/api/capture-requests/[requestId]/route.ts');
const adminCaptureTargets = read('lib/admin-capture-targets.ts');
const adminCaptureItemRoute = read('app/api/admin/capture-requests/[requestId]/route.ts');

test('capture workflow has separate constrained request, file, event and drop-code tables', () => {
  assert.match(migration, /create table if not exists public\.document_capture_requests/i);
  assert.match(migration, /create table if not exists public\.document_capture_files/i);
  assert.match(migration, /create table if not exists public\.document_capture_events/i);
  assert.match(migration, /create table if not exists public\.asset_invoice_drop_codes/i);
  assert.match(migration, /submission_channel in \('owner_upload', 'accountant_upload', 'dealer_upload', 'public_drop'\)/i);
  assert.match(migration, /'needs_matching'[\s\S]*?'awaiting_owner'[\s\S]*?'completed'/i);
  assert.match(migration, /due_at timestamptz not null default \(now\(\) \+ interval '24 hours'\)/i);
  assert.doesNotMatch(migration, /extraction_status\s+text/i);
});

test('matched capture targets are database-scoped to the recorded owner', () => {
  assert.match(migration, /foreign key \(asset_register_item_id, owner_user_id\)[\s\S]*?asset_register_items \(id, user_id\)/i);
  assert.match(migration, /foreign key \(fuel_storage_id, owner_user_id\)[\s\S]*?fuel_storage_units \(id, user_id\)/i);
  assert.match(migration, /document_capture_requests_asset_owner_fkey[\s\S]*?on delete set null \(asset_register_item_id\)/i);
  assert.match(migration, /document_capture_requests_fuel_owner_fkey[\s\S]*?on delete set null \(fuel_storage_id\)/i);
  assert.match(capture, /from public\.asset_register_items where id = \$1::uuid and user_id = \$2/);
  assert.match(capture, /from public\.fuel_storage_units where id = \$1::uuid and user_id = \$2/);
  assert.match(capture, /CAPTURE_DROP_CODE_MISMATCH/);
});

test('exact admin target hydration remains scoped to the recorded owner', () => {
  const exactTargetLookup = adminCaptureTargets.slice(
    adminCaptureTargets.indexOf('export function adminCaptureTargetKey'),
    adminCaptureTargets.indexOf('export async function searchAdminCaptureTargets'),
  );

  assert.match(exactTargetLookup, /if \(!ownerUserId \|\| Boolean\(assetId\) === Boolean\(fuelStorageId\)\) return null/);
  assert.match(exactTargetLookup, /export async function getAdminCaptureTargets/);
  assert.equal((exactTargetLookup.match(/select \* from unnest\(\$1::text\[\], \$2::text\[\]\)/g) ?? []).length, 2);
  assert.match(exactTargetLookup, /join public\.asset_register_items asset[\s\S]*?asset\.id::text = requested\.target_id[\s\S]*?asset\.user_id::text = requested\.owner_user_id/);
  assert.match(exactTargetLookup, /join public\.fuel_storage_units storage[\s\S]*?storage\.id::text = requested\.target_id[\s\S]*?storage\.user_id::text = requested\.owner_user_id[\s\S]*?storage\.status = 'active'/);
  assert.match(exactTargetLookup, /left join public\."user" auth_user on auth_user\.id = asset\.user_id/);
  assert.match(exactTargetLookup, /left join public\."user" auth_user on auth_user\.id = storage\.user_id/);
  assert.match(exactTargetLookup, /nullif\(auth_user\.name, ''\)[\s\S]*?nullif\(auth_user\.email, ''\)/);
  assert.match(exactTargetLookup, /getAdminCaptureTargets\(\[input\]\)/);
  assert.match(adminCaptureItemRoute, /getAdminCaptureTarget\(\{[\s\S]*?ownerUserId: request\.ownerUserId,[\s\S]*?assetId: request\.assetId,[\s\S]*?fuelStorageId: request\.fuelStorageId/);
  assert.match(adminCaptureItemRoute, /request: mapRequest\(request, matchedTarget\),[\s\S]*?matchedTarget,/);
});

test('admin target hydration keeps canonical usage metadata and exact serial aliases', () => {
  assert.match(adminCaptureTargets, /assetUsageMetric: "hours" \| "km" \| "percentage" \| "not_applicable" \| null/);
  assert.match(adminCaptureTargets, /assetUsageReading: number \| null/);
  assert.match(adminCaptureTargets, /assetUsageMetric: usage\?\.metric \?\? null/);
  assert.match(adminCaptureTargets, /assetUsageReading: usage\?\.value \?\? null/);

  for (const alias of ['serial_number', 'serial', 'vin', 'serialNumber']) {
    const occurrences = adminCaptureTargets.match(new RegExp(`to_jsonb\\(asset\\)->>'${alias}'`, 'g')) ?? [];
    assert.ok(occurrences.length >= 3, `${alias} must be included in canonical reference, metadata, and search`);
  }
});

test('only private quarantined, hashed and size-limited capture files may be catalogued', () => {
  assert.match(capture, /CAPTURE_STORAGE_KEY_PATTERN = \/\^v1\\\/capture-quarantine/);
  assert.match(capture, /MAX_CAPTURE_FILE_BYTES = 12 \* 1024 \* 1024/);
  assert.match(capture, /CAPTURE_FILE_CONTENT_TYPES = \[[\s\S]*?'application\/pdf'[\s\S]*?'image\/webp'/);
  assert.match(capture, /SHA256_PATTERN = \/\^\[0-9a-f\]\{64\}\$\//);
  assert.match(migration, /security_status text not null default 'pending'/i);
  assert.match(migration, /byte_size > 0 and byte_size <= 12582912/i);
  assert.match(migration, /unique \(capture_request_id, sha256\)/i);
  assert.match(capture, /setCaptureRequestFileSecurityStatus[\s\S]*?normalizeAdminActor/);
  assert.match(capture, /CAPTURE_FILE_SECURITY_PENDING/);
});

test('new capture requests reject the retired public channel before opening a transaction', () => {
  const create = capture.slice(capture.indexOf('export async function createCaptureRequest'), capture.indexOf('function normalizeCaptureFileInput'));
  const reject = create.indexOf("if (submissionChannel === 'public_drop') throw new Error('CAPTURE_CHANNEL_INVALID')");
  assert.ok(reject >= 0 && reject < create.indexOf('return withTransaction'));
});

test('all admin work is claimed, row-locked and actor-attributed', () => {
  assert.match(capture, /for update/);
  assert.match(capture, /CAPTURE_CLAIMED_BY_ANOTHER_ADMIN/);
  assert.match(capture, /assertClaimedBy\(existing, actor\)/g);
  assert.match(migration, /assigned_admin_user_id text/i);
  assert.match(migration, /actor_type text not null/i);
  assert.match(migration, /actor_user_id text/i);
  assert.match(migration, /actor_display_name text not null/i);
  assert.match(capture, /eventType: 'claimed'/);
  assert.match(capture, /eventType: 'draft_saved'/);
  assert.match(capture, /eventType: 'matched'/);
});

test('admin confirmation is bound to the exact current capture target', () => {
  const confirmation = adminCaptureItemRoute.slice(
    adminCaptureItemRoute.indexOf('function draftTargetIsConfirmed'),
    adminCaptureItemRoute.indexOf('export async function GET'),
  );

  assert.match(confirmation, /\.reverse\(\)[\s\S]*?event\.eventType === "matched"/);
  assert.match(confirmation, /latestMatch\.metadata\.ownerUserId[\s\S]*?target\.ownerUserId/);
  assert.match(confirmation, /latestMatch\.metadata\.assetId[\s\S]*?target\.assetId/);
  assert.match(confirmation, /latestMatch\.metadata\.fuelStorageId[\s\S]*?target\.fuelStorageId/);
  assert.match(confirmation, /target\.changed && !options\.confirmMatch[\s\S]*?CAPTURE_TARGET_CHANGE_REQUIRES_CONFIRMATION/);
  assert.match(confirmation, /if \(options\.confirmMatch\)[\s\S]*?matchCaptureRequest\(current\.id/);
  assert.match(adminCaptureItemRoute, /case "confirm_match":[\s\S]*?saveAdminDraft\(existing, draft, actor, \{ confirmMatch: true \}\)/);
  assert.match(adminCaptureItemRoute, /\["complete", "complete_direct", "update_usage"\]\.includes\(action\) && !draftTargetIsConfirmed\(existing, draft\)/);
  assert.match(capture, /eventType: 'matched'[\s\S]*?metadata: \{ ownerUserId, assetId, fuelStorageId \}/);
});

test('owner cancellation is limited to the matching owner-upload request', () => {
  assert.match(capture, /toStatus === 'cancelled' && actor\.actorType === 'owner'/);
  assert.match(capture, /row\.submission_channel !== 'owner_upload'/);
  assert.match(capture, /actor\.userId !== row\.owner_user_id/);
  assert.match(retractionRoute, /ownerAppCan\(resolved\.access, 'manage_finance'\)/);
  assert.match(retractionRoute, /capture\.submissionChannel !== 'owner_upload'/);
  assert.match(retractionRoute, /retractCaptureRequestForOwner/);
});

test('a completed request has one idempotent canonical output in the same owner scope', () => {
  assert.match(migration, /status = 'completed'[\s\S]*?request_type = 'invoice'[\s\S]*?final_invoice_id is not null/i);
  assert.match(migration, /request_type = 'fuel_slip'[\s\S]*?final_fuel_slip_id is not null/i);
  assert.match(migration, /idx_document_capture_requests_final_invoice[\s\S]*?where final_invoice_id is not null/i);
  assert.match(migration, /idx_document_capture_requests_final_fuel_slip[\s\S]*?where final_fuel_slip_id is not null/i);
  assert.match(capture, /status === 'completed'[\s\S]*?sameOutput[\s\S]*?CAPTURE_ALREADY_COMPLETED/);
  assert.match(capture, /from public\.asset_invoices[\s\S]*?user_id = \$2[\s\S]*?asset_register_item_id = \$3::uuid/);
  assert.match(capture, /from public\.fuel_slips[\s\S]*?user_id = \$2/);
  assert.match(capture, /CAPTURE_OWNER_APPROVAL_REQUIRED/);
});

test('capture payloads redact payment secrets before persistence', () => {
  assert.match(capture, /export function redactCapturePayload/);
  assert.match(capture, /cvv\|cvc\|card_verification_value\|card_security_code/);
  assert.match(capture, /'\[REDACTED\]'/);
  assert.match(capture, /\*\*\*\*\*\*\*\*\*\*\*\*\$\{digits\.slice\(-4\)\}/);
  assert.match(capture, /JSON\.stringify\(normalizePayload\(input\.metadata\)\)/);
  assert.match(capture, /JSON\.stringify\(candidatePayload\)/);
});

test('owner and dealer list filters are explicit and parameterized', () => {
  assert.match(capture, /ownerUserId\?: string \| null/);
  assert.match(capture, /submittedByUserId\?: string \| null/);
  assert.match(capture, /request\.owner_user_id = \$\{add\(ownerUserId\)\}/);
  assert.match(capture, /request\.submitted_by_user_id = \$\{add\(submittedByUserId\)\}/);
  assert.doesNotMatch(capture, /request\.submitted_by_user_id = ['"]\$\{/);
});

test('account deletion unlinks canonical provenance before removing private capture workflow data', () => {
  assert.match(accountDeletion, /update asset_invoice_documents[\s\S]*?set capture_request_id = null/);
  assert.match(accountDeletion, /update asset_invoices[\s\S]*?set capture_request_id = null/);
  assert.match(accountDeletion, /update fuel_slips[\s\S]*?set capture_request_id = null/);
  assert.ok(accountDeletion.indexOf('delete from document_capture_events') < accountDeletion.indexOf('delete from document_capture_requests'));
  assert.ok(accountDeletion.indexOf('delete from document_capture_files') < accountDeletion.indexOf('delete from document_capture_requests'));
  assert.match(accountDeletion, /delete from asset_invoice_drop_codes where owner_user_id = \$1/);
});
