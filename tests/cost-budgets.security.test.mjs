import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const budgets = read('lib/cost-budgets.ts');
const collectionRoute = read('app/api/my-invoices/budgets/route.ts');
const itemRoute = read('app/api/my-invoices/budgets/[budgetId]/route.ts');
const migration = read('database/migrations/85-cost-budget-tracking.sql');
const notifications = read('lib/notifications.ts');
const inbox = read('lib/notification-inbox.ts');
const ownerNotificationsRoute = read('app/api/owner-app/notifications/route.ts');
const ownerNotificationsClient = read('app/owner-app/notifications/owner-notifications-client.tsx');
const appHeader = read('components/AppHeader.tsx');
const costClient = read('app/my-invoices/my-invoices-client.tsx');
const costStyles = read('app/my-invoices/page.module.css');
const assetRegisterClient = read('app/asset-register/asset-register-client.tsx');
const assetRegisterStyles = read('app/asset-register/page.module.css');
const accountDeletion = read('lib/account-deletion.ts');

test('budget API is finance-authorized and always uses the authenticated owner scope', () => {
  assert.match(collectionRoute, /export async function GET/);
  assert.match(collectionRoute, /export async function POST/);
  assert.match(itemRoute, /export async function PATCH/);
  assert.match(itemRoute, /export async function DELETE/);

  for (const route of [collectionRoute, itemRoute]) {
    assert.match(route, /getOwnerAppAccess/);
    assert.match(route, /ownerAppCan\(access, 'manage_finance'\)/);
    assert.match(route, /ownerAppCanAccessAsset/);
    assert.match(route, /access\.assetScope === 'all'/);
    assert.match(route, /access\.ownerUserId/);
  }

  assert.match(budgets, /where id = \$1::uuid\s+and user_id = \$2/);
  assert.match(budgets, /delete from public\.asset_cost_budgets[\s\S]+where id = \$1::uuid[\s\S]+and user_id = \$2/);
  assert.match(budgets, /getAssetRegisterItemById\(userId, assetId\)/);
});

test('progress uses the same incurred, owner-visible VAT-inclusive totals as Cost Ledger', () => {
  assert.match(budgets, /timeZone: 'Africa\/Johannesburg'/);
  assert.match(budgets, /sum\(invoice\.total_inc_vat\)/);
  assert.match(budgets, /invoice\.invoice_date is not null/);
  assert.match(budgets, /invoice\.invoice_date >=/);
  assert.match(budgets, /invoice\.invoice_date </);
  assert.match(budgets, /invoice\.created_by_dealer_user_id is null/);
  assert.match(budgets, /invoice\.owner_storage_status in \('owner', 'approved'\)/);
  assert.match(budgets, /coalesce\(invoice\.source, 'manual'\) <> 'fuel_slip'/);
  assert.doesNotMatch(budgets, /asset_invoice_blocks|asset_recurring_commitments|document_capture_requests/);
});

test('budget and alert schema is additive, constrained and concurrency-safe', () => {
  assert.match(migration, /create table if not exists public\.asset_cost_budgets/i);
  assert.match(migration, /references public\.asset_register_items\(id\) on delete cascade/i);
  assert.match(migration, /check \(period in \('monthly', 'annual'\)\)/i);
  assert.match(migration, /check \(amount > 0\)/i);
  assert.match(migration, /warning_percent between 1 and 99/i);
  assert.match(migration, /where asset_register_item_id is null/i);
  assert.match(migration, /where asset_register_item_id is not null/i);
  assert.match(migration, /create table if not exists public\.asset_cost_budget_alerts/i);
  assert.match(migration, /unique \(budget_id, budget_revision, period_key, alert_kind\)/i);
  assert.match(migration, /alert_kind in \('warning', 'over_budget'\)/i);
  assert.doesNotMatch(migration, /\bdrop\s+table\b|\btruncate\s+table\b/i);
  assert.match(accountDeletion, /'asset_cost_budgets'/);
});

