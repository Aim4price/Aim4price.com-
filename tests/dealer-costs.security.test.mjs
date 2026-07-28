import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const dealerCosts = read('lib/dealer-costs.ts');
const invoices = read('lib/my-invoices.ts');
const dealerRoute = read('app/api/dealer/cost/route.ts');
const dealerInvoiceRoute = read('app/api/dealer/cost/[invoiceId]/route.ts');
const dealerUploadRoute = read('app/api/dealer/cost/upload/route.ts');
const dealerExtractRoute = read('app/api/dealer/cost/extract/route.ts');
const leads = read('app/leads/leads-client.tsx');
const costClient = read('app/my-invoices/my-invoices-client.tsx');
const standardDealerPage = read('app/dealer-costs/page.tsx');
const dealerAppPage = read('app/dealer/cost/page.tsx');
const dealerAppHome = read('app/dealer/page.tsx');
const appHeader = read('components/AppHeader.tsx');
const pluralDealerPageAlias = read('app/dealer/costs/page.tsx');
const pluralDealerRouteAlias = read('app/api/dealer/costs/route.ts');
const pluralDealerInvoiceRouteAlias = read('app/api/dealer/costs/[invoiceId]/route.ts');
const pluralDealerUploadRouteAlias = read('app/api/dealer/costs/upload/route.ts');
const pluralDealerExtractRouteAlias = read('app/api/dealer/costs/extract/route.ts');
const migration = read('database/migrations/61-dealer-asset-costs.sql');

test('dealer cost assets come only from leads or active maintenance shares', () => {
  assert.match(dealerCosts, /from public\.asset_leads lead/);
  assert.match(dealerCosts, /where lead\.partner_user_id = \$1/);
  assert.match(dealerCosts, /from public\.dealer_maintenance_access access/);
  assert.match(dealerCosts, /access\.dealer_user_id = \$1/);
  assert.match(dealerCosts, /access\.is_active = true/);
  assert.match(dealerCosts, /asset\.user_id = shared\.owner_user_id/);
});

test('dealer cost history is scoped to records created by the same dealership', () => {
  assert.match(dealerCosts, /createdByDealerUserId: dealerUserId/);
  assert.match(
    dealerCosts,
    /where id = \$1::uuid[\s\S]*created_by_dealer_user_id = \$2/,
  );
  assert.match(
    invoices,
    /and \(\$15 = '' or created_by_dealer_user_id = \$15\)/,
  );
  assert.match(
    invoices,
    /and created_by_dealer_user_id = \$3/,
  );
});

test('all dealer cost endpoints require a dealer request context', () => {
  for (const route of [
    dealerRoute,
    dealerInvoiceRoute,
    dealerUploadRoute,
    dealerExtractRoute,
  ]) {
    assert.match(route, /getDealerCostRequestContext\(\)/);
    assert.match(route, /Dealer App sign-in is required/);
  }
});

test('uploads and automatic extraction recheck the exact shared asset and dealer document', () => {
  assert.match(
    dealerUploadRoute,
    /getDealerCostAssetAccess\(context\.actor\.dealerUserId, assetId\)/,
  );
  assert.match(
    dealerExtractRoute,
    /getDealerCostAssetAccess\(context\.actor\.dealerUserId, assetId\)/,
  );
  assert.match(dealerExtractRoute, /dealerUserId: context\.actor\.dealerUserId/);
  assert.match(invoices, /created_by_dealer_user_id = \$3/);
});

test('dealer cost creation stays separate from maintenance history', () => {
  assert.doesNotMatch(dealerCosts, /asset_maintenance_records/);
  assert.doesNotMatch(dealerCosts, /createMaintenance|updateMaintenance|deleteMaintenance/);
  assert.match(dealerCosts, /return createMyInvoice/);
});

test('both dealer workspaces show the Manage action and open the correct cost page', () => {
  assert.match(leads, /<strong>Add asset cost<\/strong>/);
  assert.match(leads, /Upload an invoice or enter a cost manually/);
  assert.match(leads, /const canAddDealerCosts = Boolean\(dealerAppMode \|\| dealerWorkspaceMode\)/);
  assert.match(leads, /\{canAddDealerCosts && !isFullRegisterLead\(managedLead\) \? \(/);
  assert.match(leads, /dealerAppMode \? '\/dealer\/cost' : '\/dealer-costs'/);
  assert.match(leads, /assetId=\$\{encodeURIComponent\(lead\.assetRegisterItemId\)\}&add=1/);
});

test('dealer cost page reuses manual and automatic owner cost entry without owner-only reports', () => {
  assert.match(costClient, /dealerMode \? '\/api\/dealer\/cost' : '\/api\/my-invoices'/);
  assert.match(costClient, /Enter cost manually/);
  assert.match(costClient, /Upload invoice\/photo/);
  assert.match(costClient, /dealerMode && dealerDefaults\.supplierName/);
  assert.match(costClient, /\{!dealerMode \? \([\s\S]*Download/);
});

test('standard dealer and Dealer App navigation both expose their working cost routes', () => {
  assert.match(appHeader, /\{ key: 'cost', href: '\/dealer-costs', label: 'Costs' \}/);
  assert.match(appHeader, /\{ href: '\/dealer-costs', label: 'Client Costs', accountTypes: \['dealer'\] \}/);
  assert.match(standardDealerPage, /getDealerCostRequestContext\(\)/);
  assert.match(standardDealerPage, /dealerMode[\s\S]*showAppHeader/);
  assert.match(dealerAppHome, /\{ label: 'Costs', href: '\/dealer\/cost' \}/);
  assert.match(dealerAppPage, /dealerMode/);
  assert.doesNotMatch(dealerAppPage, /showAppHeader/);
});

test('legacy plural dealer cost links and API requests remain compatible', () => {
  assert.match(pluralDealerPageAlias, /from '\.\.\/cost\/page'/);
  assert.match(pluralDealerRouteAlias, /from '\.\.\/cost\/route'/);
  assert.match(pluralDealerInvoiceRouteAlias, /from '\.\.\/\.\.\/cost\/\[invoiceId\]\/route'/);
  assert.match(pluralDealerUploadRouteAlias, /from '\.\.\/\.\.\/cost\/upload\/route'/);
  assert.match(pluralDealerExtractRouteAlias, /from '\.\.\/\.\.\/cost\/extract\/route'/);
});

test('migration records dealer provenance on uploaded documents and saved costs', () => {
  assert.match(migration, /ALTER TABLE public\.asset_invoice_documents/);
  assert.match(migration, /created_by_dealer_user_id/);
  assert.match(migration, /ALTER TABLE public\.asset_invoices/);
  assert.match(migration, /created_by_display_name/);
});
