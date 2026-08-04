import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const tracker = read('components/DealerMaintenanceTrackerClient.tsx');
const trackerStyles = read('components/DealerMaintenanceTrackerClient.module.css');
const trackerData = read('lib/dealer-maintenance-tracker.ts');
const reportModal = read('components/DealerMaintenanceReportModal.tsx');
const costReportModal = read('components/DealerCostOfOwnershipReportModal.tsx');
const ownerReportRoute = read('app/api/asset-register/scan-report/route.ts');
const costReportRoute = read('app/api/my-invoices/report/route.ts');
const assetRegister = read('app/asset-register/asset-register-client.tsx');
const leads = read('app/leads/leads-client.tsx');
const ownerAppOptions = read('app/owner-app/assets/[assetId]/owner-asset-options-client.tsx');
const ownerAppDetail = read('app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx');
const ownerAppManageRoute = read('app/owner-app/assets/[assetId]/manage/[section]/page.tsx');
const scanClient = read('app/scan/[publicAssetCode]/scan-client.tsx');
const costPermissionMigration = read('database/migrations/64-dealer-cost-of-ownership-permission.sql');

test('dealer tracker lists active shares only', () => {
  assert.match(
    trackerData,
    /where access\.dealer_user_id = \$1 and access\.is_active = true/,
  );
});

test('history access is rechecked before records are expanded', () => {
  assert.match(tracker, /async function toggleMaintenance/);
  assert.match(
    tracker,
    /fetch\('\/api\/dealer\/maintenance', \{ credentials: 'include', cache: 'no-store' \}\)/,
  );
  assert.match(tracker, /This asset is no longer shared with your dealership/);
});

test('upcoming work is collapsed by default and remains outside maintenance history', () => {
  const upcomingIndex = tracker.indexOf('<h3>Upcoming maintenance</h3>');
  const problemsIndex = tracker.indexOf('<h3>Problems and notes</h3>');
  const approvalsIndex = tracker.indexOf('<h3>Awaiting owner approval</h3>');
  const historyModalIndex = tracker.indexOf('{historyAsset ? (');
  assert.ok(upcomingIndex > 0);
  assert.ok(problemsIndex > upcomingIndex);
  assert.ok(approvalsIndex > problemsIndex);
  assert.ok(historyModalIndex > approvalsIndex);
  assert.match(tracker, /<details className=\{styles\.section\}>/);
  assert.match(tracker, /<summary>/);
  assert.match(tracker, /pendingScheduleProposals/);
  assert.match(tracker, /Open one section to see only the information you need/);
  assert.match(tracker, /View maintenance history/);
});

