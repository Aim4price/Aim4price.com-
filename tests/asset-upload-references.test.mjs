import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL(
  '../database/migrations/81-asset-upload-reference-guard.sql',
  import.meta.url,
);

const sql = await readFile(migrationPath, 'utf8');
const normalized = sql.replace(/\s+/g, ' ').toLowerCase();

test('migration is transactional, bounded, and requires migration 80', () => {
  assert.match(normalized, /begin;/);
  assert.match(normalized, /set local lock_timeout = '5s'/);
  assert.match(normalized, /set local statement_timeout = '5min'/);
  assert.match(normalized, /asset_upload_object_purge_queue/);
  assert.match(normalized, /requires migration 80/);
  assert.match(normalized, /commit;/);
});

test('ledger uses a deferred no-action foreign key and indexed upload id', () => {
  assert.match(normalized, /create table if not exists public\.asset_upload_references/);
  assert.match(normalized, /foreign key \(upload_id\)/);
  assert.match(normalized, /references public\.asset_register_uploads\(id\) on delete no action deferrable initially deferred/);
  assert.match(normalized, /asset_upload_references_upload_idx/);
  assert.match(normalized, /confdeltype = 'a'/);
  assert.match(normalized, /c\.condeferrable/);
  assert.match(normalized, /c\.condeferred/);
});

test('existing and newly inserted uploads receive independent holds', () => {
  assert.match(normalized, /'migration_81'/);
  assert.match(normalized, /'migration_hold'/);
  assert.match(normalized, /if initialized_at is null then/);
  assert.match(normalized, /holds_initialized_at is null/);
  assert.match(normalized, /asset_upload_pending_reference_trigger/);
  assert.match(normalized, /'pending_upload'/);
  assert.match(normalized, /interval '24 hours'/);

  // Migration 81 must never be the rollout that releases its own safety holds.
  assert.doesNotMatch(
    normalized,
    /delete from public\.asset_upload_references[^;]+reference_kind\s*=\s*'migration_hold'/,
  );
});

