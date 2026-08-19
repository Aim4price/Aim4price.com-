import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../database/migrations/81-add-new-bucket-upload-catalog.sql', import.meta.url),
  'utf8',
);

const normalized = migration.replace(/\s+/g, ' ').toLowerCase();
const executable = migration
  .replace(/--.*$/gm, '')
  .replace(/\s+/g, ' ')
  .toLowerCase();
const tableDefinition = normalized.slice(
  normalized.indexOf('create table if not exists public.asset_register_bucket_uploads'),
  normalized.indexOf('do $validate_catalog$'),
);
const stateContract = tableDefinition.slice(
  tableDefinition.indexOf('constraint asset_register_bucket_uploads_state_metadata_check'),
);
const queueDefinition = normalized.slice(
  normalized.indexOf('create table if not exists public.asset_register_bucket_upload_purge_queue'),
  normalized.indexOf('do $validate_purge_queue$'),
);
const triggerFunction = normalized.slice(
  normalized.indexOf('create or replace function public.queue_deleted_bucket_upload()'),
  normalized.indexOf('do $install_delete_trigger$'),
);
const deletedAccountsDefinition = normalized.slice(
  normalized.indexOf('create table if not exists public.asset_register_bucket_deleted_accounts'),
  normalized.indexOf('do $validate_deleted_accounts$'),
);

test('migration is bounded, transactional, additive, and migration-80 aware', () => {
  assert.match(executable, /\bbegin;/);
  assert.match(executable, /set local lock_timeout = '5s'/);
  assert.match(executable, /set local statement_timeout = '5min'/);
  assert.match(executable, /to_regclass\('public\.asset_register_uploads'\) is null/);
  assert.match(executable, /migration 80 is required/);
  assert.match(executable, /lock table public\.asset_register_uploads in access share mode/);
  assert.match(executable, /asset_register_uploads_storage_state_check/);
  assert.match(executable, /asset_register_uploads_verified_object_check/);
  assert.match(executable, /asset_register_uploads_object_key_uidx/);
  assert.match(executable, /asset_upload_object_purge_queue/);
  assert.match(executable, /asset_register_bucket_upload_purge_queue/);
  assert.match(executable, /asset_register_bucket_deleted_accounts/);
  assert.match(executable, /\bcommit;/);
});

test('new Bucket-only catalog has the required metadata columns and no payload', () => {
  assert.match(
    tableDefinition,
    /create table if not exists public\.asset_register_bucket_uploads/,
  );

  for (const column of [
    /\bid text not null/,
    /\buser_id text not null/,
    /\bfile_name text not null/,
    /\bcontent_type text not null/,
    /\bbyte_size bigint not null/,
    /\bobject_key text/,
    /\bcontent_sha256 text/,
    /\bobject_etag text/,
    /\bstorage_state text not null default 'pending'/,
    /\bupload_category text not null default 'other'/,
    /\bcreated_at timestamptz not null default now\(\)/,
    /\bverified_at timestamptz/,
    /\bdeletion_started_at timestamptz/,
    /\blast_error text/,
  ]) {
    assert.match(tableDefinition, column);
  }

  assert.doesNotMatch(tableDefinition, /\bdata\s+bytea\b/);
  assert.doesNotMatch(tableDefinition, /\bfile_bytes\b/);
  assert.match(normalized, /bucket-only catalog must not contain postgresql file bytes/);
});

test('identifiers, hashes, sizes, keys, and states are strictly constrained', () => {
  assert.match(
    tableDefinition,
    /constraint asset_register_bucket_uploads_pkey primary key \(id\)/,
  );
  assert.match(
    tableDefinition,
    /constraint asset_register_bucket_uploads_object_key_key unique \(object_key\)/,
  );
  assert.match(
    migration,
    /\^bkt-\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-4\[0-9a-f\]\{3\}-\[89ab\]\[0-9a-f\]\{3\}-\[0-9a-f\]\{12\}\$/,
  );
  assert.match(tableDefinition, /check \(byte_size > 0\)/);
  assert.match(
    tableDefinition,
    /'v2\/asset-register\/' \|\| substring\(id from 5 for 2\) \|\| '\/' \|\| id/,
  );
  assert.match(
    tableDefinition,
    /content_sha256 is null or content_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/,
  );
  assert.match(
    tableDefinition,
    /storage_state in \('pending', 'ready', 'deleting', 'delete_failed'\)/,
  );
  assert.match(normalized, /asset_register_bucket_uploads_id_format_check/);
  assert.match(normalized, /asset_register_bucket_uploads_storage_state_check/);
  assert.match(normalized, /asset_register_bucket_uploads_state_metadata_check/);
});

