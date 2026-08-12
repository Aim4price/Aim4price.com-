import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const permissions = read('lib/asset-document-permissions.ts');
const partnerAccess = read('lib/partner-access.ts');
const discovery = read('lib/asset-discovery.ts');
const discoveryClient = read('app/asset-discovery/asset-discovery-client.tsx');
const registerClient = read('app/asset-register/asset-register-client.tsx');
const leadsClient = read('app/leads/leads-client.tsx');
const header = read('components/AppHeader.tsx');
const signup = read('app/auth/auth-client.tsx');
const assetRegisterRoute = read('app/api/asset-register/route.ts');
const ownerAssetActionsRoute = read('app/api/owner-app/assets/[assetId]/actions/route.ts');
const ownerAssetRoute = read('app/api/owner-app/assets/[assetId]/route.ts');
const accountantWorkspace = read('lib/accountant-workspace.ts');

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
  assert.match(registerClient, /<strong>Licence renewals<\/strong>/);
  assert.match(registerClient, /openFullRegisterQuotePartnerPicker\('license_renewal'\)/);
  assert.match(registerClient, /readLicenseStatusChoice\(asset\) === 'yes'/);
  assert.match(registerClient, /selectedDealerShareAssetIds/);
  assert.match(registerClient, /source: 'licence_register_share'/);
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
  assert.match(registerClient, /current or older licensing papers/);
  assert.match(registerClient, /documentType: normalizeAssetDocumentType/);
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
  assert.match(discovery, /Renewal due/);
  assert.match(discoveryClient, /Offer renewal help/);
  assert.match(discoveryClient, /Exact details remain private until the owner approves/);
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
});

test('renewal lead snapshots do not carry valuation or unrelated private specs', () => {
  assert.match(partnerAccess, /const snapshotSpecs = leadType === 'license_renewal'/);
  assert.match(partnerAccess, /licenseStatus: 'yes'/);
  assert.match(partnerAccess, /licenceRenewalDate: licenseRenewalDate/);
  assert.match(partnerAccess, /if \(leadType === 'license_renewal'\) return baseSnapshot/);
});
