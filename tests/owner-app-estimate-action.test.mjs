import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ownerAsset = read('app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx');
const ownerStyles = read('app/owner-app/owner-app.module.css');

test('Owner App exposes the estimate update from both asset value summaries', () => {
  assert.equal(ownerAsset.match(/renderEstimateUpdateAction\(\)/g)?.length, 2);
  assert.match(ownerAsset, /const renderEstimateUpdateAction = \(\) => estimateNeedsUpdate \?/);
  assert.match(ownerAsset, /Update estimate[\s\S]*?<\/button>[\s\S]*?: null;/);
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
  assert.match(ownerStyles, /\.detailValueUpdateButtonAttention \{[\s\S]*?background:[\s\S]*?#c92020[\s\S]*?color: #ffffff;[\s\S]*?animation: ownerEstimateAttention/);
  assert.match(ownerStyles, /@media \(prefers-reduced-motion: reduce\)/);
});
