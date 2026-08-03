import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const usageSource = await readFile(new URL('../lib/asset-usage.ts', import.meta.url), 'utf8');
const ownerApiSource = await readFile(new URL('../app/api/owner-app/assets/[assetId]/route.ts', import.meta.url), 'utf8');
const ownerClientSource = await readFile(new URL('../app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx', import.meta.url), 'utf8');
const assetRegisterSource = await readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');
const ownerAssetListSource = await readFile(new URL('../app/owner-app/assets/owner-assets-client.tsx', import.meta.url), 'utf8');

test('usage supports a deliberate not-applicable state', () => {
  assert.match(usageSource, /AssetUsageMetric = 'hours' \| 'km' \| 'percentage' \| 'not_applicable'/);
  assert.match(usageSource, /explicitBasis\?\.basis === 'not_applicable'/);
  assert.match(usageSource, /normalizeToken\(input\.kind\) === 'property'/);
  assert.match(usageSource, /usage\.metric === 'not_applicable'.*'Not applicable'/s);
});

test('Owner App offers hours, percentage, and not applicable', () => {
  assert.match(ownerClientSource, /<option value="hours">Hours<\/option>/);
  assert.match(ownerClientSource, /<option value="percentage">% worked<\/option>/);
  assert.match(ownerClientSource, /<option value="not_applicable">Not applicable<\/option>/);
  assert.match(ownerClientSource, /usageApplicable: false/);
});

test('desktop Update Asset offers the same compact usage choices and defaults property to N/A', () => {
  assert.match(assetRegisterSource, /aria-label="Usage type"/);
  assert.match(assetRegisterSource, /<option value="percentage">% worked<\/option>/);
  assert.match(assetRegisterSource, /<option value="not_applicable">Not applicable<\/option>/);
  assert.match(assetRegisterSource, /nextKind === 'property'[\s\S]*\? 'not_applicable'/);
  assert.match(ownerAssetListSource, /asset\.usageMetric === 'not_applicable'.*'Not applicable'/);
});

test('Owner App removal records a lifecycle reason instead of directly deleting', () => {
  assert.match(ownerApiSource, /disposeOrDeleteAsset\(\{/);
  assert.match(ownerApiSource, /Choose what happened to the asset before continuing/);
  assert.doesNotMatch(ownerApiSource, /deleteAssetRegisterItem/);
  assert.match(ownerClientSource, /DISPOSAL_REASONS/);
  assert.match(ownerClientSource, /JSON\.stringify\(disposalDraft\)/);
  assert.doesNotMatch(ownerClientSource, /window\.confirm\(`Delete/);
});
