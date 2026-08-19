import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const objectStorageSource = await readFile(
  new URL('../lib/upload-object-storage.ts', import.meta.url),
  'utf8',
);
const uploadSource = await readFile(
  new URL('../lib/asset-register-uploads.ts', import.meta.url),
  'utf8',
);
const migration = await readFile(
  new URL('../database/migrations/80-prepare-asset-upload-object-storage.sql', import.meta.url),
  'utf8',
);
const migrationScript = await readFile(
  new URL('../scripts/migrate-asset-register-uploads-to-bucket.mjs', import.meta.url),
  'utf8',
);
const purgeScript = await readFile(
  new URL('../scripts/purge-deleted-asset-upload-objects.mjs', import.meta.url),
  'utf8',
);
const accountDeletionSource = await readFile(
  new URL('../lib/account-deletion.ts', import.meta.url),
  'utf8',
);
const adminSource = await readFile(
  new URL('../lib/admin-dashboard.ts', import.meta.url),
  'utf8',
);

test('PostgreSQL is the fail-safe default and bucket access requires an explicit mode', () => {
  assert.match(objectStorageSource, /AIM4PRICE_UPLOAD_STORAGE_MODE \?\? 'postgres'/);
  assert.match(objectStorageSource, /AIM4PRICE_ALLOW_BUCKET_WRITES === 'YES_I_ACCEPT_COST'/);
  assert.doesNotMatch(objectStorageSource, /^import .*@aws-sdk/m);
  assert.match(objectStorageSource, /import\('@aws-sdk\/client-s3'\)/);
  assert.match(objectStorageSource, /if \(mode === 'mirror' \|\| mode === 'bucket-preferred'\)/);
  assert.match(uploadSource, /if \(storageMode !== 'postgres'\)/);
  assert.match(uploadSource, /assertObjectStorageSchemaReady\(\)/);
  assert.match(uploadSource, /backfill_completed_at is not null/);
  assert.match(uploadSource, /holds_released_at is not null/);
  assert.match(uploadSource, /reference_kind = 'migration_hold'/);
  assert.match(uploadSource, /storage_state = 'copying'/);
  assert.ok(
    uploadSource.indexOf('prepareAssetRegisterUploadMirror({')
      < uploadSource.indexOf('const mirrored = await mirrorUploadToBucket({'),
  );
  assert.match(uploadSource, /PostgreSQL copy retained/);
});

test('object keys are opaque and do not contain account data or file names', () => {
  assert.match(objectStorageSource, /v1\/asset-register\/\$\{id\.slice\(0, 2\)\}\/\$\{id\}/);
  const keyFunction = objectStorageSource.slice(
    objectStorageSource.indexOf('export function createUploadObjectKey'),
    objectStorageSource.indexOf('export function sha256Hex'),
  );
  assert.doesNotMatch(keyFunction, /userId|fileName|email/i);
});

test('a mirror is marked verified only after exact read-back hashing', () => {
  const putPosition = objectStorageSource.indexOf('new sdk.PutObjectCommand');
  const readBackPosition = objectStorageSource.indexOf('downloadObjectBytes(objectKey)');
  const hashCheckPosition = objectStorageSource.indexOf('downloadedSha256 !== contentSha256');
  const verifiedReturnPosition = objectStorageSource.indexOf('verifiedAt: new Date()');

  assert.ok(putPosition >= 0);
  assert.ok(readBackPosition > putPosition);
  assert.ok(hashCheckPosition > readBackPosition);
  assert.ok(verifiedReturnPosition > hashCheckPosition);
  assert.match(uploadSource, /storage_state = 'dual_verified'/);
});

test('bucket-preferred reads retain the PostgreSQL fallback', () => {
  assert.match(uploadSource, /getUploadStorageMode\(\) !== 'bucket-preferred'/);
  assert.match(uploadSource, /signed bucket URL failed; using PostgreSQL fallback/);
  assert.match(uploadSource, /getLegacyAssetRegisterUploadResponse/);
});

test('stored uploads do not reflect arbitrary MIME types as inline content', () => {
  assert.match(uploadSource, /ALLOWED_ASSET_REGISTER_DOCUMENT_TYPES\.has\(explicitType\)/);
  assert.match(uploadSource, /CONTENT_TYPE_BY_EXTENSION\.get/);
  assert.match(uploadSource, /'inline' \| 'attachment'/);
  assert.match(objectStorageSource, /normalizedContentType\.startsWith\('image\/'\)/);
  assert.match(objectStorageSource, /\? 'inline'\s*:\s*'attachment'/);
});

