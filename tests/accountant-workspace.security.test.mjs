import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const workspace = read('lib/accountant-workspace.ts');
const lifecycle = read('lib/asset-lifecycle.ts');
const collaboration = read('lib/accounting-collaboration.ts');
const accountantManageUi = read('components/AccountantAssetManageModal.tsx');
const accountantReportsUi = read('components/AccountantRegisterReportsModal.tsx');
const accountantReportsRoute = read('app/api/accountant/registers/[shareId]/reports/route.ts');
const accountantLifecycleRoute = read('app/api/accountant/registers/[shareId]/assets/[assetId]/lifecycle/route.ts');
const recurringCommitmentsRoute = read('app/api/recurring-commitments/route.ts');
const reviewItemsRoute = read('app/api/accountant/registers/[shareId]/review-items/route.ts');
const headerUi = read('components/AppHeader.tsx');
const accountUi = read('app/account/account-client.tsx');
const leadsUi = read('app/leads/leads-client.tsx');
const fuelUi = read('app/fuel/fuel-client.tsx');
const costUi = read('app/my-invoices/my-invoices-client.tsx');
const ownerUi = read('app/asset-register/asset-register-client.tsx');
const ownerStyles = read('app/asset-register/page.module.css');
const ownerStatusRoute = read('app/api/asset-register/status/route.ts');
const valuationUi = read('app/valuation/valuation-client.tsx');
const valuationRoute = read('app/api/valuation-runs/route.ts');
const registerManagerUi = read('app/asset-registers/asset-registers-client.tsx');
const registerManagerStyles = read('app/asset-registers/page.module.css');
const accountantRegistersPage = read('app/accountant/registers/page.tsx');
const accountantManagePage = read('app/accountant/registers/[shareId]/manage/page.tsx');
const accountantOwnerRegistersRoute = read('app/api/accountant/registers/[shareId]/owner-registers/route.ts');
const accountantMoveRoute = read('app/api/accountant/registers/[shareId]/owner-registers/move-assets/route.ts');
const accountantFlagRoute = read('app/api/accountant/registers/[shareId]/assets/[assetId]/flag/route.ts');
const accountantNoteRoute = read('app/api/accountant/registers/[shareId]/assets/[assetId]/notes/route.ts');
const ownerWorkspaceAccess = read('lib/owner-workspace-access.ts');
const registerDb = read('lib/asset-register-db.ts');
const registerSummaries = read('lib/asset-registers.ts');
const migration = read('database/migrations/65-accountant-workspace-and-asset-lifecycle.sql');
const collaborationMigration = read('database/migrations/66-accounting-collaboration-foundation.sql');

test('accountant access is tied to the signed-in partner and an active share', () => {
  assert.match(workspace, /l\.partner_user_id = \$2/);
  assert.match(workspace, /l\.access_status = 'active'/);
  assert.match(workspace, /l\.access_removed_at is null/);
  assert.match(workspace, /account_subtype.*accountant/s);
});

test('unauthorised assets cannot escape the shared client owner boundary', () => {
  assert.match(workspace, /getAssetRegisterForUser\(access\.ownerUserId, asset\.registerId\)/);
  assert.match(workspace, /ACCOUNTANT_ASSET_NOT_FOUND/);
});

test('direct finance, accounting value and document writes require owner permission', () => {
  assert.match(workspace, /requireWrite && !access\.allowDirectUpdates/);
  assert.equal((workspace.match(/authorisedAsset\([^\n]+true\)/g) || []).length >= 3, true);
});

test('accountant removal ends only the lead access record', () => {
  const removal = workspace.slice(workspace.indexOf('export async function removeAccountantRegisterAccess'), workspace.indexOf('export async function syncAccountantShareSettingsFromLead'));
  assert.match(removal, /update public\.asset_leads/);
  assert.doesNotMatch(removal, /delete from public\.asset_register_items|delete from public\.asset_registers/);
});