test('threshold alerts are stable, revision-aware and permission scoped', () => {
  assert.match(notifications, /\| 'cost_budget'/);
  assert.match(notifications, /category: 'cost_budget'/);
  assert.match(
    notifications,
    /cost-budget:\$\{alert\.budgetId\}:r\$\{alert\.budgetRevision\}:\$\{alert\.periodKey\}:\$\{alert\.alertKind\}/,
  );
  assert.match(notifications, /alert\.alertKind === 'over_budget'/);
  const budgetNotificationBuilder = notifications.slice(
    notifications.indexOf('async function listOwnerCostBudgetNotifications'),
    notifications.indexOf('function correctionActor'),
  );
  assert.match(budgetNotificationBuilder, /priority: true/);
  assert.match(inbox, /includeCostBudgetNotifications/);
  assert.match(inbox, /category <> 'cost_budget'/);
  const actionRequired = inbox.slice(
    inbox.indexOf('function isActionRequired'),
    inbox.indexOf('function payloadFor'),
  );
  assert.doesNotMatch(actionRequired, /cost_budget|costBudget/i);

  assert.match(ownerNotificationsRoute, /ownerAppCan\(access, 'manage_finance'\)/);
  assert.match(ownerNotificationsRoute, /access\.assetScope === 'all'/);
  assert.match(ownerNotificationsRoute, /item\.category === 'cost_budget'/);
  assert.match(ownerNotificationsClient, /item\.category === 'cost_budget'/);
  assert.match(appHeader, /'cost_budget'/);
});

test('Cost Ledger exposes total-spend controls only to the direct owner experience', () => {
  assert.match(costClient, /const canManageBudgets = !dealerMode && !accountantShareId && !accountantRegisterId/);
  assert.match(costClient, /Spending budgets/);
  assert.match(costClient, /Budget amount/);
  assert.match(costClient, /Count fuel slip costs/);
  assert.match(costClient, /warningPercent/);
  assert.match(costClient, /budgetId/);
  assert.match(costClient, /focusedBudgetId/);
  assert.match(costClient, /invoice\.source === 'fuel_slip'/);
  assert.match(costClient, /Promise\.all\(\[reloadData\(\), reloadBudgets\(\)\]\)/);
  assert.match(costClient, /aim4price:cost-ledger-updated/);
  assert.doesNotMatch(costClient, /CostBudgetDraft[\s\S]{0,400}category:/);

  const budgetStyleNames = Array.from(
    costClient.matchAll(/styles\.(budget[A-Z][A-Za-z0-9]*)/g),
    (match) => match[1],
  );
  for (const styleName of new Set(budgetStyleNames)) {
    assert.match(costStyles, new RegExp(`\\.${styleName}\\b`), `missing .${styleName} CSS module class`);
  }
});

