import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Owner App exposes one clear Maintenance & Fuel entry point', async () => {
  const [home, operations, styles] = await Promise.all([
    source('app/owner-app/page.tsx'),
    source('app/owner-app/operations/page.tsx'),
    source('app/owner-app/owner-app.module.css'),
  ]);

  assert.match(home, /label: 'Maintenance & Fuel'/);
  assert.match(home, /href: '\/owner-app\/operations'/);
  assert.match(operations, />Choose option</);
  assert.match(operations, /styles\.operationsLandingLauncher/);
  assert.doesNotMatch(operations, /Choose what you want to record\./);
  assert.doesNotMatch(operations, /Record services, repairs|Record fuel from/);
  assert.match(operations, /href="\/owner-app\/operations\/maintenance"/);
  assert.match(operations, /href="\/owner-app\/operations\/fuel"/);
  assert.match(styles, /\.operationsLandingLauncher \.operationChoiceCard \{[\s\S]*?min-height: 78px/);
});

test('maintenance selection reuses the friendly asset cards and signed-in owner workflow', async () => {
  const [listPage, assetList, detailPage, scanClient] = await Promise.all([
    source('app/owner-app/operations/maintenance/page.tsx'),
    source('app/owner-app/assets/owner-assets-client.tsx'),
    source('app/owner-app/operations/maintenance/[assetId]/page.tsx'),
    source('app/scan/[publicAssetCode]/scan-client.tsx'),
  ]);

  assert.match(listPage, /mode="maintenance"/);
  assert.match(assetList, /Record work/);
  assert.match(assetList, /owner-app\/operations\/maintenance/);
  assert.match(detailPage, /expectedOwnerUserId: access\.ownerUserId/);
  assert.match(detailPage, /ownerAppMode/);
  assert.match(scanClient, /new URLSearchParams\(\{ ownerApp: "1" \}\)/);
  assert.match(scanClient, /params\.set\("assetId", normalizedOwnerAppAssetId\)/);
  assert.match(scanClient, /Owner maintenance/);
});

test('maintenance APIs authorize the owner and derive the operator identity on the server', async () => {
  const [auth, getRoute, eventRoute, uploadRoute] = await Promise.all([
    source('lib/scan-auth.ts'),
    source('app/api/scan/assets/[publicAssetCode]/route.ts'),
    source('app/api/scan/assets/[publicAssetCode]/event/route.ts'),
    source('app/api/scan/uploads/route.ts'),
  ]);

  assert.match(auth, /expectedOwnerUserId: ownerAccess\.ownerUserId/);
  assert.match(auth, /accessMode: "owner_session"/);
  assert.match(getRoute, /authorizeOwnerAppScanAccess/);
  assert.match(eventRoute, /access\.accessMode === "owner_session"/);
  assert.match(eventRoute, /asText\(access\.ownerAppDisplayName\) \|\| "Owner"/);
  assert.match(uploadRoute, /authorizeOwnerAppScanAccess/);
});

