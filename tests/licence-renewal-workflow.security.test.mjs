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
const leadsStyles = read('app/leads/page.module.css');
const header = read('components/AppHeader.tsx');
const headerStyles = read('components/AppHeader.module.css');
const signup = read('app/auth/auth-client.tsx');
const assetRegisterRoute = read('app/api/asset-register/route.ts');
const ownerAssetActionsRoute = read('app/api/owner-app/assets/[assetId]/actions/route.ts');
const ownerAssetRoute = read('app/api/owner-app/assets/[assetId]/route.ts');

const ownerAssetOptions = read('app/owner-app/assets/[assetId]/owner-asset-options-client.tsx');
const ownerAssetDetail = read('app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx');
const ownerStyles = read('app/owner-app/owner-app.module.css');
const assetLeadsRoute = read('app/api/asset-leads/route.ts');
const correctionLibrary = read('lib/dealer-asset-corrections.ts');
const correctionEditor = read('components/DealerAssetCorrectionEditor.tsx');

const correctionMigration = read('database/migrations/70-license-renewal-corrections.sql');
const notifications = read('lib/notifications.ts');

test('the owner share modal includes licence renewals and selected eligible assets', () => {
  assert.match(registerClient, /<strong>Licence renewal<\/strong>/);
  assert.match(registerClient, /openFullRegisterQuotePartnerPicker\('license_renewal'\)/);
  assert.match(registerClient, /readLicenseStatusChoice\(asset\) === 'yes'/);
  assert.match(registerClient, /selectedDealerShareAssetIds/);
  assert.match(registerClient, /source: 'licence_register_share'/);
  assert.match(registerClient, /const \[selectedQuotePartnerIds, setSelectedQuotePartnerIds\] = useState<string\[\]>\(\[\]\)/);
  assert.match(registerClient, /onClick=\{\(\) => toggleQuotePartnerSelection\(partner\)\}/);
  assert.match(registerClient, /aria-pressed=\{isSelected\}/);
  assert.match(registerClient, /Continue with \$\{selectedQuotePartners\.length\}/);
  assert.match(registerClient, /for \(const partner of selectedPartners\)/);
  assert.match(registerClient, /const preservedSelections = current\.filter\(\(partner\) => selectedQuotePartnerIds\.includes\(partner\.userId\)\)/);
  assert.doesNotMatch(registerClient, /assetQuotePartnerChoose/);
  assert.match(registerStyles, /Partner picker: full-card multi-select/);
  assert.match(registerStyles, /assetQuotePartnerCard\.assetQuotePartnerCardActive[\s\S]*background: linear-gradient\(135deg, #e9f8f1/);
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

test('every document constructor supplies category and document type metadata', () => {
  for (const source of [assetRegisterRoute, ownerAssetActionsRoute, ownerAssetRoute]) {
    assert.match(source, /category: normalizeAssetDocumentCategory/);
    assert.match(source, /documentType: normalizeAssetDocumentType/);
  }

});

test('renewal lead snapshots do not carry valuation or unrelated private specs', () => {
  assert.match(partnerAccess, /const snapshotSpecs = leadType === 'license_renewal'/);
  assert.match(partnerAccess, /licenseStatus: 'yes'/);
  assert.match(partnerAccess, /licenceRenewalDate: licenseRenewalDate/);
  assert.match(partnerAccess, /if \(leadType === 'license_renewal'\) return baseSnapshot/);
});
