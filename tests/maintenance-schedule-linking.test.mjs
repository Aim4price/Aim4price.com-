import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const scanAssetRoute = read('app/api/scan/assets/[publicAssetCode]/route.ts');
const scanEventRoute = read('app/api/scan/assets/[publicAssetCode]/event/route.ts');
const scanClient = read('app/scan/[publicAssetCode]/scan-client.tsx');
const desktopServiceModal = read('components/DesktopServiceModal.tsx');
const dealerClient = read('components/DealerMaintenanceTrackerClient.tsx');
const dealerScheduleModal = read('components/DealerMaintenanceScheduleModal.tsx');
const dealerApi = read('app/api/dealer/maintenance/[accessId]/route.ts');
const proposalApi = read('app/api/dealer/maintenance/schedule-proposals/route.ts');
const dealerTracker = read('lib/dealer-maintenance-tracker.ts');
const maintenance = read('lib/asset-maintenance.ts');
const ownerMaintenance = read('app/maintenance/maintenance-client.tsx');
const ownerCompletionApi = read('app/api/maintenance/[maintenanceId]/complete/route.ts');

test('Owner and Field Manager service explicitly chooses scheduled or separate maintenance', () => {
  assert.match(scanAssetRoute, /listAssetMaintenanceRecords/);
  assert.match(scanAssetRoute, /openMaintenance = records/);
  assert.match(scanClient, /scheduleChoiceOptions/);
  assert.match(scanClient, /Yes, complete scheduled/);
  assert.match(scanClient, /No, save separately/);
  assert.match(scanClient, /maintenanceDecision: maintenanceDecisionForSave \|\| null/);
  assert.match(scanEventRoute, /maintenanceDecision === "separate"/);
  assert.match(scanEventRoute, /maintenanceDecision !== "separate"/);
  assert.match(scanEventRoute, /maintenanceDecision === "scheduled" && !scheduledMaintenanceId/);
});

test('old clients keep the safe automatic schedule match while an explicit separate choice never closes it', () => {
  const matchingGuard = scanEventRoute.slice(
    scanEventRoute.indexOf('let scheduledMaintenance'),
    scanEventRoute.indexOf('const completionNote'),
  );
  assert.match(matchingGuard, /maintenanceDecision !== "separate"/);
  assert.match(matchingGuard, /listAssetMaintenanceRecords/);
  assert.match(scanEventRoute, /else if \(procedureKind\)[\s\S]*recordStandaloneAssetMaintenanceCompletion/);
});

test('Dealer service uses the same explicit choice and stable retry identifier', () => {
  assert.match(dealerClient, /askScheduleLink/);
  assert.match(desktopServiceModal, /linkToScheduledMaintenance\?: boolean/);
  assert.match(desktopServiceModal, /clientEventId: string/);
  assert.match(desktopServiceModal, /globalThis\.crypto\.randomUUID\(\)/);
  assert.match(desktopServiceModal, /No, save separately/);
  assert.match(desktopServiceModal, /Yes, complete scheduled/);
  assert.match(dealerApi, /body\.linkToScheduledMaintenance === false/);
  assert.match(dealerApi, /recordDealerStandaloneMaintenance/);
  assert.match(dealerTracker, /sourceScanEventId: input\.clientEventId/);
});

test('Owner desktop uses the same explicit choice without changing the scheduled completion path', () => {
  assert.match(ownerMaintenance, /<DesktopServiceModal[\s\S]*askScheduleLink/);
  assert.match(ownerMaintenance, /completion\.linkToScheduledMaintenance === false/);
  assert.match(ownerCompletionApi, /saveCompletedMaintenance/);
  assert.match(ownerCompletionApi, /body\.linkToScheduledMaintenance !== false/);
  assert.match(ownerCompletionApi, /recordStandaloneAssetMaintenanceCompletion/);
  assert.match(ownerCompletionApi, /sourceScanEventId: body\.clientEventId/);
  assert.match(ownerCompletionApi, /completeAssetMaintenanceRecord\(userId, maintenanceId, body\)/);
});

test('Dealer proposals remain visible while pending and become contextual edit actions', () => {
  assert.match(dealerClient, /Awaiting approval/);
  assert.match(dealerClient, /pendingScheduleProposals/);
  assert.match(dealerClient, /Edit proposal/);
  assert.match(dealerClient, /Edit schedule/);
  assert.match(dealerScheduleModal, /initialProposal/);
  assert.match(dealerScheduleModal, /initialRecord/);
  assert.match(dealerScheduleModal, /method: editingActiveSchedule \|\| editingProposal \? 'PATCH' : 'POST'/);
  assert.match(proposalApi, /updateDealerMaintenanceScheduleProposal/);
  assert.match(dealerApi, /export async function PATCH/);
  assert.match(dealerTracker, /asset\.maintenanceRecords\.length > 0[\s\S]*?asset\.scheduleProposals\.some/);
});

test('duplicate Dealer proposals are blocked instead of creating conflicting schedules', () => {
  assert.match(dealerTracker, /MAINTENANCE_PROPOSAL_ALREADY_EXISTS/);
  assert.match(dealerTracker, /MAINTENANCE_ALREADY_SCHEDULED/);
  assert.match(proposalApi, /A pending proposal already exists/);
  assert.match(proposalApi, /This maintenance is already scheduled/);
});

test('existing schedule actions switch to edit without changing successful completion behavior', () => {
  assert.match(scanClient, /openMaintenanceOptions\.length > 0 \? <>\s*<span>Edit<\/span><span>Schedule<\/span>/);
  assert.match(scanClient, /window\.location\.replace\(assetActionsHref\)/);
  assert.match(scanClient, /Returning to asset actions/);
  assert.match(maintenance, /createNextRecurringRecord\(client, userId, completed\)/);
  assert.match(
    maintenance,
    /const baseUsage = completedRecord\.completedUsage[\s\S]*?completedRecord\.currentUsage[\s\S]*?completedRecord\.dueUsage/,
  );
});
