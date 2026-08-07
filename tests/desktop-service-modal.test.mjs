import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const modal = read('components/DesktopServiceModal.tsx');
const ownerClient = read('app/maintenance/maintenance-client.tsx');
const dealerClient = read('components/DealerMaintenanceTrackerClient.tsx');
const dealerRoute = read('app/api/dealer/maintenance/[accessId]/route.ts');
const dealerTracker = read('lib/dealer-maintenance-tracker.ts');
const maintenance = read('lib/asset-maintenance.ts');
const guidelines = read('lib/maintenance-service-guidelines.ts');
const scanClient = read('app/scan/[publicAssetCode]/scan-client.tsx');

test('Owner and Dealer desktop maintenance use one mobile-inspired service form', () => {
  assert.match(ownerClient, /import DesktopServiceModal/);
  assert.match(ownerClient, /<DesktopServiceModal/);
  assert.match(dealerClient, /import DesktopServiceModal/);
  assert.match(dealerClient, /<DesktopServiceModal/);
  assert.match(dealerClient, /!dealerAppMode && !isCompletedCard && asset\.nextMaintenance/);
  assert.match(modal, /Desktop backup entry/);
  assert.match(modal, /Completion date/);
  assert.match(modal, /Usage at completion/);
  assert.match(modal, /Notes \/ problems/);
});

test('Desktop and app servicing share the same equipment checklists and saved note format', () => {
  assert.match(scanClient, /from "\.\.\/\.\.\/\.\.\/lib\/maintenance-service-guidelines"/);
  assert.match(scanClient, /buildMaintenanceCompletionNote/);
  assert.match(modal, /checkedOptionsForProfile/);
  assert.match(modal, /servicedOptionsForProfile/);
  assert.match(modal, /buildMaintenanceCompletionNote/);
  assert.match(guidelines, /Oil level/);
  assert.match(guidelines, /Changed engine oil/);
  assert.match(guidelines, /Nuts and bolts/);
  assert.match(guidelines, /Replaced pins \/ bushes/);
});

test('Service and check-up validation follows the app rules', () => {
  assert.match(modal, /Select at least one checked item or add notes\/problems/);
  assert.match(modal, /Select at least one completed service item or add notes\/problems/);
  assert.match(modal, /copy\.companyLabel.*is required/);
  assert.match(modal, /copy\.mechanicLabel.*is required/);
  assert.match(modal, /cannot be lower than the saved/);
  assert.match(modal, /final \$\{unit\} reading for this usage-based maintenance/);
  assert.match(modal, /completion date cannot be in the future/i);
});

test('Dealer completion is owner-asset guarded, audited and refreshes recurring cards', () => {
  assert.match(dealerRoute, /body\.confirmedComplete !== true/);
  assert.match(dealerRoute, /Dealer entry by \$\{dealerName\}/);
  assert.match(dealerTracker, /asset\.openMaintenanceRecords\.find\(\(record\) => record\.id === input\.maintenanceId\)/);
  assert.match(dealerTracker, /\{ assetId: asset\.assetId \}/);
  assert.match(dealerTracker, /const refreshedAsset = await getDealerTrackedAsset/);
  assert.match(dealerClient, /The next recurring maintenance is now being tracked/);
});

test('Backend preserves actual service date and advances recurring schedules from completion', () => {
  assert.match(maintenance, /completedAt\?: unknown/);
  assert.match(maintenance, /COMPLETION_DATE_IN_FUTURE/);
  assert.match(maintenance, /COMPLETION_USAGE_REQUIRED/);
  assert.match(maintenance, /completed_at = \$3::timestamptz/);
  assert.match(maintenance, /completedRecord\.completedAtIso/);
  assert.match(maintenance, /createNextRecurringRecord\(client, userId, completed\)/);
});
