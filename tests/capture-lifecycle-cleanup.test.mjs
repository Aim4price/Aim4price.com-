import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('migration 84 durably stages both quarantine objects and assisted uploads', async () => {
  const migration = await read('database/migrations/84-assisted-capture-file-lifecycle.sql');
  const normalized = migration.replace(/\s+/g, ' ').toLowerCase();

  assert.match(migration, /create table if not exists public\.capture_quarantine_object_purge_queue/);
  assert.match(migration, /create table if not exists public\.capture_asset_upload_cleanup_queue/);
  assert.match(migration, /capture_quarantine_object_purge_queue_key_check/);
  assert.match(migration, /interval '1 hour'/);
  assert.match(migration, /queue_new_assisted_capture_legacy_upload_trigger/);
  assert.match(migration, /queue_new_assisted_capture_bucket_upload_trigger/);
  assert.match(migration, /'assisted-invoice-capture'/);
  assert.match(migration, /'assisted-fuel-slip-capture'/);
  assert.match(migration, /'dealer-assisted-invoice-capture'/);
  assert.match(normalized, /after insert on public\.asset_register_uploads/);
  assert.match(normalized, /after insert on public\.asset_register_bucket_uploads/);
  assert.match(migration, /cleaned_at is not null[\s\S]*already cleaned before it could be attached/);
  assert.match(migration, /purged_at is not null[\s\S]*already purged before it could be attached/);
});

test('terminal capture, promotion and file deletion all reactivate exact cleanup intents', async () => {
  const migration = await read('database/migrations/84-assisted-capture-file-lifecycle.sql');

  assert.match(migration, /queue_terminal_capture_file_cleanup_trigger/);
  assert.match(migration, /new\.status not in \('declined', 'rejected', 'cancelled'\)/);
  assert.match(migration, /'terminal_capture_request'/);
  assert.match(migration, /'capture_file_promoted'/);
  assert.match(migration, /'capture_file_deleted'/);
  assert.match(migration, /cancelled_at = null/);
  assert.doesNotMatch(
    migration.slice(migration.indexOf('queue_terminal_capture_file_cleanup()')),
    /new\.status[^\n]*completed/,
  );
});