test('accountant asset UI keeps owner-only controls hidden and exposes one disposal action', () => {
  assert.doesNotMatch(accountantManageUi, /Send to marketplace|Manage pricing|Add Asset|Dealer tracking/);
  assert.match(accountantManageUi, /Finance Agreements/);
  assert.match(accountantManageUi, /Documents/);
  assert.match(accountantManageUi, /Accounting Book Value/);
  assert.equal((accountantManageUi.match(/<strong>Dispose asset<\/strong>/g) || []).length, 1);
  assert.doesNotMatch(accountantManageUi, /Delete incorrect asset/);
  assert.match(accountantLifecycleRoute, /disposeOrDeleteAsset/);
  assert.match(accountantLifecycleRoute, /allowDirectUpdates/);
  assert.match(ownerUi, /canUseOwnerOnlyAssetActions = !isAccountantWorkspace/);
});

test('Finance Agreements preserve financier amounts and use explicit multi-asset link roles without automatic allocation', () => {
  assert.doesNotMatch(accountantManageUi, /financeAmountBasis|VAT_MULTIPLIER|convertFinanceAmounts/);
  assert.match(accountantManageUi, /Enter agreement amounts exactly as supplied by the financier/);
  assert.match(accountantManageUi, /directly_financed/);
  assert.match(accountantManageUi, /financed_acquisition/);
  assert.match(accountantManageUi, /collateral_only/);
  assert.match(accountantManageUi, /No amount is allocated automatically/);
  assert.match(collaboration, /asset_finance_agreement_assets/);
  assert.match(collaboration, /original_amount_allocation/);
  assert.match(collaboration, /settlement_allocation/);
});

test('owner and accountant finance flows support paid-off assets and keep acquisition inside finance', () => {
  assert.match(accountantManageUi, /<option value="paid">Paid off<\/option>/);
  assert.match(accountantManageUi, /Finance and acquisition/);
  assert.match(accountantManageUi, /Advanced details/);
  assert.match(workspace, /\['yes', 'paid'\]\.includes\(status\)/);
  assert.match(ownerUi, /type FinanceStatusChoice = AssetStatusChoice \| 'paid'/);
  assert.match(ownerUi, /<strong>Acquisition details<\/strong>/);
  assert.doesNotMatch(ownerUi, /openAcquisitionDetails\(activeAsset\)/);
  assert.match(ownerStatusRoute, /normalizeFinanceStatusChoice/);
  assert.match(ownerStatusRoute, /financeStatus === 'paid'/);
});

test('accounting manage modals keep a fixed blur layer, inner scrolling and one-line option copy', () => {
  assert.match(accountantManageUi, /accountantManageOverlay/);
  assert.match(accountantManageUi, /accountantManageBackdrop/);
  assert.match(ownerStyles, /\.accountantManageBackdrop[\s\S]*?position: fixed !important/);
  assert.match(ownerStyles, /\.accountantManageBody[\s\S]*?overflow-y: auto !important/);
  assert.match(ownerStyles, /\.accountantManageModal \.assetOptionsGrid \.optionActionButton small[\s\S]*?white-space: nowrap !important/);
  assert.match(ownerUi, /Remove or archive this asset safely\./);
  assert.match(ownerStyles, /\.deleteAssetOptionSubtitle[\s\S]*?white-space: nowrap !important/);
  assert.match(ownerStyles, /\.assetDisposalReasonGrid/);
  assert.match(ownerStyles, /\.assetDisposalReasonButtonActive/);
});

test('normal accountant account keeps standard leads, account and notifications', () => {
  assert.match(headerUi, /accountType === 'finance' \|\| accountType === 'insurance'/);
  assert.match(headerUi, /label: 'My Leads'/);
  assert.match(headerUi, /isAccountantWorkspace/);
  assert.match(leadsUi, /accountantWorkspaceMode/);
  assert.match(leadsUi, /window\.location\.assign\(`\/accountant\/registers\/\$\{encodeURIComponent\(leadToOpen\.id\)\}`\)/);
  assert.match(accountUi, /Partner directory/);
  assert.match(accountUi, /Edit business details/);
});

