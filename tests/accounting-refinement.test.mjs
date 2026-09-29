import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const ownerRegister = read('app/asset-register/asset-register-client.tsx');
const ownerStatusRoute = read('app/api/asset-register/status/route.ts');
const styles = read('app/asset-register/page.module.css');

test('owner finance flows support paid-off assets', () => {

  assert.match(ownerRegister, /type FinanceStatusChoice = AssetStatusChoice \| 'paid'/);
  assert.match(ownerStatusRoute, /normalizeFinanceStatusChoice/);
  assert.match(ownerStatusRoute, /financeStatus === 'paid'/);
  assert.match(ownerRegister, /function statusChoiceReportLabel\(value: FinanceStatusChoice\)/);
  assert.match(ownerRegister, /if \(value === 'paid'\) return 'Paid off'/);
  assert.match(ownerRegister, /function renderAssetStatusMark\(value: FinanceStatusChoice\)/);
});

test('acquisition editing lives inside Finance and no longer opens a separate owner modal', () => {

  assert.match(ownerRegister, /assetStatusAcquisitionPanel/);
  assert.match(ownerRegister, /loadFinanceAcquisitionDetails/);
  assert.doesNotMatch(ownerRegister, /openAcquisitionDetails\(activeAsset\)/);
  assert.doesNotMatch(ownerRegister, /aria-labelledby="acquisition-details-title"/);
});

test('owner disposal uses a compact choice-card layout and short delete subtitle', () => {
  assert.match(ownerRegister, /Remove or archive this asset safely\./);
  assert.match(ownerRegister, /assetDisposalReasonGrid/);
  assert.match(ownerRegister, /assetDisposalReasonButtonActive/);
  assert.match(styles, /\.deleteAssetOptionSubtitle[\s\S]*?white-space: nowrap !important/);
  assert.match(styles, /\.assetDisposalReasonGrid[\s\S]*?repeat\(3/);
});
