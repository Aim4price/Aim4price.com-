import { assertNoWebsiteReflow } from './helpers/site-layout-audit.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const client = read('app/my-invoices/my-invoices-client.tsx');
const styles = read('app/my-invoices/page.module.css');
const assetRegisterClient = read('app/asset-register/asset-register-client.tsx');
const assetRegisterStyles = read('app/asset-register/page.module.css');
const fuelClient = read('app/fuel/fuel-client.tsx');
const fuelStyles = read('app/fuel/page.module.css');
const notifications = read('lib/notifications.ts');

const modalStart = client.indexOf('{budgetModalOpen ?');
const modalEnd = client.indexOf('{budgetDeleteCandidate ?', modalStart);
const budgetModal = client.slice(modalStart, modalEnd);

test('spending budget uses a guided four-step flow with a dedicated period step', () => {
  assert.ok(modalStart >= 0 && modalEnd > modalStart, 'budget modal should be present');
  assert.match(client, /type BudgetWizardStep = 1 \| 2 \| 3 \| 4/);
  assert.match(client, /const \[budgetWizardStep, setBudgetWizardStep\]/);
  assert.match(budgetModal, /\[\['Coverage', 1\], \['Period', 2\], \['Limit', 3\], \['Review', 4\]\]/);
  assert.match(budgetModal, /Step ' \+ budgetWizardStep \+ ' of 4/);
  assert.match(budgetModal, /styles\.invoiceDropCodeModal/);
  assert.match(budgetModal, /styles\.invoiceDropWizardProgress/);
  assert.match(budgetModal, /styles\.invoiceDropWizardPanel/);
  assert.match(budgetModal, /What should this budget cover\?/);
  assert.match(budgetModal, /Choose the budget period/);
  assert.match(budgetModal, /Set the spending limit/);
  assert.match(budgetModal, /Review your budget/);
  assert.match(budgetModal, /onClick=\{continueBudgetWizard\}/);
  assert.match(budgetModal, /goBackBudgetWizard/);
  assert.doesNotMatch(budgetModal, /Asset scope|Limit &amp; alert|Budget coverage|Choose budget scope/);
});

test('coverage uses the Fuel Ledger saved-asset picker design with multi-select', () => {
  assert.match(budgetModal, /<strong>Choose assets<\/strong>/);
  assert.match(fuelClient, /<h2>[\s\S]*?: 'Choose Saved Assets'/);
  assert.match(budgetModal, /<h2 id="budget-scope-picker-title">Choose Saved Assets<\/h2>/);
  assert.match(budgetModal, /styles\.pickerToolbar/);
  assert.match(budgetModal, /styles\.budgetAssetPickerToolbar/);
  assert.match(budgetModal, /filteredBudgetAssets/);
  assert.match(budgetModal, /budgetPickerAssetIds\.includes\(asset\.id\)/);
  assert.match(budgetModal, /toggleBudgetPickerAsset\(asset\.id\)/);
  assert.match(budgetModal, /`Select all shown \(\$\{selectableFilteredBudgetAssets\.length\}\)`/);
  assert.match(budgetModal, /toggleAllFilteredBudgetAssets/);
  assert.match(budgetModal, /styles\.budgetSelectAllButton/);
  assert.match(budgetModal, /styles\.budgetAssetChoiceSelected/);
  assert.match(budgetModal, /data-asset-choice-selected=\{isSelected \? 'true' : undefined\}/);
  assert.equal(
    (budgetModal.match(/data-asset-choice-selected=/g) ?? []).length,
    1,
    'budget asset rows should declare their selected-state attribute once',
  );
  assert.match(budgetModal, /confirmBudgetAssetPicker/);
  assert.match(styles, /\.budgetAssetPickerToolbar\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto auto;/);
  assert.match(styles, /\.budgetAssetChoice\s*\{[^}]*justify-content:\s*flex-end;/);
  assert.match(styles, /\.budgetAssetPickerFooter\s*\{[^}]*margin:\s*0 clamp\(1\.25rem, calc\(var\(--website-design-vw(?:, 1vw)?\) \* 2\.4\), 2rem\);/);
  assert.match(fuelStyles, /\.fuelSlipFlowBackdrop \.exclusionPickerToolbar\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\) auto auto;/);
  assert.doesNotMatch(budgetModal, /role="radiogroup" aria-label="Budget scope"/);
  assert.doesNotMatch(budgetModal, /<strong>All assets<\/strong>|<strong>One asset<\/strong>/);
  assert.doesNotMatch(budgetModal, /budgetAssetSearchField|<SearchIcon aria-hidden="true" \/>/);
  assert.doesNotMatch(budgetModal, /<select\b/);
});

