import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const permissions = read('lib/asset-document-permissions.ts');
const partnerAccess = read('lib/partner-access.ts');
const discovery = read('lib/asset-discovery.ts');
const discoveryClient = read('app/asset-discovery/asset-discovery-client.tsx');
const registerClient = read('app/asset-register/asset-register-client.tsx');
const registerStyles = read('app/asset-register/page.module.css');
const leadsClient = read('app/leads/leads-client.tsx');
const header = read('components/AppHeader.tsx');
const headerStyles = read('components/AppHeader.module.css');
const signup = read('app/auth/auth-client.tsx');
const assetRegisterRoute = read('app/api/asset-register/route.ts');
const ownerAssetActionsRoute = read('app/api/owner-app/assets/[assetId]/actions/route.ts');
const ownerAssetRoute = read('app/api/owner-app/assets/[assetId]/route.ts');
const accountantWorkspace = read('lib/accountant-workspace.ts');
const ownerAssetOptions = read('app/owner-app/assets/[assetId]/owner-asset-options-client.tsx');
const ownerAssetDetail = read('app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx');
const ownerStyles = read('app/owner-app/owner-app.module.css');
const assetLeadsRoute = read('app/api/asset-leads/route.ts');
const correctionLibrary = read('lib/dealer-asset-corrections.ts');
const correctionEditor = read('components/DealerAssetCorrectionEditor.tsx');
const licensingRenewalRoute = read('app/api/licensing/renewal-updates/route.ts');
const correctionMigration = read('database/migrations/70-license-renewal-corrections.sql');
const notifications = read('lib/notifications.ts');

test('licence renewal experts have a dedicated account and two-item workspace', () => {
  assert.match(signup, /value: "licensing"/);
  assert.match(header, /accountType === 'licensing'/);
  assert.match(header, /label: 'Leads'/);
  assert.match(header, /label: 'Discovery'/);
  const licensingNav = header.slice(
    header.indexOf("if (accountType === 'licensing')"),
    header.indexOf("if (accountType === 'owner')"),
  );
  assert.doesNotMatch(licensingNav, /Get Estimate|Marketplace|Maintenance/);
});

test('the owner share modal includes licence renewals and selected eligible assets', () => {
  assert.match(registerClient, /<strong>Licence renewal<\/strong>/);
  assert.match(registerClient, /openFullRegisterQuotePartnerPicker\('license_renewal'\)/);
  assert.match(registerClient, /readLicenseStatusChoice\(asset\) === 'yes'/);
  assert.match(registerClient, /selectedDealerShareAssetIds/);
  assert.match(registerClient, /source: 'licence_register_share'/);
  assert.match(registerClient, /onClick=\{\(\) => openQuoteLeadMessage\(partner\)\}/);
  assert.doesNotMatch(registerClient, /All Companies|href="\/companies"/);
  assert.equal(existsSync(new URL('../app/companies/page.tsx', import.meta.url)), false);
});

