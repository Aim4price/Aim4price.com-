import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { normalizeInternalReturnPath } from '../lib/internal-return-path.ts';

const page = readFileSync(new URL('../app/documents/page.tsx', import.meta.url), 'utf8');
const client = readFileSync(new URL('../app/documents/documents-client.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/documents/page.module.css', import.meta.url), 'utf8');

test('Documents page validates and forwards an asset return target', () => {
  assert.match(page, /returnTo\?: string \| string\[\];/);
  assert.match(page, /initialAssetId = readSingleSearchParam\(searchParams\?\.assetId\)/);
  assert.match(page, /initialReturnTo = normalizeInternalReturnPath\(searchParams\?\.returnTo\)/);
  assert.match(page, /initialReturnTo=\{initialReturnTo\}/);

  assert.equal(
    normalizeInternalReturnPath('/asset-register?assetId=asset-1&mapAction=manage'),
    '/asset-register?assetId=asset-1&mapAction=manage',
  );
  assert.equal(normalizeInternalReturnPath('//example.com/asset-register'), '');
  assert.equal(normalizeInternalReturnPath('/\\example.com/asset-register'), '');
});

test('asset-filtered Vault clearly returns to the asset while normal Vault exit remains unchanged', () => {
  assert.match(client, /initialReturnTo\?: string;/);
  const banner = client.slice(
    client.indexOf("{initialAssetId ? ("),
    client.indexOf('<section className={styles.topActions}', client.indexOf("{initialAssetId ? (")),
  );

  assert.match(banner, /className=\{styles\.assetFilterBanner\}/);
  assert.match(banner, /href=\{initialReturnTo \|\| '\/documents'\}/);
  assert.match(banner, /initialReturnTo \? '← Back to asset' : 'View all documents'/);
  assert.match(styles, /\.assetFilterBanner > a\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?font-weight:\s*820;/);
});
