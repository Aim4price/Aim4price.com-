import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ownerMaintenanceRoute = read('app/api/maintenance/route.ts');
const fieldManagerMaintenanceRoute = read('app/api/owner-app/assets/[assetId]/actions/route.ts');
const ownerOverview = read('lib/owner-app-overview.ts');

const dealerTracker = read('lib/dealer-maintenance-tracker.ts');

const scanEventRoute = read('app/api/scan/assets/[publicAssetCode]/event/route.ts');

test('owner, Manager and approved dealer schedules remain owner-owned maintenance records', () => {
  assert.match(ownerMaintenanceRoute, /createAssetMaintenanceRecord\(userId, body\)/);
  assert.match(
    fieldManagerMaintenanceRoute,
    /createAssetMaintenanceRecord\(access\.ownerUserId, \{[\s\S]*assetId: params\.assetId/,
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

test('an authorised Manager can open and record any visible schedule for an accessible asset', () => {

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
