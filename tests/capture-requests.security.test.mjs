import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const capture = read('lib/capture-requests.ts');
const migration = read('database/migrations/83-assisted-document-capture.sql');
const ownerWideDropCodeMigration = read('database/migrations/87-owner-wide-invoice-drop-codes.sql');
const accountDeletion = read('lib/account-deletion.ts');
const retractionRoute = read('app/api/capture-requests/[requestId]/route.ts');

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

test('public submissions require identity but never get a public request-detail lookup', () => {
  assert.match(migration, /document_capture_requests_public_identity_check/i);
  assert.match(capture, /CAPTURE_PUBLIC_IDENTITY_REQUIRED/);
  assert.match(capture, /CAPTURE_ASSET_REFERENCE_REQUIRED/);
  assert.match(capture, /initialStatus:[\s\S]*?'needs_matching'/);
  assert.match(capture, /getCaptureRequestDetail\([\s\S]*?UUID_PATTERN\.test\(normalized\)/);
  assert.doesNotMatch(capture, /getCaptureRequestByPublicReference|publicReference:\s*string\)[\s\S]*?select/);
});

test('drop codes remain revocable keyed hashes while owner viewing uses a verified server derivation', () => {
  const dropCodeTable = migration.slice(
    migration.indexOf('create table if not exists public.asset_invoice_drop_codes'),
    migration.indexOf('create table if not exists public.document_capture_requests'),
  );
  assert.match(dropCodeTable, /code_hash text not null/i);
  assert.match(dropCodeTable, /code_last_four text not null/i);
  assert.doesNotMatch(dropCodeTable, /\bcode\s+text\b/i);
  assert.match(migration, /idx_asset_invoice_drop_codes_one_active_asset[\s\S]*?where is_active = true/i);
  assert.match(capture, /createHmac\('sha256', readInvoiceDropCodeSecret\(\)\)/);
  assert.match(capture, /randomUUID\(\)/);
  assert.match(capture, /invoice-drop-code:v2:\$\{dropCodeId\}/);
  assert.match(capture, /timingSafeEqual/);
  assert.match(capture, /export async function revealActiveInvoiceDropCode/);
  assert.match(capture, /invoiceDropCodeHashMatches\(candidate, row\.code_hash\)/);
  assert.match(capture, /insert into public\.asset_invoice_drop_codes \([\s\S]*?id,[\s\S]*?code_hash/);
  assert.match(capture, /configuredSecret\.length < 32 && process\.env\.NODE_ENV === 'production'/);
  assert.match(capture, /secret\.length < 32/);
  assert.match(capture, /resolveInvoiceDropCode[\s\S]*?where code_hash = \$1[\s\S]*?is_active = true/);
  const resolveBody = capture.slice(
    capture.indexOf('export async function resolveInvoiceDropCode'),
    capture.indexOf('function normalizeInvoiceDropAssetSearch'),
  );
  assert.doesNotMatch(resolveBody, /sender_|business_name|asset_title|owner_name/);
});

test('owner-wide drop codes stay owner-scoped without exposing a browseable asset list', () => {
  assert.match(ownerWideDropCodeMigration, /alter column asset_register_item_id drop not null/i);
  assert.match(ownerWideDropCodeMigration, /idx_asset_invoice_drop_codes_one_active_asset[\s\S]*?asset_register_item_id is not null/i);
  assert.match(ownerWideDropCodeMigration, /idx_asset_invoice_drop_codes_one_active_owner[\s\S]*?owner_user_id[\s\S]*?asset_register_item_id is null/i);
  assert.match(capture, /asset_register_item_id is not distinct from \$2::uuid/);

  const ownerSearch = capture.slice(
    capture.indexOf('export async function resolveUniqueOwnerInvoiceDropAsset'),
    capture.indexOf('export async function searchInvoiceDropAssetByCode'),
  );
  assert.match(ownerSearch, /where asset\.user_id = \$1/);
  assert.match(ownerSearch, /from unnest\(\$2::text\[\]\) as token/);
  assert.match(ownerSearch, /public_asset_code[\s\S]*?license_registration_number[\s\S]*?fleet_number/);
  assert.match(ownerSearch, /limit 2/);
  assert.match(ownerSearch, /result\.rows\.length !== 1/);
  assert.doesNotMatch(ownerSearch, /return result\.rows\.map|matches:/);
});

test('public serial and VIN matching is exact, unique and private', () => {
  const resolver = capture.slice(
    capture.indexOf('export async function resolveUniqueAssetSerialOrVin'),
    capture.indexOf('export async function getActiveInvoiceDropCode'),
  );
  assert.match(resolver, /from public\.asset_register_items asset/);
  assert.match(resolver, /serial_number[\s\S]*?serial[\s\S]*?vin/);
  assert.match(resolver, /regexp_replace/);
  assert.match(resolver, /limit 2/);
  assert.match(resolver, /result\.rows\.length !== 1/);
  assert.doesNotMatch(resolver, /ilike|brand_name\s*=|model_name\s*=/i);
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