test('client choice stays on My Clients while Change manages registers inside one client', () => {
  assert.match(accountantRegistersPage, /redirect\('\/leads'\)/);
  assert.doesNotMatch(headerUi, /Switch accounts/);
  assert.match(headerUi, /aim4price:open-register-change/);
  assert.match(headerUi, /<span>Change<\/span>/);
  assert.match(accountantManagePage, /<AssetRegistersClient accountantShareId=\{params\.shareId\}/);
  assert.match(accountantOwnerRegistersRoute, /getAccountantRegisterAccess/);
  assert.match(ownerUi, /\/owner-registers/);
  assert.match(ownerUi, /Change Asset Register/);
});

test('Get Estimate remains inside the client workspace and saves to its active or shared register', () => {
  assert.match(headerUi, /new URLSearchParams\(\{ accountantShareId: accountantWorkspaceShareId \}\)/);
  assert.match(ownerUi, /const accountantValuationHref/);
  assert.match(ownerUi, /href=\{accountantValuationHref\}/);
  assert.match(valuationUi, /normalizedSignedInAccountType === 'finance' && Boolean\(accountantShareId\)/);
  assert.match(valuationRoute, /requestedRegisterId \|\| accountantAccess\?\.registerId \|\| ''/);
  assert.match(valuationUi, /savePayload\.accountantShareId = accountantShareId/);
});

