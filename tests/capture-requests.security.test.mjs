import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const capture = read('lib/capture-requests.ts');
const migration = read('database/migrations/83-assisted-document-capture.sql');
const accountDeletion = read('lib/account-deletion.ts');

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

test('drop codes are revocable keyed hashes and plaintext is returned only on issue', () => {
  const dropCodeTable = migration.slice(
    migration.indexOf('create table if not exists public.asset_invoice_drop_codes'),
    migration.indexOf('create table if not exists public.document_capture_requests'),
  );
  assert.match(dropCodeTable, /code_hash text not null/i);
  assert.match(dropCodeTable, /code_last_four text not null/i);
  assert.doesNotMatch(dropCodeTable, /\bcode\s+text\b/i);
  assert.match(migration, /idx_asset_invoice_drop_codes_one_active_asset[\s\S]*?where is_active = true/i);
  assert.match(capture, /createHmac\('sha256', readInvoiceDropCodeSecret\(\)\)/);
  assert.match(capture, /configuredSecret\.length < 32 && process\.env\.NODE_ENV === 'production'/);
  assert.match(capture, /secret\.length < 32/);
  assert.match(capture, /resolveInvoiceDropCode[\s\S]*?where code_hash = \$1[\s\S]*?is_active = true/);
  const resolveBody = capture.slice(
    capture.indexOf('export async function resolveInvoiceDropCode'),
    capture.indexOf('export async function getActiveInvoiceDropCode'),
  );
  assert.doesNotMatch(resolveBody, /sender_|business_name|asset_title|owner_name/);
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