test('history opens as a focused timeline instead of extending the asset card', () => {
  assert.match(tracker, /aria-haspopup="dialog"/);
  assert.match(tracker, /aria-labelledby="maintenance-history-title"/);
  assert.match(tracker, /What would you like to see\?/);
  assert.match(tracker, /Choose a timeline/);
  assert.match(tracker, /Maintenance history/);
  assert.match(tracker, /historyTypeTabs/);
  assert.match(tracker, /historyTimelineFilters/);
  assert.match(tracker, /historyTimeline/);
  assert.match(tracker, /Newest records first/);
  assert.match(trackerStyles, /\.historyModal\.historyModal/);
  assert.match(trackerStyles, /\.historyTimelineItem/);
  assert.doesNotMatch(tracker, /id=\{`maintenance-view-/);
});

test('history separates information, timeline and records into individual modal screens', () => {
  const allIndex = tracker.indexOf("{ value: 'all', label: 'All' }");
  const maintenanceIndex = tracker.indexOf("{ value: 'maintenance', label: 'Maintenance' }");
  const notesIndex = tracker.indexOf("{ value: 'notes', label: 'Notes' }");
  const timelineIndex = tracker.indexOf('historyTimelineOptions');
  assert.ok(allIndex > 0);
  assert.ok(maintenanceIndex > allIndex);
  assert.ok(notesIndex > maintenanceIndex);
  assert.ok(timelineIndex > notesIndex);
  assert.match(tracker, /historyModalStep === 1/);
  assert.match(tracker, /historyModalStep === 2/);
  assert.match(tracker, /historyModalStep === 3/);
  assert.match(tracker, /function chooseHistoryRecordType[\s\S]*setHistoryModalStep\(2\)/);
  assert.match(tracker, /function chooseHistoryTimeline[\s\S]*setHistoryModalStep\(3\)/);
  assert.match(tracker, /historyModalStep === 2 && historyTimelineFilter === 'custom'/);
  assert.match(tracker, />\s*Back\s*</);
  assert.match(tracker, /Last 12 months/);
  assert.match(tracker, /Last 3 months/);
  assert.match(tracker, /Custom dates/);
  assert.match(trackerStyles, /\.historyTypeTabs button[\s\S]*min-height: 6\.5rem/);
  assert.match(trackerStyles, /\.historyChoiceModal\.historyChoiceModal/);
  assert.match(trackerStyles, /width: min\(calc\(100vw - 2rem\), 60rem\)/);
  assert.doesNotMatch(tracker, /aria-pressed=\{historyRecordType === option\.value\}/);
  assert.doesNotMatch(tracker, /aria-pressed=\{historyTimelineFilter === option\.value\}/);
});

test('history adds restrained visual guidance without adding another decision', () => {
  assert.match(tracker, /function HistoryRecordIcon/);
  assert.match(tracker, /function HistoryTimelineChoiceIcon/);
  assert.match(tracker, /className=\{styles\.historyProgress\}/);
  assert.match(tracker, /className=\{styles\.historyChoiceIcon\}/);
  assert.match(tracker, /className=\{styles\.historyChoiceArrow\}/);
  assert.match(trackerStyles, /\.historyProgress/);
  assert.match(trackerStyles, /\.historyChoiceIcon/);
  assert.match(trackerStyles, /radial-gradient\(circle at 8% 0%/);
});

test('maintenance actions use the Aim4price Manage icon and clear report wording', () => {
  const ownerManageIcon = assetRegister.match(/<path d="M12\.22 2h-\.44[^\n]+/u)?.[0];
  assert.ok(ownerManageIcon, 'Owner Asset Register Manage icon should remain available');
  assert.ok(tracker.includes(ownerManageIcon), 'Maintenance should reuse the Owner Asset Register Manage icon');
  assert.match(tracker, /<strong>Maintenance reports<\/strong>/);
  assert.match(tracker, /Choose PDF or Excel and download maintenance history/);
  assert.doesNotMatch(tracker, /<strong>PDF reports<\/strong>/);
});

test('lead and maintenance manage modals share the schedule icon and prioritize contact actions', () => {
  const sharedSchedulePaths = [
    'M6.5 3v3M17.5 3v3M4 8.5h16',
    'm8.5 14 2.1 2.1 4.9-5',
  ];
  for (const path of sharedSchedulePaths) {
    assert.ok(leads.includes(path), `Lead schedule icon should contain ${path}`);
    assert.ok(tracker.includes(path), `Maintenance schedule icon should contain ${path}`);
  }

  const leadManageStart = leads.indexOf('<strong>WhatsApp client</strong>', leads.indexOf('{managedLead ? ('));
  const leadManage = leads.slice(leadManageStart);
  assert.ok(leadManage.indexOf('WhatsApp client') < leadManage.indexOf('Email client'));
  assert.ok(leadManage.indexOf('Email client') < leadManage.indexOf('<strong>Reports</strong>'));
  assert.ok(leadManage.indexOf('<strong>Reports</strong>') < leadManage.indexOf('Schedule maintenance'));

  const maintenanceManage = tracker.slice(tracker.indexOf('{managedAsset ? ('));
  assert.ok(maintenanceManage.indexOf('WhatsApp owner') < maintenanceManage.indexOf('Call owner'));
  assert.ok(maintenanceManage.indexOf('Call owner') < maintenanceManage.indexOf('Email owner'));
  assert.ok(maintenanceManage.indexOf('Email owner') < maintenanceManage.indexOf('Schedule maintenance'));
  assert.ok(maintenanceManage.indexOf('Schedule maintenance') < maintenanceManage.indexOf('Maintenance reports'));
});

test('dealer tracker omits replacement pricing and owner-approved asset corrections', () => {
  assert.doesNotMatch(tracker, /DealerAssetCorrectionEditor/);
  assert.doesNotMatch(tracker, /assetReplacementPriceBubble/);
  assert.doesNotMatch(tracker, /Owner-approved updates/);
  assert.doesNotMatch(tracker, /Asset corrections/);
});

test('history supports text, record type and inclusive from/to date filters', () => {
  assert.match(tracker, /historyRecordTypeOptions/);
  assert.match(tracker, /From date/);
  assert.match(tracker, /To date/);
  assert.match(tracker, /if \(fromDate && key < fromDate\) return false/);
  assert.match(tracker, /if \(toDate && key > toDate\) return false/);
  assert.match(tracker, /\.sort\(\(left, right\) => timeValue\(right\.dateIso\) - timeValue\(left\.dateIso\)\)/);
});

test('dealer report modal uses the owner asset maintenance report endpoint', () => {
  assert.match(reportModal, /assetId: asset\.assetId/);
  assert.match(reportModal, /accessId: asset\.accessId/);
  assert.match(reportModal, /report: 'maintenance'/);
  assert.match(reportModal, /\/api\/asset-register\/scan-report/);
  assert.match(reportModal, /label="Type"/);
  assert.match(reportModal, /label="Year"/);
  assert.match(reportModal, /label="Month"/);
  assert.match(reportModal, /Choose export format/);
  assert.match(reportModal, /Open PDF report/);
  assert.match(reportModal, /Download Excel/);
  assert.match(reportModal, /\/brand\/pdf\.png/);
  assert.match(reportModal, /\/brand\/sheet\.png/);
});

test('owner report endpoint validates the exact active dealer share and asset', () => {
  assert.match(ownerReportRoute, /getDealerTrackedAsset\(session\.user\.id, dealerAccessId\)/);
  assert.match(ownerReportRoute, /trackedAsset\.assetId !== assetId/);
  assert.match(ownerReportRoute, /!trackedAsset\.permissions\.canViewMaintenanceReports/);
  assert.match(ownerReportRoute, /ownerUserId = trackedAsset\.ownerUserId/);
});

test('dealer Cost of Ownership report is permission-gated and locked to the shared asset owner', () => {
  assert.match(costReportModal, /accessId/);
  assert.match(costReportModal, /\/api\/my-invoices\/report/);
  assert.match(costReportModal, /Report timeline/);
  assert.match(costReportModal, /PDF report/);
  assert.match(costReportModal, /XLSX workbook/);
  assert.match(costReportRoute, /getDealerTrackedAsset\(workspace\.actorUserId, dealerAccessId\)/);
  assert.match(costReportRoute, /!trackedAsset\.permissions\.canViewCostOfOwnership/);
  assert.match(costReportRoute, /reportOwnerUserId = trackedAsset\.ownerUserId/);
  assert.match(costReportRoute, /filters\.assetId = trackedAsset\.assetId/);
  assert.match(leads, /Download cost of ownership/);
  assert.match(leads, /permissions\.canViewCostOfOwnership/);
  assert.match(costPermissionMigration, /ADD COLUMN IF NOT EXISTS can_view_cost_of_ownership/);
  assert.match(costPermissionMigration, /NOT NULL DEFAULT false/);
});

test('legacy dealer report data is restricted to the access row asset', () => {
  assert.match(
    trackerData,
    /assetId: context\.asset_register_item_id/,
  );
  assert.match(
    trackerData,
    /filters\.assetId !== context\.asset_register_item_id/,
  );
});

test('dealer tracking setup stays in sharing while active access is managed from the Owner App', () => {
  assert.match(assetRegister, /activeDealerTrackingByAssetId\[activeAsset\.id\] === true/);
  assert.match(assetRegister, /entries\.length > 0/);
  assert.match(ownerAppOptions, /onClick=\{openTrackingPermissions\}/);
  assert.match(ownerAppOptions, /setTrackMaintenance\(true\)/);
  assert.match(scanClient, /onClick=\{openShareTrackingPermissions\}/);
  assert.match(scanClient, /setShareTrackMaintenance\(true\)/);
  assert.doesNotMatch(ownerAppOptions, /ownerTrackingSettingsButton|openTrackingSettings/);
  assert.doesNotMatch(scanClient, /shareTrackingSettingsButton|openShareTrackingSettings/);
  assert.match(ownerAppDetail, /item\.id !== 'dealer-tracking' \|\| dealerTrackingAccess\.length > 0/);
  assert.match(ownerAppDetail, /mutationUrl="\/api\/dealer-maintenance-access"/);
  assert.match(ownerAppManageRoute, /'dealer-tracking'/);
});
