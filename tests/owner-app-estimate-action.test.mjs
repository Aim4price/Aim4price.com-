import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ownerAsset = read('app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx');
const ownerStyles = read('app/owner-app/owner-app.module.css');

test('Owner App exposes the estimate update from both asset value summaries', () => {
  assert.equal(ownerAsset.match(/renderEstimateUpdateAction\(\)/g)?.length, 2);
  assert.match(ownerAsset, /manage\/pricing\/recalculate/);
  assert.match(ownerAsset, /fetch\('\/api\/asset-register\/revalue'/);
  assert.match(ownerAsset, /onClick=\{\(\) => void requestRevalue\(false\)\}/);
});

test('A stale Aim4price estimate becomes a red one-tap update', () => {
  assert.match(ownerAsset, /valuationNeedsUpdate \?\? asset\.specsJson\.valuation_needs_update/);
  assert.match(ownerAsset, /className=\{`\$\{styles\.detailValueUpdateButton\} \$\{styles\.detailValueUpdateButtonAttention\}`\}/);
  assert.match(ownerAsset, /onClick=\{\(\) => void updateEstimateNow\(\)\}/);
  assert.match(ownerAsset, /body: JSON\.stringify\(\{ assetId: draft\.id, selectedMethod: 'aim4price' \}\)/);
  assert.match(ownerAsset, /setDraft\(data\.item\)/);
});

test('The estimate action keeps the Owner App button styling and touch size', () => {
  assert.match(ownerStyles, /\.detailValueUpdateButton \{[\s\S]*?min-height: 44px;[\s\S]*?border: 1\.5px solid #62bb8a;/);
  assert.match(ownerStyles, /\.detailValueUpdateButton:focus-visible/);
  assert.match(ownerStyles, /\.detailValueUpdateButtonAttention \{[\s\S]*?border-color: #ef8f8f;[\s\S]*?color: #a62d2d;/);
});