test('Owner Overview only completes scheduled maintenance through recorded work', async () => {
  const [overview, workPage, scanClient, eventRoute, scheduleClient, ownerActions] = await Promise.all([
    source('app/owner-app/attention/owner-attention-client.tsx'),
    source('app/owner-app/operations/maintenance/[assetId]/page.tsx'),
    source('app/scan/[publicAssetCode]/scan-client.tsx'),
    source('app/api/scan/assets/[publicAssetCode]/event/route.ts'),
    source('app/field-manager/assets/[publicAssetCode]/maintenance/field-manager-maintenance-client.tsx'),
    source('app/api/owner-app/assets/[assetId]/actions/route.ts'),
  ]);

  assert.match(overview, /owner-app\/operations\/maintenance/);
  assert.match(overview, /maintenanceId: item\.sourceId/);
  assert.match(overview, /maintenanceType: item\.type/);
  assert.doesNotMatch(overview, /owner-app\/assets\/\$\{encodeURIComponent\(item\.assetId\)\}\/maintenance\?maintenanceId/);

  assert.match(workPage, /ownerAppScheduledMaintenanceId=\{maintenanceId \|\| null\}/);
  assert.match(workPage, /ownerAppScheduledMaintenanceType=\{maintenanceType\}/);
  assert.match(scanClient, /ownerAppMode[\s\S]*ownerAppScheduledMaintenanceId/);
  assert.match(scanClient, /scheduledMaintenanceId: scheduledMaintenanceIdForSave \|\| null/);
  assert.match(eventRoute, /access\.accessMode !== "field_manager" && access\.accessMode !== "owner_session"/);
  assert.match(eventRoute, /getAssetMaintenanceRecordById\([\s\S]*scheduledMaintenanceId/);
  assert.match(eventRoute, /access\.accessMode === "owner_session"[\s\S]*access\.ownerAppDisplayName/);

  assert.match(scheduleClient, />\s*Record work\s*</);
  assert.doesNotMatch(scheduleClient, /Mark done/);
  assert.doesNotMatch(scheduleClient, /updateOwnerMaintenance\(record, 'maintenance-complete'\)/);
  assert.match(ownerActions, /action === 'maintenance-complete'[\s\S]*Record the completed work, usage and notes/);
  assert.doesNotMatch(ownerActions, /completeAssetMaintenanceRecord/);
});

test('Owner and Field Manager Overview Clear actions require confirmation', async () => {
  const [ownerOverview, managerOverview, confirmation] = await Promise.all([
    source('app/owner-app/attention/owner-attention-client.tsx'),
    source('app/field-manager/field-manager-overview-client.tsx'),
    source('app/field-manager/overview-clear-confirmation.tsx'),
  ]);

  for (const overview of [ownerOverview, managerOverview]) {
    assert.match(overview, /setClearCandidate\(item\)/);
    assert.match(overview, /<OverviewClearConfirmation/);
    assert.doesNotMatch(overview, /onClick=\{\(\) => void handleClearItem\(item\)\}/);
  }

  assert.match(confirmation, /Are you sure\?/);
  assert.match(confirmation, /This will not delete the asset or its records\./);
  assert.match(confirmation, /aria-modal="true"/);
});

test('fuel selection supports storage tanks and petrol-station costs with signed-in Owner App access', async () => {
  const [choicePage, storagePage, petrolPage, petrolClient, locationModal, detailPage, fuelClient, fuelAuth, listApi, getRoute, issueRoute, refillRoute, dipstickRoute] = await Promise.all([
    source('app/owner-app/operations/fuel/page.tsx'),
    source('app/owner-app/operations/fuel/storage/page.tsx'),
    source('app/owner-app/operations/fuel/petrol-station/page.tsx'),
    source('app/owner-app/operations/fuel/petrol-station/petrol-station-fuel-client.tsx'),
    source('components/FuelLocationModal.tsx'),
    source('app/owner-app/operations/fuel/[publicFuelStorageCode]/page.tsx'),
    source('app/fuel-scan/[publicFuelStorageCode]/fuel-scan-client.tsx'),
    source('lib/fuel-ledger.ts'),
    source('app/api/owner-app/fuel/route.ts'),
    source('app/api/fuel-scan/storage/[publicFuelStorageCode]/route.ts'),
    source('app/api/fuel-scan/storage/[publicFuelStorageCode]/issue/route.ts'),
    source('app/api/fuel-scan/storage/[publicFuelStorageCode]/refill/route.ts'),
    source('app/api/fuel-scan/storage/[publicFuelStorageCode]/dipstick/route.ts'),
  ]);

  assert.match(choicePage, /Choose fuel source/);
  assert.match(choicePage, /owner-app\/operations\/fuel\/storage/);
  assert.match(choicePage, /owner-app\/operations\/fuel\/petrol-station/);
  assert.match(storagePage, /FieldManagerDieselClient ownerAppMode/);
  assert.match(petrolPage, /operatorName=\{access\.displayName\}/);
  assert.match(petrolClient, /fetch\('\/api\/fuel\/slips\/upload'/);
  assert.match(petrolClient, /fetch\('\/api\/fuel\/slips'/);
  assert.match(petrolClient, /targetType: 'asset'/);
  assert.match(petrolClient, /latitude: coordinates\.latitude/);
  assert.match(locationModal, /Location required/);
  assert.match(detailPage, /ownerAppOperatorName=\{access\.displayName\}/);
  assert.match(fuelClient, /ownerAppMode \? '\?ownerApp=1'/);
  assert.match(fuelClient, /<FuelLocationModal/);
  assert.match(fuelClient, /No fuel PIN or name is required\./);
  assert.match(fuelAuth, /ownerAccess\.ownerUserId !== storage\.userId/);
  assert.match(listApi, /listFieldManagerFuelStorages\(access\.ownerUserId\)/);

  for (const route of [getRoute, issueRoute, refillRoute, dipstickRoute]) {
    assert.match(route, /ownerAppHint: isOwnerAppHint/);
  }

  for (const route of [issueRoute, refillRoute, dipstickRoute]) {
    assert.match(route, /access\.ownerAppDisplayName \?\? 'Owner'/);
  }
});
