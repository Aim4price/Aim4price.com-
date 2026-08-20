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
const dealerCaptureRoute = read('app/api/dealer/capture-requests/invoice/route.ts');
const ownerDecisionRoute = read('app/api/dealer-cost-proposals/[invoiceId]/route.ts');
const leads = read('app/leads/leads-client.tsx');
const costClient = read('app/my-invoices/my-invoices-client.tsx');
const costStyles = read('app/my-invoices/page.module.css');
const ownerNotifications = read('app/owner-app/notifications/owner-notifications-client.tsx');
const standardDealerPage = read('app/dealer-costs/page.tsx');
const dealerAppPage = read('app/dealer/cost/page.tsx');
const dealerAppHome = read('app/dealer/page.tsx');
const appHeader = read('components/AppHeader.tsx');
const decisionModal = read('components/DealerCostDecisionModal.tsx');
const notifications = read('lib/notifications.ts');
const migration = read('database/migrations/61-dealer-asset-costs.sql');
const ownerStorageMigration = read('database/migrations/62-dealer-cost-owner-storage.sql');
const deletionDecisionMigration = read('database/migrations/63-dealer-cost-deletion-decisions.sql');

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
    assert.match(route, /Dealer sign-in is required/);
  }
});

test('dealer cost routes contain concrete handlers and never re-export themselves', () => {
  assert.match(dealerRoute, /export async function GET/);
  assert.match(dealerRoute, /export async function POST/);
  assert.match(dealerInvoiceRoute, /export async function PATCH/);
  assert.match(dealerInvoiceRoute, /export async function DELETE/);
  assert.match(dealerUploadRoute, /export async function POST/);
  assert.match(dealerExtractRoute, /export async function POST/);

  for (const route of [
    dealerRoute,
    dealerInvoiceRoute,
    dealerUploadRoute,
    dealerExtractRoute,
    dealerAppPage,
  ]) {
    assert.doesNotMatch(route, /export\s*\{[^}]+\}\s*from/);
  }
});

test('uploads and assisted capture recheck the exact shared asset while the old reader stays retired', () => {
  assert.match(
    dealerUploadRoute,
    /getDealerCostAssetAccess\(context\.actor\.dealerUserId, assetId\)/,
  );
  assert.match(
    dealerCaptureRoute,
    /getDealerCostAssetAccess\(context\.actor\.dealerUserId, assetId\)/,
  );
  assert.match(dealerCaptureRoute, /submissionChannel: 'dealer_upload'/);
  assert.match(dealerCaptureRoute, /addCaptureRequestFile/);
  assert.match(dealerExtractRoute, /status: 410/);
  assert.doesNotMatch(dealerExtractRoute, /extractInvoiceFromUpload/);
  assert.match(invoices, /created_by_dealer_user_id = \$3/);
});

test('dealer cost creation stays separate from maintenance history', () => {
  assert.doesNotMatch(dealerCosts, /asset_maintenance_records/);
  assert.doesNotMatch(dealerCosts, /createMaintenance|updateMaintenance|deleteMaintenance/);
  assert.match(dealerCosts, /return createMyInvoice/);
  assert.match(invoices, /const ownerStorageStatus = asText\(actor\.dealerUserId\)[\s\S]*?actor\.ownerApproved \? 'approved' : 'pending'[\s\S]*?: 'owner'/);
});

