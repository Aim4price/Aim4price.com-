import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

const objectStorageSource = await source('../lib/upload-object-storage.ts');
const uploadSource = await source('../lib/asset-register-uploads.ts');
const downloadRouteSource = await source('../app/api/asset-register/uploads/[uploadId]/route.ts');
const uploadRouteSource = await source('../app/api/asset-register/uploads/route.ts');
const accountDeletionSource = await source('../lib/account-deletion.ts');
const scanUploadSource = await source('../app/api/scan/uploads/route.ts');
const adminSource = await source('../lib/admin-dashboard.ts');
const rollout = await source('../docs/railway-bucket-rollout.md');
const invoiceSource = await source('../lib/my-invoices.ts');
const ownerInvoiceExtractionRouteSource = await source('../app/api/my-invoices/extract/route.ts');
const dealerInvoiceExtractionRouteSource = await source('../app/api/dealer/cost/extract/route.ts');
const discoverySource = await source('../lib/asset-discovery.ts');
const discoveryPhotoRouteSource = await source('../app/api/asset-discovery/assets/[assetId]/photos/[photoIndex]/route.ts');
const reportLogoSource = await source('../lib/report-logo.ts');
const marketplaceImageSource = await source('../app/api/marketplace/images/[listingReference]/route.ts');

test('Bucket-only writes are off by default and require all explicit approvals', () => {
  assert.match(objectStorageSource, /AIM4PRICE_UPLOAD_STORAGE_MODE \?\? 'postgres'/);
  assert.match(objectStorageSource, /mode === 'bucket-only-new'/);
  assert.match(objectStorageSource, /AIM4PRICE_ALLOW_BUCKET_WRITES === 'YES_I_ACCEPT_COST'/);
  assert.match(objectStorageSource, /AIM4PRICE_ALLOW_BUCKET_ONLY === 'YES_I_ACCEPT_NO_POSTGRES_COPY'/);

  const bucketOnlyStore = objectStorageSource.slice(
    objectStorageSource.indexOf('export async function storeBucketOnlyUpload'),
    objectStorageSource.indexOf('export async function deleteBucketUploadObject'),
  );
  assert.match(bucketOnlyStore, /getUploadStorageMode\(\) !== 'bucket-only-new'/);
  assert.match(bucketOnlyStore, /isBucketWriteCostApproved\(\)/);
  assert.match(bucketOnlyStore, /isBucketOnlyNewApproved\(\)/);
});

test('Bucket-only object keys are opaque v2 keys and writes are verified exactly', () => {
  assert.match(objectStorageSource, /v2\/asset-register\/\$\{uuidPrefix\}\/\$\{id\}/);
  const keyFunction = objectStorageSource.slice(
    objectStorageSource.indexOf('export function createBucketOnlyUploadObjectKey'),
    objectStorageSource.indexOf('export function sha256Hex'),
  );
  assert.doesNotMatch(keyFunction, /userId|fileName|email/i);
  assert.match(objectStorageSource, /IfNoneMatch: '\*'/);
  assert.match(objectStorageSource, /downloadedSha256 !== contentSha256/);
  assert.ok(
    objectStorageSource.indexOf('new sdk.PutObjectCommand')
      < objectStorageSource.indexOf('downloadObjectBytes(input.objectKey)'),
  );
});

test('a committed pending catalog row precedes object storage and ready follows verification', () => {
  const bucketOnlyCreate = uploadSource.slice(
    uploadSource.indexOf('async function createBucketOnlyAssetRegisterUpload'),
    uploadSource.indexOf('export async function createAssetRegisterUpload'),
  );
  const pendingInsert = bucketOnlyCreate.indexOf('insert into public.asset_register_bucket_uploads');
  const bucketWrite = bucketOnlyCreate.indexOf('await storeBucketOnlyUpload({');
  const readyUpdate = bucketOnlyCreate.indexOf("storage_state = 'ready'");

  assert.ok(pendingInsert >= 0);
  assert.ok(bucketWrite > pendingInsert);
  assert.ok(readyUpdate > bucketWrite);
  assert.match(bucketOnlyCreate, /pg_advisory_lock\(hashtextextended\(\$1, 0\)\)/);
  assert.match(bucketOnlyCreate, /storage_state = 'pending'/);
  assert.match(bucketOnlyCreate, /set last_error = \$2/);
  assert.match(uploadSource, /if \(storageMode === 'bucket-only-new'\)/);
});

test('Bucket-only reads never fall through to the PostgreSQL bytea path', () => {
  assert.match(downloadRouteSource, /isBucketOnlyAssetRegisterUploadId\(uploadId\)/);
  assert.match(downloadRouteSource, /resolveBucketOnlyAssetRegisterDownload\(uploadId\)/);
  assert.match(downloadRouteSource, /status: 503/);
  assert.ok(
    downloadRouteSource.indexOf('isBucketOnlyAssetRegisterUploadId(uploadId)')
      < downloadRouteSource.indexOf('getLegacyAssetRegisterUploadResponse(uploadId)'),
  );
  assert.match(uploadSource, /BUCKET_ONLY_UPLOAD_ID_PATTERN\.test\(normalizedUploadId\)/);
  assert.match(uploadSource, /storage_state !== 'ready'/);
});

