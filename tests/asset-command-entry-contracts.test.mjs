import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { normalizeInternalReturnPath, readSingleSearchParam } from '../lib/internal-return-path.ts';

const costPage = readFileSync(new URL('../app/my-invoices/page.tsx', import.meta.url), 'utf8');
const costClient = readFileSync(new URL('../app/my-invoices/my-invoices-client.tsx', import.meta.url), 'utf8');
const maintenancePage = readFileSync(new URL('../app/maintenance/page.tsx', import.meta.url), 'utf8');
const maintenanceClient = readFileSync(new URL('../app/maintenance/maintenance-client.tsx', import.meta.url), 'utf8');

test('return targets accept only same-origin internal paths', () => {
  assert.equal(
    normalizeInternalReturnPath('/asset-register?scope=combined&assetId=asset-1#asset-card-asset-1'),
    '/asset-register?scope=combined&assetId=asset-1#asset-card-asset-1',
  );
  assert.equal(normalizeInternalReturnPath(['/maintenance?assetId=asset-1', '/ignored']), '/maintenance?assetId=asset-1');
  assert.equal(readSingleSearchParam([' add ', 'ignored']), 'add');

  for (const unsafeTarget of [
    'https://example.com/steal',
    '//example.com/steal',
    '/\\example.com/steal',
    'javascript:alert(1)',
    '/asset-register\nmalformed',
  ]) {
    assert.equal(normalizeInternalReturnPath(unsafeTarget), '', unsafeTarget);
  }
});

test('owner Cost Ledger parses asset quick-add entry and returns only that flow', () => {
  assert.match(costPage, /initialAssetId = readSingleSearchParam\(searchParams\?\.assetId\)/);
  assert.match(costPage, /readSingleSearchParam\(searchParams\?\.add\) === '1'/);
  assert.match(costPage, /requestedAction === 'add'/);
  assert.match(costPage, /initialReturnTo = normalizeInternalReturnPath\(searchParams\?\.returnTo\)/);
  assert.match(costPage, /initialReturnTo=\{initialReturnTo\}/);

  assert.match(costClient, /initialReturnTo\?: string;/);
  assert.match(costClient, /setQuickLaunchActive\(true\);[\s\S]*?openAddInvoiceModal\(requestedAssetId\)/);
  assert.match(costClient, /const shouldReturn = quickLaunchActive && quickLaunchReturnTo;/);
  assert.match(costClient, /window\.location\.assign\(shouldReturn\)/);
  assert.match(costClient, /setAssetLockedForFlow\(Boolean\(normalizedAssetId\)\)/);
  assert.match(costClient, /disabled=\{assetLockedForFlow\}/);
  assert.match(costClient, /This asset is fixed for this quick add\./);
});

test('maintenance supports filtered asset entry and locked quick-add return', () => {
  assert.match(maintenancePage, /initialAssetId = readSingleSearchParam\(searchParams\?\.assetId\)/);
  assert.match(maintenancePage, /readSingleSearchParam\(searchParams\?\.add\) === '1'/);
  assert.match(maintenancePage, /requestedAction === 'add'/);
  assert.match(maintenancePage, /initialReturnTo = normalizeInternalReturnPath\(searchParams\?\.returnTo\)/);
  assert.match(maintenancePage, /initialOpenAdd=\{initialOpenAdd\}/);

  assert.match(maintenanceClient, /function filtersForInitialAsset\(assetId: string\)/);
  assert.match(maintenanceClient, /useState<MaintenanceFilters>\(initialFilters\)/);
  assert.match(maintenanceClient, /setDraft\(emptyDraftForAsset\(requestedAsset\)\);[\s\S]*?setModalMode\('maintenance-type'\)/);
  assert.match(maintenanceClient, /const assetEntryLocked = quickLaunchActive/);
  assert.match(maintenanceClient, /!assetEntryLocked \? \([\s\S]*?returnToAssetPicker/);
  assert.match(maintenanceClient, /const shouldReturn = quickLaunchActive && quickLaunchReturnTo;/);
  assert.match(maintenanceClient, /window\.location\.assign\(shouldReturn\)/);
  assert.match(maintenanceClient, /href=\{filteredAssetReturnTo\}>← Back to asset<\/a>/);
});