test('foundation migration is additive and retains PostgreSQL bytes', () => {
  assert.match(migration, /alter column data set not null/i);
  assert.match(migration, /dual_verified/i);
  assert.match(migration, /content_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.match(migration, /set local lock_timeout = '5s'/i);
  assert.doesNotMatch(migration, /drop column data/i);
  assert.doesNotMatch(migration, /^\s*vacuum\b/im);
  assert.match(migration, /asset_upload_object_purge_queue/);
  assert.match(migration, /interval '30 days'/);
  assert.match(migration, /after delete on public\.asset_register_uploads/i);
});

test('copy command is dry-run by default and retains database payloads', () => {
  assert.match(migrationScript, /process\.argv\.includes\('--apply'\)/);
  assert.match(migrationScript, /AIM4PRICE_ALLOW_BUCKET_WRITES === 'YES_I_ACCEPT_COST'/);
  assert.match(migrationScript, /pg_try_advisory_lock/);
  assert.match(migrationScript, /for update skip locked/i);
  assert.match(migrationScript, /IfNoneMatch: '\*'/);
  assert.match(migrationScript, /No bucket connection or database write was made/);
  assert.match(migrationScript, /PostgreSQL bytes will be retained/);
  assert.match(migrationScript, /GetObjectCommand/);
  assert.match(migrationScript, /actualSha256 !== expectedSha256/);
  assert.doesNotMatch(migrationScript, /set\s+data\s*=\s*null/i);
  assert.match(migrationScript, /asset_upload_reference_ledger_ready\(\)/);
  assert.match(migrationScript, /asset_upload_prepare_for_deletion\(text\)/);
  assert.match(migrationScript, /asset_upload_has_unregistered_catalog_reference\(text\)/);
  assert.match(migrationScript, /backfill_completed_at is not null/);
  assert.match(migrationScript, /holds_released_at is not null/);
  assert.match(migrationScript, /reference_kind = 'migration_hold'/);
  const readinessPreflight = migrationScript.indexOf(
    'if (!(await referenceGuardsReady(client)))',
  );
  const bucketConfigRead = migrationScript.indexOf('const config = readBucketConfig()');
  const bucketClientCreation = migrationScript.indexOf('const s3 = new S3Client');
  assert.ok(readinessPreflight >= 0 && readinessPreflight < bucketConfigRead);
  assert.ok(bucketConfigRead < bucketClientCreation);
});

test('cleanup is soft, reference-guarded, and cannot directly delete an object', () => {
  assert.match(uploadSource, /asset_upload_reference_ledger_ready\(\)/);
  assert.match(uploadSource, /asset_upload_has_live_reference\(upload\.id\)/);
  assert.match(uploadSource, /deleted_at = coalesce\(upload\.deleted_at, now\(\)\)/);
  assert.match(uploadSource, /purge_after = coalesce\(upload\.purge_after/);
  assert.match(uploadSource, /interval '24 hours'/);
  assert.doesNotMatch(uploadSource, /DeleteObjectCommand/);
  assert.match(purgeScript, /process\.argv\.includes\('--apply'\)/);
  assert.match(purgeScript, /purge_after <= now\(\)/);
  assert.match(purgeScript, /No Bucket connection or database write was made/);
  assert.match(purgeScript, /Refusing to delete an object with an unsafe key/);
  assert.match(uploadSource, /and deleted_at is null/g);
  assert.match(purgeScript, /asset_upload_prepare_for_deletion\(\$1\)/);
  assert.match(purgeScript, /for update skip locked/i);
  assert.match(purgeScript, /AIM4PRICE_ALLOW_UPLOAD_PURGE === 'YES_I_REVIEWED_THE_DRY_RUN'/);
  assert.match(purgeScript, /AIM4PRICE_ALLOW_BUCKET_WRITES === 'YES_I_ACCEPT_COST'/);
  assert.match(purgeScript, /orphansToSchedule/);
  assert.match(purgeScript, /dueMetadataRows/);
  assert.match(purgeScript, /dueObjectQueueRows/);
  assert.match(purgeScript, /lockPotentialUploadSourceTables/);
  assert.match(purgeScript, /lock table .* in share row exclusive mode/i);
  assert.match(purgeScript, /from pg_catalog\.pg_class as relation/);
  assert.match(purgeScript, /domain_array_element_type/);
  assert.match(purgeScript, /asset_upload_has_unregistered_catalog_reference\(text\)/);
});

test('account deletion removes upload-bearing sources first and fails closed on held uploads', () => {
  assert.doesNotMatch(accountDeletionSource, /delete from (?:public\.)?asset_register_uploads/i);
  assert.doesNotMatch(accountDeletionSource, /select id::text as id[\s\S]+for update/i);

  for (const table of [
    'ad_brand_kits',
    'fuel_ledger_audit_events',
    'fuel_slips',
    'asset_invoices',
    'asset_invoice_documents',
  ]) {
    assert.match(accountDeletionSource, new RegExp(`'${table}'`));
  }

  const scanDelete = accountDeletionSource.indexOf('delete from public.asset_scan_events');
  const itemDeleteLoop = accountDeletionSource.indexOf('for (const tableName of USER_ID_TABLES)');
  const uploadSchedule = accountDeletionSource.lastIndexOf('await scheduleOwnedUploadsLast');
  assert.ok(scanDelete >= 0 && scanDelete < itemDeleteLoop);
  assert.ok(accountDeletionSource.indexOf("'asset_invoices'")
    < accountDeletionSource.indexOf("'asset_invoice_documents'"));
  assert.ok(accountDeletionSource.indexOf("'asset_invoice_documents'")
    < accountDeletionSource.indexOf("'asset_register_items'"));
  assert.ok(itemDeleteLoop < uploadSchedule);
  assert.match(accountDeletionSource, /asset_upload_reference_ledger_ready\(\)/);
  assert.match(accountDeletionSource, /where table_schema = 'public'/);
  assert.match(accountDeletionSource, /set local lock_timeout = '5s'/);
  assert.match(accountDeletionSource, /set local statement_timeout = '5min'/);
  assert.match(accountDeletionSource, /and upload\.deleted_at is null/);
  assert.match(accountDeletionSource, /account deletion was rolled back for reconciliation/);
});

test('admin measurement captures pricing-relevant account distribution', () => {
  assert.match(adminSource, /percentile_cont\(0\.5\)/);
  assert.match(adminSource, /percentile_cont\(0\.9\)/);
  assert.match(adminSource, /interval '30 days'/);
  assert.match(adminSource, /Verified Railway Bucket copies/);
  assert.match(adminSource, /fuel_late_entry_evidence/);
  assert.match(adminSource, /Inline profile and Brand Kit logos/);
});