test('server-side Bucket byte reads are bounded and verified before use', () => {
  const verifiedReader = objectStorageSource.slice(
    objectStorageSource.indexOf('export async function readVerifiedBucketUploadObjectBytes'),
    objectStorageSource.indexOf('export async function deleteBucketUploadObject'),
  );
  assert.match(objectStorageSource, /Range: `bytes=0-\$\{input\.maximumBytes - 1\}`/);
  assert.match(objectStorageSource, /totalBytes > input\.maximumBytes/);
  assert.match(verifiedReader, /BUCKET_ONLY_OBJECT_KEY_PATTERN\.test\(objectKey\)/);
  assert.match(verifiedReader, /data\.length !== input\.expectedByteSize/);
  assert.match(verifiedReader, /sha256Hex\(data\) !== expectedSha256/);

  const byteResolver = uploadSource.slice(
    uploadSource.indexOf('async function resolveBucketOnlyAssetRegisterUploadBytes'),
    uploadSource.indexOf('export async function createAssetRegisterSignedGetUrl'),
  );
  assert.match(byteResolver, /byte_size/);
  assert.match(byteResolver, /content_sha256/);
  assert.match(byteResolver, /storage_state !== 'ready'/);
  assert.match(byteResolver, /row\.object_key !== expectedObjectKey/);
  assert.match(byteResolver, /readVerifiedBucketUploadObjectBytes/);
  assert.ok(
    byteResolver.indexOf('BUCKET_ONLY_UPLOAD_ID_PATTERN.test(normalizedUploadId)')
      < byteResolver.indexOf('getLegacyAssetRegisterUploadResponse(normalizedUploadId)'),
  );
});

test('Bucket-only reads support the Document Vault limit without widening Asset Register attachments', () => {
  assert.match(uploadSource, /MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES = 12 \* 1024 \* 1024/);
  assert.match(uploadSource, /MAX_DOCUMENT_VAULT_UPLOAD_BYTES = 25 \* 1024 \* 1024/);
  assert.match(objectStorageSource, /MAX_BUCKET_ONLY_OBJECT_READ_BYTES = 25 \* 1024 \* 1024/);
});

test('all active server-side byte consumers use the unified resolver and retired readers stay retired', () => {
  for (const consumer of [invoiceSource, discoverySource, reportLogoSource, marketplaceImageSource]) {
    assert.match(consumer, /resolveAssetRegisterUploadBytes/);
    assert.doesNotMatch(consumer, /getLegacyAssetRegisterUploadResponse/);
  }

  assert.match(invoiceSource, /INVOICE_DOCUMENT_UPLOAD_UNAVAILABLE/);
  for (const extractionRoute of [ownerInvoiceExtractionRouteSource, dealerInvoiceExtractionRouteSource]) {
    assert.match(extractionRoute, /status: 410/);
    assert.match(extractionRoute, /'Cache-Control': 'private, no-store'/);
    assert.doesNotMatch(extractionRoute, /extractInvoiceFromUpload/);
  }
  assert.match(discoverySource, /bkt-\[0-9a-f\]\{8\}/);
  assert.match(discoverySource, /Discovery photo temporarily unavailable/);
  assert.match(discoveryPhotoRouteSource, /error\.message === "Discovery photo temporarily unavailable\."/);
  assert.match(discoveryPhotoRouteSource, /status: 503/);
  assert.match(discoveryPhotoRouteSource, /"Retry-After": "60"/);
  assert.match(marketplaceImageSource, /status: 503/);
  assert.match(marketplaceImageSource, /Retry-After': '60'/);
});

test('account deletion and scan uploads are coordinated and bounded', () => {
  assert.match(accountDeletionSource, /pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/);
  assert.match(accountDeletionSource, /insert into public\.asset_register_bucket_deleted_accounts/);
  assert.match(accountDeletionSource, /on conflict \(user_id\) do nothing/);
  assert.match(uploadSource, /from public\.asset_register_bucket_deleted_accounts/);
  assert.match(uploadSource, /deletion_started/);
  const bucketTablePosition = accountDeletionSource.indexOf("'asset_register_bucket_uploads'");
  const oldTablePosition = accountDeletionSource.indexOf("'asset_register_uploads'");
  assert.ok(bucketTablePosition > oldTablePosition);
  assert.match(scanUploadSource, /offset \+= 2/);
  assert.match(scanUploadSource, /slice\(offset, offset \+ 2\)/);
});

test('multi-file requests validate every file before storing the first one', () => {
  const firstValidation = uploadRouteSource.indexOf('for (const file of files)');
  const createPosition = uploadRouteSource.indexOf('await createAssetRegisterUpload({');
  const secondLoop = uploadRouteSource.indexOf('for (const file of files)', firstValidation + 1);

  assert.ok(firstValidation >= 0);
  assert.ok(secondLoop > firstValidation);
  assert.ok(createPosition > secondLoop);
});

test('admin metering and rollout preserve the legacy boundary and safe rollback', () => {
  assert.match(adminSource, /asset_register_bucket_uploads/);
  assert.match(adminSource, /where storage_state = 'ready'/);
  assert.match(adminSource, /pendingBucketUploads/);
  assert.match(adminSource, /failedBucketUploads/);
  assert.match(rollout, /does\s+not copy, rewrite, or delete any existing PostgreSQL upload/i);
  assert.match(rollout, /AIM4PRICE_UPLOAD_STORAGE_MODE=postgres/);
  assert.match(rollout, /Keep migration 81, the Bucket resource, and all Bucket credential references/);
  assert.doesNotMatch(rollout, /migrate-asset-register-uploads-to-bucket\.mjs --apply/);
});
