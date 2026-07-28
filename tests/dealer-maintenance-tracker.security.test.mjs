import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const tracker = read('components/DealerMaintenanceTrackerClient.tsx');
const trackerData = read('lib/dealer-maintenance-tracker.ts');
const reportModal = read('components/DealerMaintenanceReportModal.tsx');
const ownerReportRoute = read('app/api/asset-register/scan-report/route.ts');
const assetRegister = read('app/asset-register/asset-register-client.tsx');
const ownerAppOptions = read('app/owner-app/assets/[assetId]/owner-asset-options-client.tsx');

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
  const problemsIndex = tracker.indexOf('<h3>Active problems and notes</h3>');
  const historyConditionalIndex = tracker.indexOf('{isMaintenanceOpen ? (');
  assert.ok(upcomingIndex > 0);
  assert.ok(problemsIndex > upcomingIndex);
  assert.ok(historyConditionalIndex > problemsIndex);
  assert.match(tracker, /<details className=\{styles\.section\}>/);
  assert.match(tracker, /<summary>/);
  assert.match(tracker, /View maintenance history/);
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
  assert.match(reportModal, /Download PDF/);
  assert.match(reportModal, /Download Excel/);
});

test('owner report endpoint validates the exact active dealer share and asset', () => {
  assert.match(ownerReportRoute, /getDealerTrackedAsset\(session\.user\.id, dealerAccessId\)/);
  assert.match(ownerReportRoute, /trackedAsset\.assetId !== assetId/);
  assert.match(ownerReportRoute, /!trackedAsset\.permissions\.canViewMaintenanceReports/);
  assert.match(ownerReportRoute, /ownerUserId = trackedAsset\.ownerUserId/);
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

test('owner tracking settings are visible only for database-confirmed active shares', () => {
  assert.match(assetRegister, /activeDealerTrackingByAssetId\[activeAsset\.id\] === true/);
  assert.match(assetRegister, /entries\.length > 0/);
  assert.match(ownerAppOptions, /assetKind !== 'property' && hasActiveTracking/);
  assert.match(ownerAppOptions, /setHasActiveTracking\(entries\.length > 0\)/);
});
