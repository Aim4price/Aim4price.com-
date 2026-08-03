import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ownerMaintenanceRoute = read('app/api/maintenance/route.ts');
const fieldManagerMaintenanceRoute = read('app/api/field-manager/assets/[assetId]/maintenance/route.ts');
const ownerOverview = read('lib/owner-app-overview.ts');
const fieldManagerOverview = read('lib/field-manager-overview.ts');
const dealerTracker = read('lib/dealer-maintenance-tracker.ts');
const managerOpenRoute = read('app/api/field-manager/assets/[assetId]/open/route.ts');
const scanEventRoute = read('app/api/scan/assets/[publicAssetCode]/event/route.ts');

test('owner, Field Manager and approved dealer schedules remain owner-owned maintenance records', () => {
  assert.match(ownerMaintenanceRoute, /createAssetMaintenanceRecord\(userId, body\)/);
  assert.match(
    fieldManagerMaintenanceRoute,
    /createAssetMaintenanceRecord\(access\.session\.ownerUserId, \{[\s\S]*assetId: asset\.id/,
  );
  assert.match(
    dealerTracker,
    /insert into public\.asset_maintenance_records[\s\S]*\[\s*input\.ownerUserId,/,
  );
});

test('Owner App Overview includes every upcoming schedule for an owned asset', () => {
  assert.match(
    ownerOverview,
    /listAssetMaintenanceRecords\(ownerUserId, \{ status: 'upcoming' \}\)/,
  );
  assert.match(ownerOverview, /const asset = byId\.get\(entry\.assetId\)/);
  assert.doesNotMatch(ownerOverview, /assignedFieldManagerId/);
});

test('Field Manager Overview includes every upcoming schedule for an accessible asset', () => {
  const queryStart = fieldManagerOverview.indexOf('const [maintenanceRecords, problemGroups, licenseRows]');
  const queryEnd = fieldManagerOverview.indexOf('const items:', queryStart);
  const maintenanceQuery = fieldManagerOverview.slice(queryStart, queryEnd);
  assert.match(maintenanceQuery, /listAssetMaintenanceRecords\(input\.ownerUserId, \{[\s\S]*status: 'upcoming'/);
  assert.doesNotMatch(maintenanceQuery, /assignedTo/);

  const filterStart = fieldManagerOverview.indexOf('maintenanceRecords.forEach');
  const filterEnd = fieldManagerOverview.indexOf('problemGroups.forEach', filterStart);
  const maintenanceFilter = fieldManagerOverview.slice(filterStart, filterEnd);
  assert.match(maintenanceFilter, /allowedAssetIds\.has\(record\.assetId\)/);
  assert.doesNotMatch(maintenanceFilter, /assignedFieldManagerId/);
});

test('an authorised Field Manager can open and record any visible schedule for an accessible asset', () => {
  assert.match(managerOpenRoute, /getFieldManagerAssetForOpen/);
  assert.match(managerOpenRoute, /getAssetMaintenanceRecordById/);
  assert.match(managerOpenRoute, /maintenance\.assetId !== asset\.id/);
  assert.doesNotMatch(managerOpenRoute, /getAssignedFieldManagerMaintenanceRecord/);

  assert.match(scanEventRoute, /getAssetMaintenanceRecordById/);
  assert.match(scanEventRoute, /scheduledMaintenance\.assetId !== access\.asset\.id/);
  assert.doesNotMatch(scanEventRoute, /assignedFieldManagerId: access\.fieldManagerId/);
});

test('Dealer Maintenance Tracker includes every schedule for an actively shared asset', () => {
  assert.match(
    dealerTracker,
    /listAssetMaintenanceRecords\(row\.owner_user_id, \{[\s\S]*assetId: row\.asset_register_item_id/,
  );
  assert.match(
    dealerTracker,
    /record\.assetId === row\.asset_register_item_id && record\.status === 'upcoming'/,
  );
});
