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
  assert.match(costClient, /Total spend budgets/);
  assert.match(costClient, /Budget amount \(incl\. VAT\)/);
  assert.match(costClient, /Include Fuel Slip costs/);
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

test('budget setup uses the shared searchable asset-picker experience instead of a native select', () => {
  const modalStart = costClient.indexOf('{budgetModalOpen ?');
  const modalEnd = costClient.indexOf('{budgetDeleteCandidate ?', modalStart);
  const budgetModal = costClient.slice(modalStart, modalEnd);

  assert.ok(modalStart >= 0 && modalEnd > modalStart, 'budget modal source should be present');
  assert.match(budgetModal, /Choose budget scope/);
  assert.match(budgetModal, /Search saved assets/);
  assert.match(budgetModal, /budgetAssetPickerOpen/);
  assert.match(budgetModal, /budgetScopeTrigger/);
  assert.match(budgetModal, /filteredBudgetAssets/);
  assert.doesNotMatch(budgetModal, /<select\b/);
  assert.match(costStyles, /\.budgetSetupGrid\b/);
  assert.match(costStyles, /\.budgetScopeRowSelected\b/);
});
