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

test('spending budget uses a guided five-step flow with a dedicated period step', () => {
  assert.ok(modalStart >= 0 && modalEnd > modalStart, 'budget modal should be present');
  assert.match(client, /type BudgetWizardStep = 1 \| 2 \| 3 \| 4 \| 5/);
  assert.match(client, /const \[budgetWizardStep, setBudgetWizardStep\]/);
  assert.doesNotMatch(budgetModal, /styles\.invoiceDropWizardProgress/);
  assert.match(budgetModal, /styles\.invoiceDropCodeModal/);
  assert.match(budgetModal, /styles\.invoiceDropWizardPanel/);
  assert.match(budgetModal, /Which costs should count towards this budget\?/);
  assert.match(budgetModal, /Choose the budget period/);
  assert.match(budgetModal, /Set the spending limit/);
  assert.match(budgetModal, /Review budget/);
  assert.match(budgetModal, /onClick=\{continueBudgetWizard\}/);
  assert.match(budgetModal, /goBackBudgetWizard/);
  assert.doesNotMatch(budgetModal, /Asset scope|Limit &amp; alert|Budget coverage|Choose budget scope/);
});

test('coverage uses the Fuel Ledger saved-asset picker design with multi-select', () => {
  for (const picker of [fuelClient, budgetModal]) {
    assert.match(picker, /data-asset-choice-modal="true"/);
    assert.match(picker, /data-asset-choice-toolbar="true"/);
    assert.match(picker, /data-asset-choice-row="true"/);
  }
  assert.match(budgetModal, /<h2 id="budget-scope-picker-title">Choose assets<\/h2>/);
  assert.match(budgetModal, /styles\.pickerToolbar/);
  assert.match(budgetModal, /styles\.budgetAssetPickerToolbar/);
  assert.match(budgetModal, /filteredBudgetAssets/);
  assert.match(budgetModal, /budgetPickerAssetIds\.includes\(asset\.id\)/);
  assert.match(budgetModal, /toggleBudgetPickerAsset\(asset\.id\)/);
  assert.match(budgetModal, /`Select all shown \(\$\{filteredBudgetAssets\.length\}\)`/);
  assert.match(budgetModal, /toggleAllFilteredBudgetAssets/);
  assert.match(budgetModal, /styles\.budgetSelectAllButton/);
  assert.match(budgetModal, /pickerStyles\.multi/);
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
    client.indexOf('function openCreateBudget('),
    client.indexOf('function openEditBudget('),
  );

  assert.match(client, /const \[budgetAssets, setBudgetAssets\] = useState<AssetOption\[]>\(\[\]\)/);
  assert.match(client, /assets\?: AssetOption\[]/);
  assert.match(budgetAssetSelectors, /budgetAssets\.find/);
  assert.match(budgetAssetSelectors, /budgetAssets\.filter/);
  assert.match(budgetAssetSelectors, /if \(!query\) return budgetAssets/);
  assert.match(createBudget, /budgetAssets\.some/);
  assert.match(budgetModal, /Add a saved asset to create a budget/);
  assert.doesNotMatch(budgetAssetSelectors, /workUseExcluded|fuel_asset_exclusions/);
});

test('cost categories have a dedicated slide before selecting the period', () => {
  const categoriesStart = budgetModal.indexOf('<OwnershipReportCategories');
  const periodStart = budgetModal.indexOf('aria-labelledby="budget-period-title"');
  const limitStart = budgetModal.indexOf('aria-labelledby="budget-limit-title"');
  assert.ok(categoriesStart > 0 && periodStart > categoriesStart && limitStart > periodStart);
  const categoryStep = budgetModal.slice(categoriesStart, periodStart);
  const periodStep = budgetModal.slice(periodStart, limitStart);
  assert.match(categoryStep, /Which costs should count towards this budget/);
  assert.match(categoryStep, /selected=\{budgetDraft\.categories\}/);
  assert.match(budgetModal, /budgetWizardStep === 2 && !budgetDraft\.categories\.length/);
  assert.match(categoryStep, /headingRef=\{budgetWizardStepHeadingRef\}/);
  assert.doesNotMatch(categoryStep, /<details|Budget reset period/);
  assert.doesNotMatch(periodStep, /costCategories\.map/);
  assert.match(periodStep, /Choose the budget period/);
  assert.match(periodStep, /role="group" aria-label="Budget reset period"/);
  assert.match(periodStep, /styles\.budgetWizardPeriodChoices/);
  assert.match(periodStep, /styles\.budgetWizardPeriodChoiceActive/);
  assert.match(periodStep, /A fresh limit starts each month\./);
  assert.match(periodStep, /A fresh limit starts each calendar year\./);
  assert.match(styles, /\.downloadModal\.budgetWizardModal\s*\{[^}]*width:\s*min\(1280px, 100%\) !important;/);
  assert.match(styles, /\.budgetWizardPeriodChoices\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
  assert.doesNotMatch(budgetModal, /styles\.budgetWizardProgressConnector/);
  assertNoWebsiteReflow(styles);
});

test('period-specific duplicate checks happen after coverage is selected', () => {
  const continueBudgetWizard = client.slice(
    client.indexOf('function continueBudgetWizard()'),
    client.indexOf('function goBackBudgetWizard()'),
  );

  assert.match(client, /const budgetUnavailableAssetIdsByPeriod = useMemo/);
  assert.match(continueBudgetWizard, /if \(budgetWizardStep === 3\)[\s\S]*?budgetPeriodUnavailableAssetIds\.has/);
  assert.match(continueBudgetWizard, /budgetUnavailableAllPeriods\.has\(budgetDraft\.period\)/);
  assert.match(continueBudgetWizard, /setBudgetWizardStep\(4\)/);
});

test('limit validation happens before review and the review preserves every choice', () => {
  assert.match(client, /const budgetLimitIsValid = Number\.isFinite\(budgetAmountValue\)/);
  assert.match(client, /budgetWarningValue >= 1/);
  assert.match(client, /budgetWarningValue <= 99/);
  assert.match(client, /if \(!budgetLimitIsValid\)[\s\S]*?setBudgetFormError/);
  assert.match(budgetModal, /selectedBudgetAssets.length === 1 \? 'Asset' : 'Assets'/);
  for (const label of ['Period', 'Alert at', 'Fuel slip costs']) {
    assert.ok(budgetModal.includes(`<dt>${label}</dt>`));
  }
  assert.match(budgetModal, /'Monthly budget' : 'Annual budget'/);
  assert.match(budgetModal, /budgetAmountValue \* budgetWarningValue \/ 100/);
  assert.match(budgetModal, /'Included' : 'Excluded'/);

});

test('users can choose separate limits or one group budget', () => {
  assert.match(budgetModal, /Each gets its own spending limit/);
  assert.doesNotMatch(budgetModal, /Whole register|registerChoice|registers\.map|Choose umbrella/i);
  assert.match(budgetModal, /selectedBudgetAssets\.length > 1 \? 'Amount per asset'/);
  assert.match(budgetModal, /budgetDraft\.registerId \? 'Register'/);
  assert.match(client, /assetIdsToSave: Array<string \| null> = groupBudget \? \[null\] : editingBudgetId[\s\S]*?: budgetSelectedAssetIds;/);
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

  assert.match(assetRegisterClient, /ownerFetch\('\/api\/my-invoices\/budgets'/);
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