test('owner Cost Ledger presents the four primary actions in the intended order', () => {
  const actionGridLabel = costClient.indexOf('aria-label="Cost Ledger actions"');
  const actionGridStart = costClient.lastIndexOf('<section', actionGridLabel);
  const toolbarStart = costClient.indexOf('<section className={`${styles.invoiceToolbar}', actionGridStart);
  const actionGrid = costClient.slice(actionGridStart, toolbarStart);

  assert.ok(actionGridStart >= 0 && toolbarStart > actionGridStart, 'owner action grid should precede the search toolbar');
  assert.match(costClient, /<h1>COST TRACKING SYSTEM<\/h1>/);
  assert.match(costClient, /\{!dealerMode \? \(\s*<section[\s\S]*?styles\.costActionGrid/);
  assert.match(actionGrid, /aria-label="Cost Ledger actions"/);

  const expectedActions = [
    ['Add Cost', /onClick=\{\(\) => openAddInvoiceModal\(\)\}/],
    ['Budgets', /onClick=\{openBudgetManager\}/],
    ['Contribution', /openInvoiceDropCodeManager\(\)/],
    ['Download', /onClick=\{openDownloadModal\}/],
  ];
  let previousActionIndex = -1;
  for (const [label, handler] of expectedActions) {
    const actionIndex = actionGrid.indexOf(`<span>${label}</span>`);
    assert.ok(actionIndex > previousActionIndex, `${label} should appear after the previous owner action`);
    assert.match(actionGrid, handler, `${label} should retain its intended click handler`);
    previousActionIndex = actionIndex;
  }

  assert.match(actionGrid, /ref=\{budgetManagerTriggerRef\}/);
  assert.match(actionGrid, /aria-haspopup="dialog"/);
  assert.match(costClient, /costBudgets\.filter\(\(budget\) => budget\.status !== 'on_track'\)\.length/);
  assert.match(actionGrid, /budgetAttentionCount/);
  assert.match(actionGrid, /Add an asset first/);
  assert.match(actionGrid, /Add a saved asset before creating a contribution code/);
  assert.doesNotMatch(costClient, /styles\.invoiceDropCodeBanner/);

  assert.match(
    costStyles,
    /\.costActionGrid\s*\{\s*display: grid;\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/,
  );
  for (const styleName of ['costActionButton', 'costActionAdd', 'costActionBudgets', 'costActionContribution', 'costActionDownload']) {
    assert.match(costStyles, new RegExp(`\\.${styleName}\\b`), `missing .${styleName} owner-action styling`);
  }
  assert.match(costStyles, /\.costActionGrid \.costActionButton\s*\{/);
  assert.match(costStyles, /\.costActionButton\.costActionAdd\s*\{/);
  assert.match(costStyles, /\.costActionButton\.costActionBudgets\s*\{/);
  assert.match(costStyles, /\.costActionButton\.costActionContribution\s*\{/);
  assert.match(
    costStyles,
    /@media \(max-width: 980px\)[\s\S]*?\.costActionGrid\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
  );
  assert.match(
    costStyles,
    /@media \(max-width: 640px\)[\s\S]*?\.costActionGrid\s*\{\s*grid-template-columns: 1fr;/,
  );
});

test('Cost Ledger title and actions match the Asset Register sizing contract', () => {
  assert.match(
    assetRegisterStyles,
    /\.businessRegisterTitleCard\s*\{[^}]*min-height:\s*clamp\(5\.1rem,\s*7vw,\s*6\.1rem\)\s*!important;[^}]*padding:\s*clamp\(1\.15rem,\s*2vw,\s*1\.55rem\)\s+clamp\(1\.25rem,\s*2\.6vw,\s*2rem\)\s*!important;/,
  );
  assert.match(
    assetRegisterStyles,
    /\.businessRegisterTitleBlock \.businessRegisterTitleCard h1\s*\{[^}]*font-size:\s*clamp\(2\.35rem,\s*4\.15vw,\s*3\.55rem\)\s*!important;/,
  );
  assert.match(
    assetRegisterStyles,
    /\.registerHeader \.headerActions \.filterTriggerButton\s*\{[^}]*min-height:\s*clamp\(3\.45rem,\s*4\.2vw,\s*3\.9rem\)\s*!important;/,
  );

  assert.match(
    costStyles,
    /--ledger-inline-gutter:\s*clamp\(0\.7rem,\s*2vw,\s*1\.5rem\);[\s\S]*?--ledger-panel-inset:\s*clamp\(1\.15rem,\s*1\.9vw,\s*1\.7rem\);/,
  );
  assert.match(
    costStyles,
    /\.page:not\(\.dealerCostsPage\) \.shell\s*\{[^}]*width:\s*min\(calc\(100% - \(var\(--ledger-inline-gutter\) \* 2\)\),\s*1320px\);[^}]*padding-inline:\s*var\(--ledger-panel-inset\);/,
  );
  assert.match(
    costStyles,
    /\.pageTitleBlock > div\s*\{[^}]*min-height:\s*clamp\(5\.1rem,\s*7vw,\s*6\.1rem\);[^}]*padding:\s*clamp\(1\.15rem,\s*2vw,\s*1\.55rem\)\s+clamp\(1\.25rem,\s*2\.6vw,\s*2rem\);[^}]*border-radius:\s*clamp\(1\.25rem,\s*2vw,\s*1\.7rem\);/,
  );
  assert.match(
    costStyles,
    /\.pageTitleBlock h1\s*\{[^}]*font-size:\s*clamp\(2\.35rem,\s*4\.15vw,\s*3\.55rem\);/,
  );
  assert.match(
    costStyles,
    /\.costActionGrid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);[^}]*gap:\s*clamp\(0\.78rem,\s*1\.35vw,\s*1\.25rem\);/,
  );
  assert.match(
    costStyles,
    /\.costActionGrid \.costActionButton\s*\{[^}]*min-height:\s*clamp\(3\.62rem,\s*4\.45vw,\s*4\.08rem\);[^}]*border-radius:\s*clamp\(1rem,\s*1\.45vw,\s*1\.22rem\);[^}]*font-size:\s*clamp\(0\.98rem,\s*1\.15vw,\s*1\.08rem\);/,
  );
  assert.match(
    costStyles,
    /@media \(max-width: 640px\)[\s\S]*?\.pageTitleBlock > div\s*\{[^}]*min-height:\s*4\.35rem;[^}]*padding:\s*1rem 1\.05rem;[^}]*border-radius:\s*1\.15rem;[^}]*\}[\s\S]*?\.pageTitleBlock h1\s*\{[^}]*font-size:\s*clamp\(1\.75rem,\s*9vw,\s*2\.2rem\);[^}]*\}[\s\S]*?\.costActionGrid\s*\{[^}]*grid-template-columns:\s*1fr;[^}]*gap:\s*0\.65rem;[^}]*\}[\s\S]*?\.costActionGrid \.costActionButton\s*\{[^}]*min-height:\s*3\.25rem;/,
  );
});

