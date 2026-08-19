import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const uploadSource = await readFile(
  new URL('../lib/asset-register-uploads.ts', import.meta.url),
  'utf8',
);
const migration = await readFile(
  new URL('../database/migrations/79-deduplicate-asset-register-upload-storage.sql', import.meta.url),
  'utf8',
);
const maintenance = await readFile(
  new URL('../database/maintenance/reclaim-asset-register-upload-storage.sql', import.meta.url),
  'utf8',
);

test('new uploads write only to the canonical data bytea column', () => {
  const insertStart = uploadSource.indexOf('async function insertAssetRegisterUploadRow');
  const insertEnd = uploadSource.indexOf('async function ensureAssetRegisterUploadsTableOnce');

  assert.notEqual(insertStart, -1);
  assert.notEqual(insertEnd, -1);

  const insertSource = uploadSource.slice(insertStart, insertEnd);

  assert.match(insertSource, /push\('data', input\.buffer, isByteaColumn\);/);
  assert.doesNotMatch(insertSource, /LEGACY_DATA_COLUMN_CANDIDATES/);
  assert.match(insertSource, /if \(!usedColumns\.has\('data'\)\)/);
});

test('Bucket-only mode branches before the legacy bytea table is prepared', () => {
  const createStart = uploadSource.indexOf('export async function createAssetRegisterUpload');
  const createEnd = uploadSource.indexOf('export function buildAssetRegisterUploadUrl');
  const createSource = uploadSource.slice(createStart, createEnd);
  const bucketBranch = createSource.indexOf("storageMode === 'bucket-only-new'");
  const legacyTable = createSource.indexOf('await ensureAssetRegisterUploadsTable()');
  const legacyInsert = createSource.indexOf('await insertAssetRegisterUploadRow({');

  assert.ok(bucketBranch >= 0);
  assert.ok(legacyTable > bucketBranch);
  assert.ok(legacyInsert > legacyTable);
  assert.match(createSource, /return createBucketOnlyAssetRegisterUpload\(/);
});

test('migration preserves legacy-only data and refuses mismatches', () => {
  assert.match(migration, /set data = file_bytes/i);
  assert.match(migration, /where data is null\s+and file_bytes is not null/i);
  assert.match(migration, /file_bytes is not null\s+and data is distinct from file_bytes/i);
  assert.match(migration, /refusing to drop file_bytes/i);
  assert.match(migration, /set local lock_timeout = '5s'/i);
  assert.match(migration, /set local statement_timeout = '5min'/i);
  assert.match(migration, /not a bytea column/i);
  assert.match(migration, /drop column file_bytes/i);
  assert.doesNotMatch(migration, /^\s*vacuum\b/im);
});

test('space reclamation remains an explicit guarded maintenance action', () => {
  assert.match(maintenance, /migration 79 has not removed file_bytes/i);
  assert.match(maintenance, /Auto-commit must be ON/i);
  assert.match(maintenance, /set lock_timeout = '5s'/i);
  assert.match(maintenance, /vacuum \(full, analyze\) public\.asset_register_uploads/i);
});