test('ready and deletion states require verified metadata while pending can stage it', () => {
  assert.match(
    stateContract,
    /storage_state = 'pending' and deletion_started_at is null \) or \( storage_state = 'ready'/,
  );
  assert.match(
    stateContract,
    /storage_state = 'ready' and object_key is not null and content_sha256 is not null and verified_at is not null and deletion_started_at is null and last_error is null/,
  );
  assert.match(
    stateContract,
    /storage_state = 'deleting' and object_key is not null and content_sha256 is not null and verified_at is not null and deletion_started_at is not null and last_error is null/,
  );
  assert.match(
    stateContract,
    /storage_state = 'delete_failed' and object_key is not null and content_sha256 is not null and verified_at is not null and deletion_started_at is not null and last_error is not null/,
  );

  // The pending branch deliberately imposes no null requirement on object
  // metadata: an upload can persist key/hash/verification facts before the
  // atomic transition to ready.
  const pendingBranch = stateContract.slice(
    stateContract.indexOf("storage_state = 'pending'"),
    stateContract.indexOf("storage_state = 'ready'"),
  );
  assert.doesNotMatch(pendingBranch, /object_key|content_sha256|verified_at/);
  assert.match(
    tableDefinition,
    /verified_at is null or \(object_key is not null and content_sha256 is not null\)/,
  );
});

test('account deletion receives a strict minimal 30-day purge queue', () => {
  assert.match(
    queueDefinition,
    /create table if not exists public\.asset_register_bucket_upload_purge_queue/,
  );

  for (const column of [
    /\bupload_id text not null/,
    /\buser_id text not null/,
    /\bobject_key text not null/,
    /\bbyte_size bigint not null/,
    /\bqueued_at timestamptz not null default now\(\)/,
    /\bpurge_after timestamptz not null default \(now\(\) \+ interval '30 days'\)/,
    /\bpurged_at timestamptz/,
    /\blast_error text/,
  ]) {
    assert.match(queueDefinition, column);
  }

  assert.match(
    queueDefinition,
    /constraint asset_register_bucket_upload_purge_queue_pkey primary key \(upload_id\)/,
  );
  assert.match(
    queueDefinition,
    /constraint asset_register_bucket_upload_purge_queue_object_key_key unique \(object_key\)/,
  );
  assert.match(queueDefinition, /purge_after >= queued_at/);
  assert.match(queueDefinition, /purged_at is null or purged_at >= queued_at/);
  assert.match(queueDefinition, /check \(byte_size > 0\)/);
  assert.match(
    queueDefinition,
    /'v2\/asset-register\/' \|\| substring\(upload_id from 5 for 2\) \|\| '\/' \|\| upload_id/,
  );
  assert.match(
    normalized,
    /create index if not exists asset_register_bucket_upload_purge_queue_due_idx on public\.asset_register_bucket_upload_purge_queue \(purge_after\) where purged_at is null/,
  );
});

test('SECURITY INVOKER delete trigger queues exact metadata idempotently', () => {
  assert.match(triggerFunction, /returns trigger language plpgsql security invoker/);
  assert.match(triggerFunction, /set search_path = pg_catalog, public/);
  assert.match(triggerFunction, /if old\.object_key is null then return old/);
  assert.match(
    triggerFunction,
    /queued\.upload_id <> old\.id or queued\.user_id <> old\.user_id or queued\.byte_size <> old\.byte_size/,
  );
  assert.match(
    triggerFunction,
    /insert into public\.asset_register_bucket_upload_purge_queue as queued \( upload_id, user_id, object_key, byte_size \) values \( old\.id, old\.user_id, old\.object_key, old\.byte_size \)/,
  );
  assert.match(triggerFunction, /on conflict \(object_key\) do update/);
  assert.match(triggerFunction, /queued_at = least\(queued\.queued_at, excluded\.queued_at\)/);
  assert.match(triggerFunction, /purge_after = least\(queued\.purge_after, excluded\.purge_after\)/);
  assert.match(
    normalized,
    /create trigger queue_deleted_bucket_upload_trigger after delete on public\.asset_register_bucket_uploads for each row execute function public\.queue_deleted_bucket_upload\(\)/,
  );
  assert.match(normalized, /procedure_record\.prosecdef/);
  assert.match(normalized, /procedure_record\.proconfig/);
  assert.match(normalized, /trigger_record\.tgtype = 9/);
});

