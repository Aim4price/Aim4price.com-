import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const script = await readFile(
  new URL('../scripts/purge-deleted-bucket-only-uploads.mjs', import.meta.url),
  'utf8',
);
const normalized = script.replace(/\s+/g, ' ').toLowerCase();

function functionBody(start, end) {
  return normalized.slice(normalized.indexOf(start), normalized.indexOf(end));
}

test('dry-run is the default and cannot load S3 or mutate the database', () => {
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
  assert.doesNotMatch(script, /^import .*@aws-sdk\/client-s3/m);
  assert.match(script, /await import\('@aws-sdk\/client-s3'\)/);

  const summary = functionBody('async function readduesummary', 'async function listdueuploadids');
  assert.match(summary, /select count\(\*\)::bigint as due_count/);
  assert.doesNotMatch(summary, /\b(?:insert|update|delete|truncate|alter|drop)\b/);

  const dryRunBranch = normalized.slice(
    normalized.indexOf('if (!apply)'),
    normalized.indexOf('} else {', normalized.indexOf('if (!apply)')),
  );
  assert.doesNotMatch(dryRunBranch, /createbucketclient|purgeone|listdueuploadids/);
  assert.match(normalized, /no s3 module\/client was loaded and no database mutation was made/);
});

test('apply requires both exact approval gates and has a bounded batch', () => {
  assert.match(
    script,
    /AIM4PRICE_ALLOW_BUCKET_PURGE[\s\S]*=== 'YES_I_REVIEWED_30_DAY_QUEUE'/,
  );
  assert.match(
    script,
    /AIM4PRICE_ALLOW_BUCKET_WRITES[\s\S]*=== 'YES_I_ACCEPT_COST'/,
  );
  assert.match(script, /Math\.min\(100, Math\.max\(1,/);
  assert.match(script, /\?\? 25/);

  const approval = normalized.indexOf('if (!purgeapproved)');
  const importPosition = normalized.indexOf("await import('@aws-sdk/client-s3')");
  const clientUse = normalized.lastIndexOf('await createbucketclient()');
  assert.ok(approval >= 0 && approval < clientUse);
  assert.ok(importPosition >= 0 && importPosition < clientUse);
});

test('only due unpurged queue rows can become candidates', () => {
  const list = functionBody('async function listdueuploadids', 'async function setqueueerror');
  assert.match(list, /from public\.asset_register_bucket_upload_purge_queue/);
  assert.match(list, /where purged_at is null and purge_after <= now\(\)/);
  assert.match(list, /order by purge_after asc, queued_at asc, upload_id asc/);
  assert.match(list, /limit \$1/);
  assert.doesNotMatch(script, /delete from public\.asset_register_bucket_upload_purge_queue/);
});

test('queue identity must be an exact bkt UUIDv4 and matching v2 key', () => {
  assert.match(
    script,
    /\^bkt-\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-4\[0-9a-f\]\{3\}-\[89ab\]\[0-9a-f\]\{3\}-\[0-9a-f\]\{12\}\$/,
  );
  assert.match(script, /\^v2\\\/asset-register\\\/\[0-9a-f\]\{2\}\\\/bkt-/);
  assert.match(
    script,
    /objectKey === `v2\/asset-register\/\$\{uploadId\.slice\(4, 6\)\}\/\$\{uploadId\}`/,
  );
  assert.match(normalized, /strict bkt uuid\/v2 object-key validation/);
});

test('each apply item locks and rechecks queue and live catalog before S3', () => {
  const purge = functionBody('async function purgeone', 'const pool = createpool');
  const catalogLock = purge.indexOf(
    'lock table public.asset_register_bucket_uploads in share row exclusive mode',
  );
  const rowLock = purge.indexOf('for update');
  const liveCheck = purge.indexOf('from public.asset_register_bucket_uploads');
  const deleteCall = purge.indexOf('await deleteexactobject');

  assert.match(purge, /set local lock_timeout = '5s'/);
  assert.ok(catalogLock >= 0 && catalogLock < rowLock);
  assert.match(purge, /where upload_id = \$1 and purged_at is null and purge_after <= now\(\) for update/);
  assert.ok(rowLock < liveCheck && liveCheck < deleteCall);
  assert.match(purge, /where id = \$1 or object_key = \$2/);
});

test('DeleteObject is exact, idempotent, and bounded by 30 seconds', () => {
  const deletion = functionBody('async function deleteexactobject', 'async function readduesummary');
  assert.match(deletion, /new bucket\.sdk\.deleteobjectcommand/);
  assert.match(deletion, /key: objectkey/);
  assert.match(deletion, /new abortcontroller\(\)/);
  assert.match(deletion, /30_000/);
  assert.match(deletion, /abortsignal: abortcontroller\.signal/);
  assert.match(normalized, /deleteobject is idempotent/);
});

test('S3 failure records only a sanitized error and never marks the row purged', () => {
  const sanitizer = functionBody('function sanitizedbucketerror', 'async function deleteexactobject');
  assert.doesNotMatch(sanitizer, /error\.message|candidate\.message|error\.stack/);
  assert.match(sanitizer, /httpstatuscode/);
  assert.match(normalized, /do not persist sdk messages, urls, credentials/);
  assert.match(normalized, /request headers or stack/);
  assert.match(normalized, /traces\. the error class/);

  const purge = functionBody('async function purgeone', 'const pool = createpool');
  const failure = purge.slice(
    purge.indexOf('catch (error)', purge.indexOf('await deleteexactobject')),
    purge.indexOf("return { status: 'failed'"),
  );
  assert.match(failure, /setqueueerror/);
  assert.match(failure, /commit/);
  assert.doesNotMatch(failure, /purged_at\s*=\s*now/);
  assert.match(purge, /set purged_at = now\(\), last_error = null/);
});

test('worker is isolated from legacy and PR255 storage paths', () => {
  assert.doesNotMatch(script, /public\.asset_register_uploads\b/);
  assert.doesNotMatch(script, /asset_upload_references|asset_upload_object_purge_queue/);
  assert.doesNotMatch(script, /delete from public\./);
});

test('Bucket configuration matches the server adapter aliases', () => {
  for (const variable of [
    'AIM4PRICE_BUCKET_NAME',
    'AWS_S3_BUCKET_NAME',
    'BUCKET',
    'AIM4PRICE_BUCKET_ENDPOINT',
    'AWS_ENDPOINT_URL',
    'ENDPOINT',
    'AIM4PRICE_BUCKET_REGION',
    'AWS_DEFAULT_REGION',
    'REGION',
    'AIM4PRICE_BUCKET_ACCESS_KEY_ID',
    'AWS_ACCESS_KEY_ID',
    'ACCESS_KEY_ID',
    'AIM4PRICE_BUCKET_SECRET_ACCESS_KEY',
    'AWS_SECRET_ACCESS_KEY',
    'SECRET_ACCESS_KEY',
    'AWS_S3_URL_STYLE',
    'AWS_S3_FORCE_PATH_STYLE',
  ]) {
    assert.match(script, new RegExp(`process\\.env\\.${variable}`));
  }

  assert.match(normalized, /bucket endpoint must be an https url without embedded credentials/);
});