test('extractor recognizes supported upload references and verifies IDs', () => {
  assert.match(normalized, /function public\.asset_upload_candidate_ids_from_payload\(payload jsonb\)/);
  assert.match(normalized, /function public\.asset_upload_ids_from_payload\(payload jsonb\)/);
  assert.match(sql, /\/api\/asset-register\/uploads\//);
  assert.match(sql, /\[\^"\]\*upload_\?id/);
  assert.match(sql, /'upload_id'/);
  assert.match(sql, /invoice_upload_id/);
  assert.match(sql, /invoiceUploadId/);
  assert.match(sql, /'gi'/);
  assert.match(normalized, /do \$validate_extractor_contract\$/);
  assert.match(normalized, /upload_id_extra/);
  assert.match(normalized, /extractor contract validation failed/);
  assert.match(normalized, /join public\.asset_register_uploads as uploads/);
});

test('registry covers every known upload-bearing domain', () => {
  for (const table of [
    'asset_register_items',
    'asset_registers',
    'asset_scan_events',
    'marketplace_listings',
    'asset_invoice_documents',
    'asset_invoices',
    'fuel_slips',
    'fuel_storage_events',
    'fuel_ledger_audit_events',
    'asset_leads',
    'asset_accountant_documents',
    'asset_lifecycle_events',
    'account_profiles',
    'insurance_evidence',
    'insurance_workspace_assets',
  ]) {
    assert.match(normalized, new RegExp(`'public', '${table}'`));
  }
});

test('registered sources are locked, retriggered, and convergently backfilled', () => {
  assert.match(normalized, /function public\.sync_asset_upload_references\(\)/);
  assert.match(normalized, /lock table %i\.%i in share row exclusive mode/);
  assert.match(normalized, /asset_upload_reference_sync_trigger/);
  assert.match(normalized, /after insert or update or delete/);
  assert.match(normalized, /cross join lateral public\.asset_upload_ids_from_payload/);
  assert.match(normalized, /and reference_kind = 'source'/);
  assert.match(normalized, /trigger_installed_at = now\(\)/);
  assert.match(normalized, /backfilled_at = now\(\)/);
  assert.match(normalized, /verified_at = now\(\)/);
});

test('readiness and live-reference checks fail closed', () => {
  assert.match(normalized, /function public\.asset_upload_reference_ledger_ready\(\)/);
  assert.match(normalized, /function public\.asset_upload_has_live_reference\(target_upload_id text\)/);
  assert.match(normalized, /if not public\.asset_upload_reference_ledger_ready\(\) then return true/);
  assert.match(normalized, /failure to prove "unreferenced" means referenced/);
  assert.match(normalized, /exception when others then[^$]+return true/);
  assert.match(normalized, /cross join lateral public\.asset_upload_candidate_ids_from_payload/);
  assert.match(normalized, /function public\.asset_upload_prepare_for_deletion/);
  assert.match(normalized, /return not public\.asset_upload_has_live_reference/);
});

test('unregistered public tables receive a fail-closed catalog fallback scan', () => {
  assert.match(normalized, /function public\.asset_upload_has_unregistered_catalog_reference/);
  assert.match(normalized, /relation\.relkind in \('r', 'p'\)/);
  assert.match(normalized, /and not relation\.relispartition/);
  assert.match(normalized, /column_type in \( 'text'::regtype, 'varchar'::regtype, 'bpchar'::regtype, 'json'::regtype, 'jsonb'::regtype \)/);
  assert.match(normalized, /lower\(column_name\) ~ 'upload_\?id\$'/);
  assert.match(normalized, /asset_upload_candidate_ids_from_payload\(%s\)/);
  assert.match(normalized, /asset_upload_has_unregistered_catalog_reference\(target_upload_id\)/);
  assert.match(normalized, /to_regprocedure\('public\.asset_upload_has_unregistered_catalog_reference\(text\)'\) is null/);
  assert.match(normalized, /array_domain_base_type_name in \( 'text', 'varchar', 'bpchar', 'json', 'jsonb', 'citext' \)/);
  assert.match(normalized, /array_element_type_kind = 'd'/);
  assert.match(normalized, /domain_base_type\.typelem as domain_array_element_type/);
  assert.match(normalized, /domain_array_element_type_kind = 'd'/);
  assert.match(normalized, /domain_array_domain_base_type_name in \( 'text', 'varchar', 'bpchar', 'json', 'jsonb', 'citext' \)/);
  assert.match(normalized, /roles\.rolsuper or roles\.rolbypassrls/);
  assert.match(normalized, /relation\.relrowsecurity as row_security_enabled/);
  assert.match(normalized, /relation\.relforcerowsecurity as force_row_security/);
  assert.match(normalized, /not pg_catalog\.pg_has_role\(current_user, table_record\.owner_role, 'usage'\)/);
  assert.match(normalized, /a partial rls view can never prove that the upload is unreferenced/);
  assert.match(normalized, /exception when others then return true/);
  assert.doesNotMatch(normalized, /source_row\.[a-z0-9_]+::bytea/);
});

test('pending refresh and cancellation preserve fail-closed behavior', () => {
  assert.match(normalized, /function public\.asset_upload_refresh_pending_reference/);
  assert.match(normalized, /function public\.asset_upload_cancel_pending_reference/);
  assert.match(normalized, /references\.reference_kind = 'source'/);
  assert.match(normalized, /and reference_kind = 'pending'/);
  assert.match(normalized, /set deleted_at = null, purge_after = null/);
  assert.match(normalized, /cancelled because the upload acquired a durable reference/);
});

test('purge queue retains upload identity and holds unknown legacy rows', () => {
  assert.match(normalized, /add column if not exists upload_id text/);
  assert.match(normalized, /insert into public\.asset_upload_object_purge_queue \(object_key, upload_id, purge_after\)/);
  assert.match(normalized, /coalesce\(old\.purge_after, now\(\) \+ interval '30 days'\)/);
  assert.match(normalized, /purge_after = excluded\.purge_after/);
  assert.match(normalized, /legacy queue entry has no upload id/);
});

test('migration does not reclaim SQL space or contact an object bucket', () => {
  assert.doesNotMatch(normalized, /vacuum\s*\(\s*full/);
  assert.doesNotMatch(normalized, /deleteobject/);
  assert.doesNotMatch(normalized, /s3client/);
  assert.doesNotMatch(normalized, /bucket_endpoint/);
  assert.doesNotMatch(normalized, /storage_state\s*=\s*'object'/);
});

test('critical SQL lists contain no merge-duplicate tokens', () => {
  assert.doesNotMatch(normalized, /trigger_installed_at timestamptz, trigger_installed_at timestamptz/);
  assert.doesNotMatch(normalized, /reference_kind, expires_at, expires_at,/);
  assert.doesNotMatch(normalized, /from pg_catalog\.pg_constraint as c from pg_catalog\.pg_constraint as c/);

  assert.match(
    normalized,
    /insert into public\.asset_upload_references \( upload_id, source_schema, source_table, source_key, reference_kind, expires_at, first_seen_at, last_seen_at \) select found\.upload_id/,
  );
});