test('owner search remains a long field with a dedicated adjacent Filter button', () => {
  const toolbarStart = costClient.indexOf('<section className={`${styles.invoiceToolbar}');
  const toolbarEnd = costClient.indexOf('<CaptureRequestStatusList', toolbarStart);
  const toolbar = costClient.slice(toolbarStart, toolbarEnd);

  assert.ok(toolbarStart >= 0 && toolbarEnd > toolbarStart, 'saved-cost search toolbar should be present');
  assert.match(toolbar, /styles\.ownerInvoiceToolbar/);
  assert.match(toolbar, /<label className=\{styles\.searchWrap\}>[\s\S]*?<input[\s\S]*?type="search"/);
  assert.match(toolbar, /Search suppliers, assets, invoice numbers or costs\.\.\./);
  assert.match(
    toolbar,
    /\) : \(\s*<button[^>]+className=\{`[^`]*styles\.searchFilterButton[^`]*`\} onClick=\{openFilterPanel\}>/,
  );

  assert.match(
    costStyles,
    /\.ownerInvoiceToolbar\s*\{\s*grid-template-columns: minmax\(0, 1fr\) auto;\s*\}/,
  );
  assert.match(costStyles, /\.searchFilterButton\s*\{\s*min-width: 11\.5rem;\s*\}/);
  assert.match(
    costStyles,
    /@media \(max-width: 600px\)[\s\S]*?\.ownerInvoiceToolbar\s*\{\s*grid-template-columns: 1fr;\s*\}/,
  );
});

