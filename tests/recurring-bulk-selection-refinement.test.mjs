import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const costs = read('app/my-invoices/my-invoices-client.tsx');
const costStyles = read('app/my-invoices/page.module.css');
const accountantCosts = read('app/accountant/registers/[shareId]/costs/page.tsx');
const ownerRegister = read('app/asset-register/asset-register-client.tsx');
const accountantManage = read('components/AccountantAssetManageModal.tsx');
const collaboration = read('lib/accounting-collaboration.ts');

test('disposal keeps the duplicate warning but removes the normal orange disclaimer', () => {
  assert.doesNotMatch(ownerRegister, /The asset will leave active totals but remain available to Additions & Disposals reports/);
  assert.match(ownerRegister, /This permanently removes the duplicate asset/);
  assert.match(ownerRegister, /disposalDraft\.reason === 'mistake_duplicate'/);
});

test('recurring commitment uses concise copy and the shared saved-asset picker', () => {
  assert.match(costs, /Track future recurring asset costs\./);
  assert.match(costStyles, /\.recurringChoiceOption \.choiceTitleBlock small[\s\S]*?white-space: nowrap/);
  assert.doesNotMatch(costs, /This does not create an expense\. Add each actual invoice or payment/);
  assert.match(costs, /recurringAssetPickerOpen/);
  assert.match(costs, /Choose Saved Assets/);
  assert.match(costs, /recurringPickerAssetIds/);
  assert.match(costs, /aria-pressed=\{isSelected\}/);
  assert.match(costs, /assetIds: recurringAssetIds/);
  assert.doesNotMatch(costs, /<select[^>]*multiple/);
});

test('the accountant Cost Ledger reuses the same recurring commitment flow', () => {
  assert.match(accountantCosts, /import MyInvoicesClient/);
  assert.match(accountantCosts, /<MyInvoicesClient accountantShareId=\{params\.shareId\}/);
});

test('owner and accountant group finance both expose card-based multi-asset selection', () => {
  assert.match(ownerRegister, /Choose assets for bulk finance/);
  assert.match(ownerRegister, /saveLinkedBulkFinanceAssets/);
  assert.match(ownerRegister, /financeType: 'bulk_group'/);
  assert.match(accountantManage, /Choose financed assets/);
  assert.match(accountantManage, /linkedAssetIds: finance\.financeType === 'bulk_group'/);
  assert.match(accountantManage, /toggleFinanceAsset/);
});

test('accountant group finance validates register assets and synchronises formal links', () => {
  assert.match(collaboration, /Array\.isArray\(body\.linkedAssetIds\)/);
  assert.match(collaboration, /ACCOUNTANT_BULK_FINANCE_REQUIRES_MULTIPLE_ASSETS/);
  assert.match(collaboration, /linkedAsset\.registerId !== access\.registerId/);
  assert.match(collaboration, /delete from public\.asset_finance_agreement_assets link/);
  assert.match(collaboration, /linkedAssetIds/);
  assert.match(collaboration, /'financed_acquisition'/);
});