test('new acquisition question is shared, simple and responsive for owners and accountants', () => {
  assert.match(ownerUi, /newAcquisitionChoiceModal/);
  assert.match(ownerUi, /newAcquisitionChoiceGrid/);
  assert.match(ownerUi, /newAcquisitionChoiceIndicator/);
  assert.match(ownerUi, /Newly acquired asset\?/);
  assert.match(ownerUi, /<strong>Newly acquired<\/strong>/);
  assert.match(ownerUi, /<strong>Existing asset<\/strong>/);
  assert.doesNotMatch(ownerUi, /Recently purchased, financed, inherited or otherwise acquired/);
  assert.match(ownerStyles, /\.newAcquisitionChoiceModal[\s\S]*?width: min\(44rem/);
  assert.match(ownerStyles, /\.newAcquisitionChoiceGrid[\s\S]*?grid-template-columns: repeat\(2/);
  assert.match(ownerStyles, /\.newAcquisitionChoiceOption > \.newAcquisitionChoiceIndicator/);
  assert.match(ownerStyles, /\.newAcquisitionChoiceOption > strong[\s\S]*?white-space: nowrap/);
});

test('accountant register manager fills its action row without an empty QR-code column', () => {
  assert.match(registerManagerUi, /manageActionGridAccountant/);
  assert.match(registerManagerStyles, /\.manageActionGrid\.manageActionGridAccountant[\s\S]*?repeat\(3/);
});

test('accountant register moves stay inside one owner and preserve shared-register anchors', () => {
  assert.match(accountantMoveRoute, /moveAccountantAssetToRegister/);
  assert.match(workspace, /getAssetRegisterForUser\(access\.ownerUserId, input\.targetRegisterId\)/);
  assert.match(workspace, /full_register_leads/);
  assert.match(workspace, /reassigned_leads/);
  assert.match(workspace, /ACCOUNTANT_MOVE_LAST_SHARED_ASSET/);
});

test('accountants can flag shared assets and use aligned three-button card actions', () => {
  assert.match(accountantFlagRoute, /updateAccountantAssetFlag/);
  assert.match(ownerUi, /canUseOwnerOnlyAssetActions \|\| isAccountantWorkspace/);
  assert.match(ownerUi, /assetHeaderActionsAccountant/);
  assert.match(ownerUi, /\/assets\/\$\{encodeURIComponent\(asset\.id\)\}\/flag/);
  assert.match(ownerStyles, /\.page \.assetHeaderActionsAccountant[\s\S]*?grid-template-columns: repeat\(3/);
});

test('accountants can leave copper-styled notes on authorised client assets', () => {
  assert.match(accountantNoteRoute, /createAccountantAssetNote/);
  assert.match(accountantNoteRoute, /requireActive: true/);
  assert.match(workspace, /export async function createAccountantAssetNote/);
  assert.match(workspace, /authorisedAsset\(input\.accountantUserId, input\.shareId, input\.assetId\)/);
  assert.match(workspace, /insert into public\.asset_partner_notes/);
  assert.match(workspace, /accountant_asset_note_left/);
  assert.match(ownerUi, /<span>Note<\/span>/);
  assert.match(ownerUi, /styles\.sharedNoteModal/);
  assert.match(ownerUi, /Note to asset owner/);
  assert.match(ownerUi, /\/assets\/\$\{encodeURIComponent\(accountantNoteAsset\.id\)\}\/notes/);
  assert.match(ownerStyles, /\.page \.assetHeaderActions \.cardAccountantNoteButton[\s\S]*?var\(--action-clay-bg\)/);
  assert.match(ownerStyles, /\.accountantNoteActions[\s\S]*?justify-content: flex-end/);
});

test('owner and accountant asset filters share lighter labels without a visible scrollbar', () => {
  assert.match(ownerStyles, /Final cascade: shared Owner\/Accountant filter labels/);
  assert.match(ownerStyles, /\.assetFilterModalBody[\s\S]*?scrollbar-width: none !important/);
  assert.match(ownerStyles, /\.assetFilterModalBody::\-webkit-scrollbar[\s\S]*?display: none !important/);
  assert.match(ownerStyles, /\.assetFilterOption strong[\s\S]*?font-weight: 650 !important/);
});

test('shared workspace reuses the real Asset Register, Fuel Ledger and Cost Ledger components', () => {
  assert.match(ownerUi, /accountantShareId/);
  assert.match(fuelUi, /accountantShareId/);
  assert.match(costUi, /accountantShareId/);
  assert.match(headerUi, /label: 'Asset Register'/);
  assert.match(headerUi, /label: 'Fuel Ledger'/);
  assert.match(headerUi, /label: 'Cost Ledger'/);
  assert.match(headerUi, /You will return to My Leads/);
  assert.match(headerUi, /window\.location\.assign\('\/leads'\)/);
});

test('shared Fuel and Cost Ledgers reuse owner controls with register-scoped writes and reports', () => {
  assert.match(fuelUi, /const isAccountantReadOnly = false/);
  assert.match(fuelUi, /scopedApiUrl\('\/api\/fuel\/slips\/extract'\)/);
  assert.match(fuelUi, /buildReportUrl\(reportStorageId, reportYear, normalizedMonth, 'xlsx', accountantShareId, accountantRegisterId\)/);
  assert.match(fuelUi, /Fuel Slips/);
  assert.match(costUi, /accountScopedUrl\(editingInvoiceId \? `\$\{apiRoot\}\/\$\{editingInvoiceId\}` : apiRoot\)/);
  assert.match(costUi, /<span>Add Cost<\/span>/);
  assert.match(costUi, /Open file/);
  assert.match(costUi, /\/api\/my-invoices\/report\?\$\{params\.toString\(\)\}/);
  assert.match(costUi, /Add recurring commitment/);
  assert.match(costUi, /Track future recurring asset costs/);
  assert.match(costUi, /recurringAssetPickerOpen/);
  assert.doesNotMatch(costUi, /This does not create an expense/);
  assert.match(costUi, /\/api\/recurring-commitments/);
  assert.match(recurringCommitmentsRoute, /resolveOwnerWorkspaceContext\(request, \{ ledger: 'cost' \}\)/);
  assert.match(collaboration, /annualise\(amount, row\.frequency\)/);
  assert.doesNotMatch(ownerWorkspaceAccess, /requireWrite/);
  assert.match(ownerWorkspaceAccess, /assertWorkspaceAssetAccess/);
});

test('removing an accountant register lead removes access without deleting owner data', () => {
  assert.match(leadsUi, /\/api\/accountant\/registers\/\$\{encodeURIComponent\(leadToDelete\.id\)\}/);
  assert.match(leadsUi, /The owner’s register was not deleted/);
});

test('genuine disposals and incorrect records retain auditable tombstones', () => {
  assert.match(lifecycle, /deleteRecord = \['mistake_duplicate', 'created_in_error', 'import_error', 'test_record'\]/);
  assert.match(lifecycle, /set lifecycle_state = 'disposed'/);
  assert.match(lifecycle, /set lifecycle_state = 'archived'/);
  assert.match(lifecycle, /ASSET_DELETE_HAS_DEPENDENCIES/);
  assert.match(lifecycle, /fuel_storage_events/);
  assert.match(lifecycle, /fuel_slips/);
  assert.doesNotMatch(lifecycle, /deleteAssetRegisterItem\(/);
  assert.match(lifecycle, /asset_snapshot_json/);
});

test('disposed assets are excluded from active rows and register totals', () => {
  assert.match(registerDb, /coalesce\(lifecycle_state, 'active'\) = 'active'/);
  assert.equal((registerSummaries.match(/coalesce\(ai\.lifecycle_state, 'active'\) = 'active'/g) || []).length >= 4, true);
});

test('manual owner entry captures newly acquired details and later editing stays inside finance', () => {
  assert.match(ownerUi, /Newly acquired asset\?/);
  assert.match(ownerUi, /acquisitionAmountExVat/);
  assert.match(ownerUi, /Acquisition details/);
  assert.doesNotMatch(ownerUi, /aria-labelledby="acquisition-details-title"/);
  assert.match(lifecycle, /eventType = input\.newlyAcquired \? 'acquired' : 'existing_added'/);
});

test('migration is additive, idempotent and keeps values separate', () => {
  assert.match(migration, /add column if not exists lifecycle_state/);
  assert.match(migration, /create table if not exists public\.asset_lifecycle_events/);
  assert.match(migration, /create table if not exists public\.asset_accounting_values/);
  assert.match(migration, /carrying_value numeric/);
  assert.doesNotMatch(migration, /drop table|truncate table/);
  assert.match(collaborationMigration, /create table if not exists public\.asset_finance_agreements/);
  assert.match(collaborationMigration, /create table if not exists public\.asset_finance_agreement_assets/);
  assert.match(collaborationMigration, /create table if not exists public\.asset_accounting_value_snapshots/);
  assert.match(collaborationMigration, /create table if not exists public\.asset_recurring_commitments/);
  assert.match(collaborationMigration, /create table if not exists public\.asset_accounting_review_items/);
  assert.doesNotMatch(collaborationMigration, /drop table|truncate table/);
});

test('final reports use approved accounting language and keep audit history in product', () => {
  for (const label of ['Market versus Accounting', 'Market Value Trend', 'Finance Position and Commitments',
    'Cost of Ownership', 'Fuel Report', 'Asset Register', 'Fuel Ledger', 'Cost Ledger']) {
    assert.match(accountantReportsUi, new RegExp(label));
  }
  assert.doesNotMatch(accountantReportsUi, /depreciation schedule|Asset Change History/i);
  assert.match(accountantReportsRoute, /Accounting Book Value/);
  assert.match(accountantReportsRoute, /not accounting or tax depreciation/);
  assert.match(accountantReportsRoute, /Asset Change History is an in-product audit record and is not downloadable/);
});

test('Accounting Book Value writes are dated snapshots and Needs Attention is data driven', () => {
  assert.match(workspace, /asset_accounting_value_snapshots/);
  assert.match(workspace, /accountingBookValue/);
  assert.match(collaboration, /book-value-missing/);
  assert.match(collaboration, /book-value-stale/);
  assert.match(collaboration, /finance-unlinked/);
  assert.match(collaboration, /negative-equity/);
  assert.match(collaboration, /commitment-renewal/);
  assert.match(collaboration, /dataStatus: severity/);
  assert.match(collaboration, /partial:/);
  assert.match(collaboration, /saveAccountingReviewDecision/);
  assert.match(collaboration, /issue_status === 'deferred'/);
  assert.match(reviewItemsRoute, /buildAccountantFinancialSummary/);
  assert.match(accountantReportsUi, /Defer 30 days/);
  assert.match(accountantReportsUi, /Reviewed/);
});
