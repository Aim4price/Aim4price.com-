import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scriptPath = new URL(
  '../scripts/reconcile-asset-upload-references.mjs',
  import.meta.url,
);
const docsPath = new URL('../docs/railway-bucket-rollout.md', import.meta.url);

const script = await readFile(scriptPath, 'utf8');
const normalized = script.replace(/\s+/g, ' ').toLowerCase();
const docs = await readFile(docsPath, 'utf8');

test('reference reconciliation is dry-run by default and has two explicit apply confirmations', () => {
  assert.match(normalized, /const apply = process\.argv\.includes\('--apply'\)/);
  assert.match(script, /AIM4PRICE_ALLOW_REFERENCE_RECONCILIATION/);
  assert.match(script, /YES_I_REVIEWED_THE_DRY_RUN/);
  assert.match(script, /--confirm-catalog=/);
  assert.match(script, /--confirm-legacy-orphans=/);
});

test('apply is serialized, bounded, and uses the migration registry as its catalog', () => {
  assert.match(normalized, /pg_try_advisory_lock/);
  assert.match(normalized, /aim4price_asset_upload_reference_reconciliation/);
  assert.match(normalized, /begin isolation level repeatable read/);
  assert.match(normalized, /set local lock_timeout = '5s'/);
  assert.match(normalized, /set local statement_timeout = '5min'/);
  assert.match(normalized, /from public\.asset_upload_reference_sources/);
  assert.match(normalized, /asset_upload_ids_from_payload/);
});

test('catalog discovery audits every public text, JSON, relevant array and upload-id field', () => {
  assert.match(normalized, /from pg_catalog\.pg_class as relation/);
  assert.match(normalized, /join pg_catalog\.pg_attribute as attribute/);
  assert.match(normalized, /namespace\.nspname = 'public'/);
  assert.match(normalized, /relation\.relkind in \('r', 'p'\)/);
  assert.match(normalized, /'text'::regtype,[\s\S]*'varchar'::regtype,[\s\S]*'json'::regtype,[\s\S]*'jsonb'::regtype/);
  assert.match(normalized, /array_element_type in/);
  assert.match(normalized, /column_type_kind = 'd'/);
  assert.match(normalized, /domain_base_type\.typelem as domain_array_element_type/);
  assert.match(normalized, /domain_array_element_type_kind = 'd'/);
  assert.match(normalized, /domain_array_domain_base_type_name in/);
  assert.match(normalized, /lower\(column_name\) ~ 'upload_\?id\$'/);
  assert.match(normalized, /asset_upload_candidate_ids_from_payload/);
  assert.match(normalized, /asset_register_uploads',[\s\S]*asset_upload_references/);
});

test('unregistered discovered references are reported and make apply fail closed', () => {
  assert.match(script, /unregisteredSourceTables/);
  assert.match(normalized, /discovery\.unregisteredsourcetables\.map/);
  assert.match(normalized, /but is not registered in asset_upload_reference_sources/);
  assert.match(normalized, /catalogproblems: \[\.\.\.catalogproblems\(catalog\), \.\.\.discoveryproblems\(discovery\)\]/);
  assert.match(normalized, /if \(initialinspection\.catalogproblems\.length\)/);
  assert.match(normalized, /if \(stableinspection\.catalogproblems\.length\)/);
});

test('dangling discovered upload references also make apply fail closed', () => {
  assert.match(script, /missingUploadSourceTables/);
  assert.match(normalized, /discovery\.missinguploadsourcetables\.map/);
  assert.match(normalized, /whose asset_register_uploads metadata row is missing/);
  assert.match(docs, /A dangling internal upload URL or ID is[\s\S]*apply fails closed/);
});

test('registered discovery candidates must be representable by the migration row extractor', () => {
  assert.match(script, /registeredExtractorGaps/);
  assert.match(normalized, /untracked_registered_candidates as materialized/);
  assert.match(normalized, /asset_upload_candidate_ids_from_payload\(to_jsonb\(source_row\)\)/);
  assert.match(normalized, /that the migration 81 row extractor does not track/);
  assert.match(docs, /registeredExtractorGaps/);
});

test('row-level security cannot silently hide rows from reconciliation', () => {
  assert.match(normalized, /not relation\.relrowsecurity/);
  assert.match(normalized, /current_role_safety\.rolbypassrls/);
  assert.match(script, /incompleteVisibilityTables/);
  assert.match(normalized, /row-level security that can hide references/);
  assert.match(docs, /incompleteVisibilityTables/);
});

test('dry-run discovery reports counts without exposing bearer upload IDs', () => {
  assert.doesNotMatch(script, /sampleCandidateUploadIds|sampleMissingUploadIds/);
  assert.doesNotMatch(normalized, /jsonb_agg\(sample\.upload_id/);
});

test('apply locks discovered source tables before the upload table', () => {
  const sourceLock = normalized.indexOf('lock table ${relationsql(source)} in share row exclusive mode');
  const uploadLock = normalized.indexOf('lock table public.asset_register_uploads in share row exclusive mode');

  assert.ok(sourceLock >= 0, 'expected source-table lock');
  assert.ok(uploadLock > sourceLock, 'upload table must be locked after source tables');
});

test('legacy orphans receive a fixed grace hold and no upload data is deleted', () => {
  assert.match(normalized, /legacy_orphan_grace_hours = 24/);
  assert.match(normalized, /reference_kind = 'legacy_orphan_hold'/);
  assert.match(normalized, /interval '\$\{legacy_orphan_grace_hours\} hours'/);
  assert.doesNotMatch(normalized, /delete from public\.asset_register_uploads/);
  assert.doesNotMatch(normalized, /update public\.asset_register_uploads[\s\S]+set[\s\S]+data\s*=/);
});

test('script cannot initialise or contact object storage', () => {
  assert.doesNotMatch(script, /@aws-sdk/i);
  assert.doesNotMatch(normalized, /s3client|putobject|deleteobject|getobject|headobject/);
  assert.match(script, /bucketContacted: false/);
});

test('rollout guide documents the guarded database-only Stage 0.5', () => {
  assert.match(docs, /Stage 0\.5 — reconcile upload references without a Bucket/);
  assert.match(docs, /node scripts\/reconcile-asset-upload-references\.mjs/);
  assert.match(docs, /--confirm-catalog=/);
  assert.match(docs, /--confirm-legacy-orphans=/);
  assert.match(docs, /24-hour orphan grace/);
  assert.match(docs, /not deletion approval/);
  assert.match(docs, /unregisteredSourceTables/);
  assert.match(docs, /Apply fails closed/);
  assert.match(docs, /locks registered and catalog-audited source tables in deterministic order/);
  assert.match(docs, /AIM4PRICE_ALLOW_UPLOAD_PURGE=YES_I_REVIEWED_THE_DRY_RUN/);
  assert.match(docs, /AIM4PRICE_ALLOW_BUCKET_WRITES=YES_I_ACCEPT_COST/);
  assert.match(docs, /PostgreSQL-only upload rows[\s\S]*without Bucket variables/);
});