test('budget overview opens in a focused manager dialog and deep links reveal it', () => {
  const managerStart = costClient.indexOf('{budgetManagerOpen && !budgetModalOpen && !budgetDeleteCandidate ?');
  const formStart = costClient.indexOf('{budgetModalOpen ?', managerStart);
  const manager = costClient.slice(managerStart, formStart);

  assert.ok(managerStart >= 0 && formStart > managerStart, 'budget manager should wrap the existing budget form');
  assert.match(manager, /aria-labelledby="budget-manager-title"/);
  assert.match(manager, /styles\.budgetManagerModal/);
  assert.match(manager, /<h2 id="budget-manager-title">Spending budgets<\/h2>/);
  assert.match(manager, /onClick=\{openCreateBudget\}/);
  assert.match(manager, /costBudgets\.map\(\(budget\) =>/);
  assert.match(manager, /onClick=\{\(\) => openEditBudget\(budget\)\}/);
  assert.match(manager, /onClick=\{closeBudgetManager\}>Done<\/button>/);
  assert.match(manager, /ref=\{budgetManagerDialogRef\}/);
  assert.match(manager, /tabIndex=\{-1\}/);
  assert.match(manager, /budgetManagerNotice/);

  const deepLinkStart = costClient.indexOf("const budgetId = routeSearchParams.get('budgetId')");
  const deepLinkEnd = costClient.indexOf('  useEffect(() => {', deepLinkStart);
  const deepLinkEffect = costClient.slice(deepLinkStart, deepLinkEnd);
  const openManagerIndex = deepLinkEffect.indexOf('setBudgetManagerOpen(true)');
  const focusBudgetIndex = deepLinkEffect.indexOf('setFocusedBudgetId(budget.id)');
  const scrollBudgetIndex = deepLinkEffect.indexOf('scrollIntoView');

  assert.ok(deepLinkStart >= 0 && deepLinkEnd > deepLinkStart, 'budget deep-link effect should be present');
  assert.ok(openManagerIndex >= 0, 'budget deep links should open the manager');
  assert.ok(focusBudgetIndex > openManagerIndex, 'the manager should open before selecting the focused budget');
  assert.ok(scrollBudgetIndex > focusBudgetIndex, 'the focused budget should be selected before it is scrolled into view');
  assert.match(
    costClient,
    /function closeBudgetManager\(\) \{[\s\S]*?setBudgetManagerOpen\(false\);[\s\S]*?requestAnimationFrame\(\(\) => budgetManagerTriggerRef\.current\?\.focus\(\)\);[\s\S]*?\}/,
  );
  assert.match(costClient, /if \(event\.key === 'Escape'\)[\s\S]*?setBudgetManagerOpen\(false\)/);
  assert.match(costClient, /event\.key !== 'Tab'/);
  assert.match(costClient, /pageShell\?\.setAttribute\('inert', ''\)/);
  assert.match(costClient, /pageShell\?\.removeAttribute\('inert'\)/);
  assert.match(costClient, /setBudgetDeleteError\(error instanceof Error/);

  assert.match(costStyles, /\.budgetModal,\s*\.budgetManagerModal\s*\{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\) auto;/);
  for (const styleName of ['budgetManagerBody', 'budgetManagerSection', 'budgetManagerToolbar', 'budgetManagerFooter']) {
    assert.match(costStyles, new RegExp(`\\.${styleName}\\b`), `missing .${styleName} manager styling`);
  }
});

test('budget setup uses a compact three-step wizard and shared searchable asset picker', () => {
  const modalStart = costClient.indexOf('{budgetModalOpen ?');
  const modalEnd = costClient.indexOf('{budgetDeleteCandidate ?', modalStart);
  const budgetModal = costClient.slice(modalStart, modalEnd);

  assert.ok(modalStart >= 0 && modalEnd > modalStart, 'budget modal source should be present');
  assert.match(budgetModal, /\[\['Coverage', 1\], \['Limit', 2\], \['Review', 3\]\]/);
  assert.match(budgetModal, /budgetWizardStep === 1/);
  assert.match(budgetModal, /budgetWizardStep === 2/);
  assert.match(budgetModal, /budgetWizardStep === 3/);
  assert.match(budgetModal, /Choose an asset/);
  assert.match(budgetModal, /Search saved assets/);
  assert.match(budgetModal, /budgetAssetPickerOpen/);
  assert.match(budgetModal, /budgetScopeTriggerRef/);
  assert.match(budgetModal, /filteredBudgetAssets/);
  assert.doesNotMatch(budgetModal, /<select\b/);
  assert.doesNotMatch(budgetModal, /Asset scope|Limit &amp; alert|Cost control/);
  assert.match(costStyles, /\.budgetWizardModal\b/);
  assert.match(costStyles, /\.budgetReviewGrid\b/);
  assert.match(costStyles, /\.budgetScopeRowSelected\b/);
});

test('warning-level budget cards and notifications use the red priority treatment', () => {
  assert.match(costClient, /data-budget-status=\{budget\.status\}/);
  assert.match(costClient, /budget\.status === 'warning'[\s\S]*?'budgetCardWarning'/);
  assert.match(costStyles, /\.budgetCardWarning\s*\{[^}]*--budget-accent:\s*#b42318;[^}]*--budget-accent-soft:\s*#fff0ef;/);
  assert.match(costStyles, /\.budgetCardWarning\.budgetCardFocused/);
  assert.match(assetRegisterClient, /fetch\('\/api\/my-invoices\/budgets'/);
  assert.match(assetRegisterClient, /styles\.assetCardBudgetWarning/);
  assert.match(assetRegisterClient, /data-cost-budget-status=\{costBudgetStatus \|\| undefined\}/);
  assert.match(assetRegisterStyles, /\.page \.assetCardBudgetWarning\s*\{[^}]*#b42318/);
  assert.match(assetRegisterStyles, /\.badgeBudgetWarning\s*\{/);

  const budgetNotificationBuilder = notifications.slice(
    notifications.indexOf('async function listOwnerCostBudgetNotifications'),
    notifications.indexOf('function correctionActor'),
  );
  assert.match(budgetNotificationBuilder, /tone: 'warning'/);
  assert.match(budgetNotificationBuilder, /priority: true/);
});
