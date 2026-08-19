import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const modal = read('components/DesktopServiceModal.tsx');
const modalStyles = read('components/DesktopServiceModal.module.css');
const ownerClient = read('app/maintenance/maintenance-client.tsx');
const dealerClient = read('components/DealerMaintenanceTrackerClient.tsx');
const dealerStyles = read('components/DealerMaintenanceTrackerClient.module.css');
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
  assert.match(dealerClient, /!isCompletedCard && asset\.nextMaintenance/);
  assert.doesNotMatch(dealerClient, /!dealerAppMode && !isCompletedCard && asset\.nextMaintenance/);
  assert.doesNotMatch(modal, /Desktop backup entry|WrenchIcon|headerIcon/);
  assert.match(modal, /serviceAssetMeta\(record\)/);
  assert.match(modal, /Year Model:/);
  assert.match(modal, /Usage:/);
  assert.match(modal, /Condition:/);
  assert.match(modalStyles, /font-family: var\(--font-heading, 'Montserrat'\)/);
  assert.match(modalStyles, /font-weight: 780/);
  assert.match(modal, /Completion date/);
  assert.match(modal, /Usage at completion/);
  assert.match(modal, /Notes \/ problems/);
  assert.match(modal, /How should this \{actionName\} be saved\?/);
  assert.match(modal, /Complete this scheduled item/);
  assert.match(modal, /Keep the scheduled item open/);
  assert.match(modal, /Record completed \{actionName\}/);
  assert.match(modalStyles, /\.choiceComparison \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

test('Dealer maintenance card actions stay in one row and use the copper service action', () => {
  const actions = dealerClient.slice(
    dealerClient.indexOf('styles.trackerHeaderActions'),
    dealerClient.indexOf('</div>', dealerClient.indexOf('styles.trackerHeaderActions')),
  );
  assert.ok(actions.indexOf("'Service'") < actions.indexOf("'History'"));
  assert.ok(actions.indexOf("'History'") < actions.indexOf('<span>Manage</span>'));
  assert.doesNotMatch(actions, /Record service/);
  assert.match(dealerStyles, /\.trackerHeaderActions \{[\s\S]*?display: flex !important;[\s\S]*?flex-wrap: nowrap !important;/);
  assert.match(dealerStyles, /\.serviceActionButton\.serviceActionButton \{[\s\S]*?color: #6d350f !important;[\s\S]*?border-color: #e8a56a !important;/);
  assert.match(dealerStyles, /white-space: nowrap/);
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

test('scheduled and separate work explain different outcomes before saving', () => {
  assert.match(modal, /“\$\{record\.title\}” will remain open and unchanged/);
  assert.match(modal, /record\.recurringEnabled && !isSeparateCompletion/);
  assert.match(modal, /The scheduled item stays open/);
  assert.match(modal, /Save separate \$\{actionName\}/);
  assert.match(modal, /Complete scheduled \$\{actionName\}/);
  assert.match(modalStyles, /\.separateBanner \{[\s\S]*?background: #fff8e9/);
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
  assert.doesNotMatch(maintenance, /throw new Error\('COMPLETION_USAGE_REQUIRED'\)/);
  assert.match(maintenance, /completedUsage = existing\.triggerType === 'usage'[\s\S]*?existing\.currentUsage/);
  assert.match(maintenance, /lower\(trim\(coalesce\(status, 'upcoming'\)\)\) not in \('done', 'cancelled', 'canceled'\)/);
  assert.match(maintenance, /completed_at = \$3::timestamptz/);
  assert.match(maintenance, /completedRecord\.completedAtIso/);
  assert.match(maintenance, /createNextRecurringRecord\(client, userId, completed\)/);
});