test('budget coverage uses its own complete asset list, independent of fuel exclusions', () => {
  const budgetAssetSelectors = client.slice(
    client.indexOf('const selectedBudgetAsset = useMemo'),
    client.indexOf('const filteredCostBudgets = useMemo'),
  );
  const createBudget = client.slice(
    client.indexOf('function openCreateBudget()'),
    client.indexOf('function openEditBudget('),
  );

  assert.match(client, /const \[budgetAssets, setBudgetAssets\] = useState<AssetOption\[]>\(\[\]\)/);
  assert.match(client, /assets\?: AssetOption\[]/);
  assert.match(budgetAssetSelectors, /budgetAssets\.find/);
  assert.match(budgetAssetSelectors, /budgetAssets\.filter/);
  assert.match(budgetAssetSelectors, /if \(!query\) return budgetAssets/);
  assert.match(createBudget, /budgetAssets\.some/);
  assert.match(budgetModal, /!budgetAssets\.length/);
  assert.doesNotMatch(budgetAssetSelectors, /workUseExcluded|fuel_asset_exclusions/);
});

test('period is selected on step two in a wider, responsive budget modal', () => {
  const coverageStart = budgetModal.indexOf('{budgetWizardStep === 1 ?');
  const periodStart = budgetModal.indexOf('{budgetWizardStep === 2 ?', coverageStart);
  const limitStart = budgetModal.indexOf('{budgetWizardStep === 3 ?', periodStart);
  const coverageStep = budgetModal.slice(coverageStart, periodStart);
  const periodStep = budgetModal.slice(periodStart, limitStart);

  assert.doesNotMatch(coverageStep, /Budget reset period|Monthly|Annual/);
  assert.match(periodStep, /Choose the budget period/);
  assert.match(periodStep, /role="group" aria-label="Budget reset period"/);
  assert.match(periodStep, /styles\.budgetWizardPeriodChoices/);
  assert.match(periodStep, /styles\.budgetWizardPeriodChoiceActive/);
  assert.match(periodStep, /A fresh limit starts each month\./);
  assert.match(periodStep, /A fresh limit starts each calendar year\./);
  assert.match(styles, /\.downloadModal\.budgetWizardModal\s*\{[^}]*width:\s*min\(1280px, 100%\) !important;/);
  assert.match(styles, /\.budgetWizardPeriodChoices\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(budgetModal, /\.map\(\(\[label, step\], index\) =>/);
  assert.match(budgetModal, /index < 3/);
  assert.match(budgetModal, /styles\.budgetWizardProgressConnector/);
  assert.match(budgetModal, /budgetWizardStep > step \? styles\.budgetWizardProgressConnectorComplete/);
  assert.match(styles, /\.budgetWizardProgressConnector\s*\{[^}]*display:\s*none;/);
  assertNoWebsiteReflow(styles);
  assert.match(styles, /@media \(min-width: 1000px\)[\s\S]*?\.budgetWizardProgressConnector\s*\{[^}]*display:\s*block;[^}]*width:\s*100%;[^}]*height:\s*2px;/);
  assert.match(styles, /\.budgetWizardProgressConnectorComplete\s*\{[^}]*background:\s*#83c8ae;/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.budgetWizardModal \.invoiceDropWizardProgress\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/);
});

test('period-specific duplicate checks happen after coverage is selected', () => {
  const continueBudgetWizard = client.slice(
    client.indexOf('function continueBudgetWizard()'),
    client.indexOf('function goBackBudgetWizard()'),
  );

  assert.match(client, /const budgetUnavailableAssetIdsByPeriod = useMemo/);
  assert.match(client, /const budgetPickerUnavailableAssetIds = useMemo/);
  assert.match(client, /budgetUnavailableAssetIdsByPeriod\.monthly\.has\(asset\.id\)/);
  assert.match(client, /budgetUnavailableAssetIdsByPeriod\.annual\.has\(asset\.id\)/);
  assert.match(continueBudgetWizard, /if \(budgetWizardStep === 2\)[\s\S]*?budgetPeriodUnavailableAssetIds\.has/);
  assert.match(continueBudgetWizard, /budgetUnavailableAllPeriods\.has\(budgetDraft\.period\)/);
  assert.match(continueBudgetWizard, /setBudgetWizardStep\(3\)/);
});

test('limit validation happens before review and the review preserves every choice', () => {
  assert.match(client, /const budgetLimitIsValid = Number\.isFinite\(budgetAmountValue\)/);
  assert.match(client, /budgetWarningValue >= 1/);
  assert.match(client, /budgetWarningValue <= 99/);
  assert.match(client, /if \(!budgetLimitIsValid\)[\s\S]*?setBudgetFormError/);
  assert.match(budgetModal, /<dt>Assets<\/dt>/);
  assert.match(budgetModal, /<dt>Period<\/dt>/);
  assert.match(budgetModal, /<dt>Budget<\/dt>/);
  assert.match(budgetModal, /<dt>Warning level<\/dt>/);
  assert.match(budgetModal, /<dt>Fuel slips<\/dt>/);
});

test('multi-asset creation saves one independently editable budget per selected asset', () => {
  assert.match(client, /const assetIdsToSave: Array<string \| null>/);
  assert.match(client, /Promise\.all\(assetIdsToSave\.map\(async \(assetId\) =>/);
  assert.match(client, /method: editingBudgetId \? 'PATCH' : 'POST'/);
  assert.match(client, /setBudgetSelectedAssetIds\(remainingAssetIds\)/);
  assert.match(client, /spending budgets created/);
});

test('warning-level asset budget cards and notifications are red priority alerts', () => {
  assert.match(client, /data-budget-status=\{budget\.status\}/);
  assert.match(client, /budget\.status === 'warning'[\s\S]*?'budgetCardWarning'/);
  assert.match(styles, /\.budgetCardWarning\s*\{[^}]*--budget-accent:\s*#b42318;[^}]*--budget-accent-soft:\s*#fff0ef;/);
  assert.match(styles, /\.budgetCardWarning\.budgetCardFocused/);

  assert.match(assetRegisterClient, /fetch\('\/api\/my-invoices\/budgets'/);
  assert.match(assetRegisterClient, /costBudgetStatusByAssetId\[asset\.id\]/);
  assert.match(assetRegisterClient, /styles\.assetCardBudgetWarning/);
  assert.match(assetRegisterClient, /data-cost-budget-status=\{costBudgetStatus \|\| undefined\}/);
  assert.match(assetRegisterClient, /Budget warning/);
  assert.match(assetRegisterStyles, /\.page \.assetCardBudgetWarning\s*\{[^}]*#b42318/);
  assert.match(assetRegisterStyles, /\.badgeBudgetWarning\s*\{/);

  const budgetNotifications = notifications.slice(
    notifications.indexOf('async function listOwnerCostBudgetNotifications'),
    notifications.indexOf('function correctionActor'),
  );
  assert.match(budgetNotifications, /tone: 'warning'/);
  assert.match(budgetNotifications, /priority: true/);
});