test('owner retraction keeps the audit record and enters terminal cleanup through cancelled status', async () => {
  const [route, finalizer, migration] = await Promise.all([
    read('app/api/capture-requests/[requestId]/route.ts'),
    read('lib/capture-finalization.ts'),
    read('database/migrations/84-assisted-capture-file-lifecycle.sql'),
  ]);
  const retraction = finalizer.slice(finalizer.indexOf('export async function retractCaptureRequestForOwner'));

  assert.match(route, /retractCaptureRequestForOwner/);
  assert.match(retraction, /removeOrphanedCaptureInvoiceDocument\(request\)/);
  assert.match(retraction, /transitionCaptureRequest\(request\.id, 'cancelled'/);
  assert.doesNotMatch(retraction, /delete from public\.document_capture_(requests|files|events)/);
  assert.match(migration, /new\.status not in \('declined', 'rejected', 'cancelled'\)/);
  assert.match(migration, /queue_terminal_capture_file_cleanup_trigger/);
});

test('quarantine storage registers before returning and queues failed direct deletion', async () => {
  const storage = await read('lib/capture-quarantine-storage.ts');
  const verified = storage.indexOf('const verifiedBytes = await readObjectWithinLimit');
  const staged = storage.indexOf("reason: 'unattached_upload'");
  const returned = storage.indexOf('return { storageKey, sha256, byteSize: input.data.length }');

  assert.ok(verified >= 0 && verified < staged && staged < returned);
  assert.match(storage, /queueCaptureQuarantineFileForPurge/);
  assert.match(storage, /UNATTACHED_CAPTURE_GRACE_MS/);
  assert.match(storage, /reason: 'direct_delete_failed'/);
  assert.match(storage, /markCaptureQuarantineFilePurged/);
  assert.match(storage, /DeleteObjectCommand/);
});

test('account deletion preserves quarantine keys before deleting capture metadata', async () => {
  const deletion = await read('lib/account-deletion.ts');
  const queued = deletion.indexOf('insert into capture_quarantine_object_purge_queue');
  const filesDeleted = deletion.indexOf('delete from document_capture_files file');
  const requestsDeleted = deletion.indexOf("delete from document_capture_requests where owner_user_id");

  assert.ok(queued >= 0 && queued < filesDeleted && filesDeleted < requestsDeleted);
  assert.match(deletion, /reason[\s\S]*'account_deletion'/);
  assert.match(deletion, /on conflict \(storage_key\) do update/);
  assert.match(deletion, /cancelled_at = null/);
  assert.match(deletion, /delete from capture_asset_upload_cleanup_queue where owner_user_id = \$1/);
  assert.doesNotMatch(deletion, /delete from capture_quarantine_object_purge_queue where/);
});

test('unlinked upload cleanup covers Bucket-only and mirrored capture uploads safely', async () => {
  const uploads = await read('lib/asset-register-uploads.ts');
  const candidate = uploads.indexOf('mirroredCaptureCandidate');
  const readiness = uploads.indexOf('await assertObjectStorageSchemaReady()', candidate);
  const legacyDelete = uploads.indexOf('delete from public.asset_register_uploads upload', readiness);

  assert.ok(candidate >= 0 && candidate < readiness && readiness < legacyDelete);
  assert.match(uploads, /upload\.storage_state in \('copying', 'dual_verified', 'quarantined'\)/);
  assert.match(uploads, /upload\.upload_category = any\(\$5::text\[\]\)/);
  assert.match(uploads, /await assertBucketOnlyCatalogReady\(\)/);
  assert.match(uploads, /delete from public\.asset_register_bucket_uploads upload/);
  assert.match(uploads, /document_capture_files capture_file[\s\S]*promoted_upload_id = upload\.id::text/);
});

test('promotion immediately discards a new upload when compare-and-link fails', async () => {
  const finalizer = await read('lib/capture-finalization.ts');

  assert.match(finalizer, /const cleanupUnlinkedUpload = async \(\) =>/);
  assert.match(finalizer, /deleteUnreferencedAssetRegisterUploads/);
  assert.match(finalizer, /if \(promotedUploadId !== upload\.id\) await cleanupUnlinkedUpload\(\)/);
  assert.match(finalizer, /catch \(error\) \{[\s\S]*await cleanupUnlinkedUpload\(\);[\s\S]*throw error/);
});

test('capture purge worker is dry-run by default and rechecks live references', async () => {
  const worker = await read('scripts/purge-assisted-capture-files.mjs');
  const normalized = worker.replace(/\s+/g, ' ').toLowerCase();
  const dryRun = normalized.slice(normalized.indexOf('if (!apply)'), normalized.indexOf('} else {'));

  assert.match(worker, /process\.argv\.includes\('--apply'\)/);
  assert.match(worker, /AIM4PRICE_ALLOW_CAPTURE_QUARANTINE_PURGE[\s\S]*YES_I_REVIEWED_CAPTURE_PURGE_QUEUE/);
  assert.match(worker, /AIM4PRICE_ALLOW_BUCKET_WRITES[\s\S]*YES_I_ACCEPT_COST/);
  assert.doesNotMatch(worker, /^import .*@aws-sdk\/client-s3/m);
  assert.match(worker, /await import\('@aws-sdk\/client-s3'\)/);
  assert.doesNotMatch(dryRun, /createbucketclient|cleanonecaptureupload|purgeonequarantineobject/);
  assert.match(normalized, /no s3 module\/client was loaded and no database mutation was made/);
  assert.match(worker, /pg_advisory_xact_lock/);
  assert.match(worker, /request\.status not in \('declined', 'rejected', 'cancelled'\)/);
  assert.match(worker, /file\.promoted_upload_id is null/);
  assert.match(worker, /asset_invoice_documents where upload_id = \$1/);
  assert.match(worker, /fuel_slips where upload_id = \$1/);
  assert.match(worker, /account_documents where upload_id = \$1/);
  assert.match(worker, /new bucket\.sdk\.DeleteObjectCommand/);
  assert.match(worker, /30_000/);
  assert.match(worker, /set purged_at = now\(\)/);
  assert.doesNotMatch(worker, /delete from public\.capture_quarantine_object_purge_queue/);
});

test('rollout does not blanket-expire quarantine objects that may still be live', async () => {
  const rollout = await read('ASSISTED-CAPTURE-ROLLOUT.md');

  assert.match(rollout, /Do \*\*not\*\* set an unconditional age-based bucket lifecycle rule/);
  assert.match(rollout, /recheck[\s\S]*live database references[\s\S]*before deleting/);
  assert.doesNotMatch(rollout, /expire objects under `v1\/capture-quarantine\/` after 30 days/);
});
