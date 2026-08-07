import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ownerAsset = read('app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx');
const ownerStyles = read('app/owner-app/owner-app.module.css');

test('Owner App exposes the estimate update from both asset value summaries', () => {
  assert.equal(ownerAsset.match(/>\s*Update estimate\s*<\/Link>/g)?.length, 2);
  assert.equal(ownerAsset.match(/manage\/pricing\/recalculate/g)?.length, 2);
  assert.match(ownerAsset, /fetch\('\/api\/asset-register\/revalue'/);
  assert.match(ownerAsset, /onClick=\{\(\) => void requestRevalue\(false\)\}/);
});

test('The estimate action keeps the Owner App button styling and touch size', () => {
  assert.match(ownerStyles, /\.detailValueUpdateButton \{[\s\S]*?min-height: 44px;[\s\S]*?border: 1\.5px solid #62bb8a;/);
  assert.match(ownerStyles, /\.detailValueUpdateButton:focus-visible/);
});