test('the asset share modal uses four concise desktop choices', () => {
  assert.match(registerStyles, /assetQuoteModal:not\(\.assetQuotePartnerPickerModal\)[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(registerStyles, /assetQuoteChoiceGrid\.registerShareOptionGrid[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(registerClient, /title: 'Finance & accounting'/);
  assert.match(registerClient, /title: 'Insurance'/);
  assert.match(registerClient, /title: 'Dealer'/);
  assert.match(registerClient, /title: 'Licence renewal'/);
  assert.match(registerClient, /Choose who to share with\. Each partner sees only what they need\./);
  assert.doesNotMatch(registerClient, /descriptionLines/);
});

test('document categories enforce the requested role visibility matrix', () => {
  assert.match(permissions, /role === 'owner'/);
  assert.match(permissions, /role === 'finance' && subtype === 'accountant'/);
  assert.match(permissions, /role === 'finance'.*\['finance'\]/s);
  assert.match(permissions, /role === 'insurance'.*\['insurance'\]/s);
  assert.match(permissions, /role === 'licensing'.*\['licensing'\]/s);
  assert.match(permissions, /return new Set<AssetDocumentCategory>\(\)/);
  assert.match(partnerAccess, /if \(role === 'dealer'\) return \[\]/);
  assert.match(partnerAccess, /sanitizeRegisterSnapshotDocuments/);
});

test('status paperwork uploads are categorized before saving', () => {
  assert.match(registerClient, /handleDocumentFilesSelected\(event, 'finance'\)/);
  assert.match(registerClient, /handleDocumentFilesSelected\(event, 'insurance'\)/);
  assert.match(registerClient, /handleDocumentFilesSelected\(event, 'licensing'\)/);
  assert.match(registerClient, /current or older licensing papers/i);
  assert.match(registerClient, /documentType: normalizeAssetDocumentType/);
  assert.match(registerClient, /Add finance documents/);
  assert.match(registerClient, /Add insurance documents/);
  assert.match(registerClient, /Add licence documents/);
  assert.match(registerClient, /assetStatusDocumentPicker/);
});

test('the Owner App includes the licence renewal sharing flow', () => {
  assert.match(ownerAssetOptions, /partnerType: 'licensing'/);
  assert.match(ownerAssetOptions, /leadType: 'license_renewal'/);
  assert.match(ownerAssetOptions, /title: 'Licence renewal'/);
  assert.match(ownerAssetOptions, /valuationSummary: selectedOption\.leadType !== 'license_renewal'/);
  assert.match(ownerAssetOptions, /basic details, renewal date, saved photos, licence documents/);
  assert.match(ownerAssetDetail, /assetIsLicensed=\{licenseStatus === 'yes'\}/);
  assert.match(ownerStyles, /\.ownerOptionLicensing/);
});

test('licence renewal sharing is date-gated in the API, desktop and Owner App', () => {
  assert.match(assetLeadsRoute, /leadType === 'license_renewal' && !dealerShareAssetIds\.length/);
  assert.match(assetLeadsRoute, /hasLicenceRenewalDate\(ownedAsset\)/);
  assert.match(assetLeadsRoute, /Every selected asset must be licensed and have a renewal date/);
  assert.match(registerClient, /openQuickAssetStatusEditor\(asset, 'license'\)/);
  assert.match(registerClient, /Only assets with a renewal date can be shared/);
  assert.match(ownerAssetOptions, /window\.location\.assign\(`\$\{assetHref\}\/manage\/licence`\)/);
  assert.match(ownerAssetOptions, /Add a renewal date before sharing/);
});

test('licence experts propose renewal dates for owner approval', () => {
  assert.match(licensingRenewalRoute, /profile\.accountType !== 'licensing'/);
  assert.match(licensingRenewalRoute, /field: 'licenseRenewalDate'/);
  assert.match(correctionLibrary, /licenseRenewalDateChanged/);
  assert.match(correctionLibrary, /proposedLicenseRenewalDate/);
  assert.match(correctionLibrary, /applyAcceptedCorrectionToAsset/);
  assert.match(correctionLibrary, /licence_renewal_date: current\.proposedLicenseRenewalDate/);
  assert.match(correctionEditor, /Update renewal date/);
  assert.match(leadsClient, /canUpdateLicenseRenewalDate/);
  assert.match(ownerAssetDetail, /Licence renewal awaiting approval/);
  assert.match(ownerAssetDetail, /decideRenewalUpdate\('accept'\)/);
  assert.match(notifications, /Licence expert updated renewal date/);
  assert.match(notifications, /licence renewal date from/);
  assert.match(correctionMigration, /license_renewal_date_changed/);
});

test('every document constructor supplies category and document type metadata', () => {
  for (const source of [assetRegisterRoute, ownerAssetActionsRoute, ownerAssetRoute]) {
    assert.match(source, /category: normalizeAssetDocumentCategory/);
    assert.match(source, /documentType: normalizeAssetDocumentType/);
  }
  assert.match(accountantWorkspace, /category: 'accounting'/);
  assert.match(accountantWorkspace, /documentType: 'accountant_upload'/);
});

test('licensing Discovery exposes only a coarse renewal window before approval', () => {
  assert.match(discovery, /LICENSING_DISCOVERY_ASSET_SQL/);
  assert.match(discovery, /month: 'long', year: 'numeric'/);
  assert.match(discoveryClient, /Offer renewal help/);
  assert.match(discoveryClient, /Exact details remain private until the owner approves/);
  assert.match(discoveryClient, /\["Renewal", details\.asset\.renewalWindow\]/);
  assert.match(registerStyles, /assetQuotePartnerChoose/);
  const listSql = discovery.slice(
    discovery.indexOf('const listSql = `'),
    discovery.indexOf('const assetRows =', discovery.indexOf('const listSql = `')),
  );
  const projection = listSql.slice(0, listSql.indexOf('from public.asset_register_items'));
  assert.doesNotMatch(projection, /licenseRegistrationNumber|serialNumber|documents|phone|email/i);
});

test('an approved Discovery offer creates a renewal lead with photos and licence documents', () => {
  assert.match(discovery, /leadType: "license_renewal"/);
  assert.match(discovery, /source: "asset_discovery"/);
  assert.match(discovery, /documents: true/);
  assert.match(leadsClient, /LICENCE RENEWAL LEADS/);
  assert.match(leadsClient, /Renewal due/);
  assert.match(leadsClient, /licenceLeadThumbnail/);
  assert.match(notifications, /Licence renewal help offered/);
  assert.match(notifications, /It is now in My Leads/);
  assert.match(header, /Renewal help offer/);
  assert.match(header, /Accept help/);
  assert.match(header, /expert&apos;s My Leads/);
  assert.match(headerStyles, /notificationRenewalDetailModal/);
  assert.match(headerStyles, /notificationRenewalDateCard/);
});

test('renewal lead snapshots do not carry valuation or unrelated private specs', () => {
  assert.match(partnerAccess, /const snapshotSpecs = leadType === 'license_renewal'/);
  assert.match(partnerAccess, /licenseStatus: 'yes'/);
  assert.match(partnerAccess, /licenceRenewalDate: licenseRenewalDate/);
  assert.match(partnerAccess, /if \(leadType === 'license_renewal'\) return baseSnapshot/);
});