test('durable deleted-account tombstones close the post-hook upload race', () => {
  assert.match(
    deletedAccountsDefinition,
    /create table if not exists public\.asset_register_bucket_deleted_accounts/,
  );
  assert.match(deletedAccountsDefinition, /\buser_id text not null/);
  assert.match(
    deletedAccountsDefinition,
    /\bdeletion_started_at timestamptz not null default now\(\)/,
  );
  assert.match(
    deletedAccountsDefinition,
    /constraint asset_register_bucket_deleted_accounts_pkey primary key \(user_id\)/,
  );
  assert.match(
    deletedAccountsDefinition,
    /constraint asset_register_bucket_deleted_accounts_user_id_check check \(btrim\(user_id\) <> ''\)/,
  );
  assert.doesNotMatch(deletedAccountsDefinition, /\breferences\b|\bforeign key\b|\bbytea\b/);
  assert.match(normalized, /do \$validate_deleted_accounts\$/);
  assert.match(normalized, /\) <> 2 or exists \(/);
  assert.match(normalized, /deleted-account tombstone default is incompatible/);
  assert.match(normalized, /deleted-account tombstone constraints are incompatible/);
  assert.match(normalized, /deleted-account tombstone must not have a foreign key/);
});

test('reruns validate compatibility and create both requested indexes idempotently', () => {
  assert.match(normalized, /do \$validate_catalog\$/);
  assert.match(normalized, /do \$validate_purge_queue\$/);
  assert.match(normalized, /do \$validate_deleted_accounts\$/);
  assert.match(normalized, /bucket catalog defaults are incompatible/);
  assert.match(normalized, /bucket catalog constraints are incompatible/);
  assert.match(normalized, /bucket purge queue defaults are incompatible/);
  assert.match(normalized, /bucket purge queue constraints are incompatible/);
  assert.match(
    normalized,
    /create index if not exists asset_register_bucket_uploads_user_created_idx on public\.asset_register_bucket_uploads \(user_id, created_at desc\)/,
  );
  assert.match(
    normalized,
    /create index if not exists asset_register_bucket_uploads_state_created_idx on public\.asset_register_bucket_uploads \(storage_state, created_at\)/,
  );
  assert.match(normalized, /do \$validate_indexes\$/);
  assert.match(normalized, /do \$validate_delete_guard\$/);
  assert.match(normalized, /index_record\.indisvalid/);
  assert.match(normalized, /index_record\.indisready/);
});

test('migration never changes legacy rows or contacts an object store', () => {
  assert.doesNotMatch(
    executable,
    /\b(?:alter|drop|truncate)\s+table\s+(?:only\s+)?public\.asset_register_uploads\b/,
  );
  assert.doesNotMatch(
    executable,
    /\b(?:insert\s+into|update|delete\s+from)\s+public\.asset_register_uploads\b/,
  );
  assert.doesNotMatch(
    executable,
    /\b(?:insert\s+into|update|delete\s+from)\s+public\.asset_register_bucket_uploads\b/,
  );
  assert.doesNotMatch(
    executable,
    /\b(?:insert\s+into|update|delete\s+from)\s+public\.asset_register_bucket_deleted_accounts\b/,
  );
  assert.doesNotMatch(executable, /\b(?:update|delete\s+from|truncate\s+table)\s+public\./);
  assert.equal(
    executable.match(/\binsert\s+into\s+public\./g)?.length,
    1,
    'only the deferred trigger may define a queue insert',
  );
  assert.match(executable, /insert into public\.asset_register_bucket_upload_purge_queue/);
  assert.doesNotMatch(executable, /\bvacuum\b/);
  assert.doesNotMatch(executable, /\b(?:s3client|putobjectcommand|deleteobjectcommand|getobjectcommand|bucket_endpoint)\b/);
});

test('catalog comments document ownership, verification, and the legacy boundary', () => {
  assert.match(normalized, /comment on table public\.asset_register_bucket_uploads/);
  assert.match(normalized, /it contains no file bytes and does not replace or backfill asset_register_uploads/);
  assert.match(normalized, /must never be embedded in object_key/);
  assert.match(normalized, /etag\. it is not trusted as a content checksum/);
  assert.match(normalized, /pending permits staged object metadata/);
  assert.match(normalized, /comment on table public\.asset_register_bucket_upload_purge_queue/);
  assert.match(normalized, /repeated queue attempts never postpone it/);
  assert.match(normalized, /comment on trigger queue_deleted_bucket_upload_trigger/);
  assert.match(normalized, /comment on table public\.asset_register_bucket_deleted_accounts/);
  assert.match(normalized, /reject post-hook bucket uploads while authentication-user deletion completes later/);
});
