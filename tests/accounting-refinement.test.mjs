import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const accountantManage = read('components/AccountantAssetManageModal.tsx');
const accountantFinanceRoute = read('app/api/accountant/registers/[shareId]/assets/[assetId]/finance/route.ts');
const accountantWorkspace = read('lib/accountant-workspace.ts');
const ownerRegister = read('app/asset-register/asset-register-client.tsx');
const ownerStatusRoute = read('app/api/asset-register/status/route.ts');
const styles = read('app/asset-register/page.module.css');

test('accountant Manage keeps one disposal entry and concise one-line option copy', () => {
  assert.equal((accountantManage.match(/<strong>Dispose asset<\/strong>/g) || []).length, 1);
  assert.doesNotMatch(accountantManage, /Delete incorrect asset|setView\('delete'\)/);
  assert.match(accountantManage, /Manage finance, payment and acquisition details\./);
  assert.match(styles, /\.accountantManageModal \.assetOptionsGrid \.optionActionButton small[\s\S]*?white-space: nowrap !important/);
});

test('accountant Manage maintains a viewport-fixed blur while modal content scrolls', () => {
  assert.match(accountantManage, /accountantManageOverlay/);
  assert.match(accountantManage, /accountantManageBackdrop/);
  assert.match(styles, /\.accountantManageBackdrop[\s\S]*?position: fixed !important/);
  assert.match(styles, /\.accountantManageBody[\s\S]*?overflow-y: auto !important/);
  assert.match(styles, /\.accountantManageModal \.assetSettingsActions[\s\S]*?position: sticky !important/);
});

test('owner and accountant finance flows support paid-off assets', () => {
  assert.match(accountantManage, /<option value="paid">Paid off<\/option>/);
  assert.match(accountantManage, /finance\.financeStatus === 'paid'/);
  assert.match(accountantWorkspace, /\['yes', 'paid'\]\.includes\(status\)/);
  assert.match(accountantFinanceRoute, /\['yes', 'paid'\]\.includes\(financeStatus\)/);
  assert.match(ownerRegister, /type FinanceStatusChoice = AssetStatusChoice \| 'paid'/);
  assert.match(ownerStatusRoute, /normalizeFinanceStatusChoice/);
  assert.match(ownerStatusRoute, /financeStatus === 'paid'/);
  assert.match(ownerRegister, /function statusChoiceReportLabel\(value: FinanceStatusChoice\)/);
  assert.match(ownerRegister, /if \(value === 'paid'\) return 'Paid off'/);
  assert.match(ownerRegister, /function renderAssetStatusMark\(value: FinanceStatusChoice\)/);
});

test('acquisition editing lives inside Finance and no longer opens a separate owner modal', () => {
  assert.match(accountantManage, /Finance and acquisition/);
  assert.match(accountantManage, /Acquisition date/);
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