test('both dealer workspaces show the Manage action and open the correct cost page', () => {
  assert.match(leads, /<strong>Add asset cost<\/strong>/);
  assert.match(leads, /Upload an invoice or enter a cost manually/);
  assert.match(leads, /const canAddDealerCosts = isDealerLeadsMode/);
  assert.match(leads, /\{canAddDealerCosts && !isFullRegisterLead\(managedLead\) \? \(/);
  assert.match(leads, /dealerAppMode \? '\/dealer\/cost' : '\/dealer-costs'/);
  assert.match(leads, /assetId=\$\{encodeURIComponent\(lead\.assetRegisterItemId\)\}&add=1/);
});

test('dealer cost page reuses manual and Aim4price-assisted entry without owner-only reports', () => {
  assert.match(
    costClient,
    /const apiRoot = dealerMode\s*\?\s*'\/api\/dealer\/cost'\s*:\s*'\/api\/my-invoices'/,
  );
  assert.match(costClient, /Enter cost manually/);
  assert.match(costClient, /Upload invoice\/photo/);
  assert.match(costClient, /dealerMode && dealerDefaults\.supplierName/);
  assert.match(costClient, /\{!dealerMode \? \([\s\S]*Download/);
});

test('dealer cost page uses the shared workspace title without an unused toolbar column', () => {
  assert.match(costClient, /<WorkspaceTitlePanel[\s\S]*title="CLIENT ASSET COSTS"/);
  assert.doesNotMatch(costClient, /Find a shared client asset and add an invoice or cost\./);
  assert.match(costClient, /dealerMode \? styles\.dealerToolbarButtons : ''/);
  assert.match(costStyles, /\.toolbarButtons\.dealerToolbarButtons[\s\S]*grid-template-columns: repeat\(2,/);
});

test('dealer shared asset query orders by the selected DISTINCT expression', () => {
  assert.match(
    dealerCosts,
    /select distinct[\s\S]*shared\.asset_register_item_id::text[\s\S]*order by owner_name asc, shared\.asset_register_item_id::text asc/,
  );
  assert.doesNotMatch(
    dealerCosts,
    /order by owner_name asc, shared\.asset_register_item_id asc/,
  );
});

test('dealer costs stay out of the header and remain available from Manage and Dealer App tools', () => {
  assert.doesNotMatch(appHeader, /\{ key: 'cost', href: '\/dealer-costs', label: 'Costs' \}/);
  assert.match(appHeader, /\{ href: '\/dealer-costs', label: 'Client Costs', accountTypes: \['dealer'\] \}/);
  assert.match(standardDealerPage, /getDealerCostRequestContext\(\)/);
  assert.match(standardDealerPage, /dealerMode[\s\S]*showAppHeader/);
  assert.match(dealerAppHome, /\{ label: 'Client Costs', href: '\/dealer\/cost', capability: 'client_costs' \}/);
  assert.match(dealerAppPage, /dealerMode/);
  assert.doesNotMatch(dealerAppPage, /showAppHeader/);
});

test('dealer-created costs stay dealer-only until the owner approves storage', () => {
  assert.match(invoices, /owner_storage_status in \('owner', 'approved'\)/);
  assert.match(invoices, /ownerStorageStatus: normalizeOwnerStorageStatus/);
  assert.match(dealerCosts, /listPendingOwnerDealerCosts/);
  assert.match(dealerCosts, /owner_storage_status = 'pending'/);
  assert.match(dealerCosts, /resolveDealerCostOwnerDecision/);
  assert.match(ownerDecisionRoute, /getServerSession\(\{ allowOwnerApp: true \}\)/);
  assert.match(ownerDecisionRoute, /export async function GET/);
  assert.match(ownerDecisionRoute, /export async function PATCH/);
  assert.match(ownerDecisionRoute, /Only the asset owner|Owner sign-in is required/);
});

test('owners can view a dealer cost and choose yes or no from notifications', () => {
  assert.match(notifications, /category: 'dealer_cost'/);
  assert.match(notifications, /dealerCostInvoiceId: invoice\.id/);
  assert.match(appHeader, /<DealerCostDecisionModal/);
  assert.match(ownerNotifications, /<DealerCostDecisionModal/);
  assert.match(decisionModal, /Open invoice or photo/);
  assert.match(decisionModal, /Keep dealer-only/);
  assert.match(decisionModal, /Add to Cost Ledger/);
});

test('dealer deletions require an owner keep or delete decision', () => {
  assert.match(invoices, /dealer_deletion_status = 'pending'/);
  assert.match(dealerCosts, /requestDealerMyInvoiceDeletion/);
  assert.match(dealerCosts, /listPendingOwnerDealerCostDeletions/);
  assert.match(dealerCosts, /resolveDealerCostDeletionDecision/);
  assert.match(notifications, /dealerCostAction: 'delete'/);
  assert.match(notifications, /Dealer removed an asset cost/);
  assert.match(ownerDecisionRoute, /getOwnerDealerCostDecision/);
  assert.match(ownerDecisionRoute, /resolveDealerCostDeletionDecision/);
  assert.match(decisionModal, /Keep in Cost Ledger/);
  assert.match(decisionModal, /Delete permanently/);
});

test('migration records dealer provenance on uploaded documents and saved costs', () => {
  assert.match(migration, /ALTER TABLE public\.asset_invoice_documents/);
  assert.match(migration, /created_by_dealer_user_id/);
  assert.match(migration, /ALTER TABLE public\.asset_invoices/);
  assert.match(migration, /created_by_display_name/);
  assert.match(ownerStorageMigration, /owner_storage_status/);
  assert.match(ownerStorageMigration, /'pending', 'approved', 'declined'/);
  assert.match(deletionDecisionMigration, /dealer_deletion_status/);
  assert.match(deletionDecisionMigration, /'active', 'pending', 'kept'/);
});
