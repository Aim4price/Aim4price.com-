import assert from 'node:assert/strict';
import { readFileSync } from './helpers/light-theme-source.mjs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const ownerOverview = read('app/owner-app/attention/owner-attention-client.tsx');
const dealerOverview = read('app/dealer/overview/dealer-overview-client.tsx');

const ownerServiceModal = read('app/owner-app/owner-service-location-modal.tsx');
const fuelLocationModal = read('components/FuelLocationModal.tsx');
const fieldStyles = read('components/manager/mobile.module.css');

test('overview cards use background colour instead of redundant pills across all apps', () => {
  for (const source of [ownerOverview, dealerOverview]) {
    assert.match(source, /function cardClassName\(/);
    assert.match(source, /item\.section === 'needs_attention'/);
    assert.match(source, /item\.status === 'due_soon'/);
    assert.doesNotMatch(source, /className=\{(?:styles|overviewStyles)\.overviewCardLabels\}/);
    assert.doesNotMatch(source, /className=\{(?:styles|overviewStyles)\.overviewType\}/);
    assert.doesNotMatch(source, /function statusClassName\(/);
  }

  assert.match(fieldStyles, /\.overviewCard\.overviewCardNeedsAttention \{[\s\S]*?background: linear-gradient\(180deg, #fffafa 0%, #fff1f1 100%\);/);
  assert.match(fieldStyles, /\.overviewCard\.overviewCardDueSoon \{[\s\S]*?background: linear-gradient\(180deg, #fffdf8 0%, #fff6e5 100%\);/);
});

test('scheduled Owner maintenance uses the standard fuel-style location modal', () => {
  assert.match(ownerOverview, /import OwnerServiceLocationModal from '..\/owner-service-location-modal'/);
  assert.match(ownerOverview, /item\.type !== 'service' && item\.type !== 'checkup'/);
  assert.match(ownerOverview, /publicAssetCode/);
  assert.match(ownerOverview, /<OwnerServiceLocationModal/);
  assert.match(ownerServiceModal, /<FuelLocationModal/);
  assert.match(ownerServiceModal, /recordLabel=\{recordLabel\}/);
  assert.match(ownerServiceModal, /saveManagerServiceLocation/);
  assert.match(fuelLocationModal, /Location required/);
  assert.match(fuelLocationModal, /styles\.icon/);
  assert.match(fuelLocationModal, /recordLabel = 'fuel record'/);
  assert.match(fieldStyles, /\.locationGateActions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});
