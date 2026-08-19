import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Owner and Field Manager apps show the active schedule instead of another scheduling form', () => {
  const fieldClient = source('app/field-manager/assets/[publicAssetCode]/maintenance/field-manager-maintenance-client.tsx');
  const ownerClient = source('app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx');

  assert.match(fieldClient, /const upcomingMaintenance = maintenanceRecords\.find/);
  assert.match(fieldClient, /\{!upcomingMaintenance \? \(/);
  assert.match(fieldClient, /A recurring schedule is already in place\./);
  assert.match(fieldClient, /Next due[\s\S]*ownerMaintenanceDueLabel\(upcomingMaintenance\)/);
  assert.match(ownerClient, /Recurring schedule already in place/);
  assert.match(ownerClient, /Next: \{upcomingMaintenance\.title\}/);
  assert.match(ownerClient, /upcomingMaintenance \? \([\s\S]*\) : \(\s*<form/);
});

test('Field Managers can load schedules and are routed into the recorded-work flow', () => {
  const fieldClient = source('app/field-manager/assets/[publicAssetCode]/maintenance/field-manager-maintenance-client.tsx');
  const fieldRoute = source('app/api/field-manager/assets/[assetId]/maintenance/route.ts');

  assert.match(fieldRoute, /export async function GET/);
  assert.match(fieldRoute, /listAssetMaintenanceData\(access\.session\.ownerUserId, \{ assetId: asset\.id \}\)/);
  assert.match(fieldClient, /scheduledMaintenanceId: record\.id/);
  assert.match(fieldClient, /scheduledMaintenanceType: record\.maintenanceType/);
  assert.match(fieldClient, />\s*Record work\s*</);
  assert.doesNotMatch(fieldClient, /Mark done/i);
});

test('Owner App maintenance can only be completed through recorded work', () => {
  const ownerClient = source('app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx');

  assert.match(ownerClient, />Record work<\/Link>/);
  assert.doesNotMatch(ownerClient, /maintenance-complete/);
  assert.doesNotMatch(ownerClient, /Mark done/i);
});

test('Desktop completion uses the servicing form and server acknowledgement', () => {
  const desktopClient = source('app/maintenance/maintenance-client.tsx');
  const serviceModal = source('components/DesktopServiceModal.tsx');
  const completionRoute = source('app/api/maintenance/[maintenanceId]/complete/route.ts');

  assert.match(desktopClient, /function openComplete\(record: MaintenanceRecord\)/);
  assert.match(desktopClient, /<DesktopServiceModal/);
  assert.match(desktopClient, /Record service/);
  assert.match(serviceModal, /Log work that has already been completed\./);
  assert.match(serviceModal, /This scheduled item will close and the next one will be created automatically/);
  assert.match(serviceModal, /The scheduled item stays open/);
  assert.match(desktopClient, /confirmedComplete: true/);
  assert.match(completionRoute, /requestedStatus === 'done' && body\.confirmedComplete !== true/);
  assert.match(completionRoute, /Confirm that the maintenance has physically been completed/);
});
