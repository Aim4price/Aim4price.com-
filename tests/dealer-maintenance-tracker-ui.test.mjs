import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const tracker = read('components/DealerMaintenanceTrackerClient.tsx');
const styles = read('components/DealerMaintenanceTrackerClient.module.css');
const trackerData = read('lib/dealer-maintenance-tracker.ts');
const assetMaintenance = read('lib/asset-maintenance.ts');

test('maintenance tracker cards use explicit status colours in desktop and Dealer App modes', () => {
  assert.ok(tracker.includes("return `${leadStyles.leadThreadNew} ${styles.trackerCardAttention}`"));
  assert.ok(tracker.includes("return `${leadStyles.leadThreadDone} ${styles.trackerCardDone}`"));
  assert.ok(tracker.includes("return `${leadStyles.leadThreadActive} ${styles.trackerCardUpcoming}`"));
  assert.match(tracker, /dealerAppMode \? styles\.dealerApp : styles\.dealerDesktop/);
  assert.match(styles, /\.trackerPage\.trackerPage \.trackerCardAttention \{[\s\S]*?background-color: #ffe8e8[\s\S]*?#fff7f7/);
  assert.match(styles, /\.trackerPage\.trackerPage \.trackerCardUpcoming \{[\s\S]*?background-color: #ffedcc[\s\S]*?#fffaf2/);
  assert.match(styles, /\.trackerPage\.trackerPage \.trackerCardDone \{[\s\S]*?background-color: #e5f5ec[\s\S]*?#f7fcf9/);
  assert.match(styles, /background-size: 100% 100% !important/);
  assert.match(styles, /print-color-adjust: exact/);
});

test('due maintenance stays in attention and saved completions move assets to Done', () => {
  assert.match(tracker, /\['overdue', 'due', 'due_soon', 'usage_needed'\]/);
  assert.match(tracker, /type TrackerStatusFilter = 'all' \| 'attention' \| 'upcoming' \| 'done'/);
  assert.match(tracker, /statusFilter === 'done' && asset\.status !== 'done'/);
  assert.match(tracker, /const doneCount = maintenanceCards\.filter\(\(asset\) => asset\.status === 'done'\)\.length/);
  assert.match(tracker, />Done<\/span>/);
  assert.doesNotMatch(tracker, /dealerAppMode \? 'Due' : 'Nothing due'/);
  assert.match(trackerData, /\| 'done'/);
  assert.match(trackerData, /const status: DealerMaintenanceTrackerStatus = next[\s\S]*?\? nextStatus[\s\S]*?completedRecords\.length[\s\S]*?\? 'done'/);
  assert.match(trackerData, /status === 'done'\) return 'Done'/);
});

test('recurring completion keeps a Done card and a separate live replacement card', () => {
  assert.match(tracker, /type TrackerMaintenanceCard = DealerMaintenanceTrackedAsset/);
  assert.match(tracker, /function buildTrackerMaintenanceCards\(/);
  assert.match(tracker, /trackerCardKind: 'active'/);
  assert.match(tracker, /trackerCardId: `\$\{asset\.accessId\}:active:\$\{asset\.nextMaintenance\?\.id \|\| 'tracking'\}`/);
  assert.match(tracker, /filter\(\(record\) => record\.recurringEnabled\)/);
  assert.match(tracker, /trackerCardId: `\$\{asset\.accessId\}:done:\$\{record\.id\}`/);
  assert.match(tracker, /trackerCardKind: 'done'/);
  assert.match(tracker, /loggedProblems: asset\.loggedProblems\.filter\(\(problem\) => Boolean\(problem\.notedAtIso\)\)/);
  assert.match(tracker, /const maintenanceCards = useMemo\([\s\S]*?flatMap\(buildTrackerMaintenanceCards\)/);
  assert.match(tracker, /key=\{asset\.trackerCardId\}/);
  assert.match(tracker, /isCompletedCard \? 'Completed maintenance' : 'What needs attention\?'/);
  assert.match(assetMaintenance, /createNextRecurringRecord\([\s\S]*?completedRecord\.notes,[\s\S]*?completedRecord\.id/);
  assert.match(assetMaintenance, /generated_from_maintenance_id/);
});

test('maintenance tracker proximity filters support days, hours and kilometres', () => {
  assert.match(tracker, /function assetMatchesProximityFilters\(/);
  assert.match(tracker, /asset\.openMaintenanceRecords\.some/);
  assert.match(tracker, /record\.triggerType === 'date'/);
  assert.match(tracker, /metric === 'hours'/);
  assert.match(tracker, /metric === 'km'/);
  assert.match(tracker, /remainingDays <= dayLimit/);
  assert.match(tracker, /record\.remainingUsage <= hourLimit/);
  assert.match(tracker, /record\.remainingUsage <= kilometreLimit/);
  assert.match(tracker, /aria-label="Due within days"/);
  assert.match(tracker, /aria-label="Due within hours"/);
  assert.match(tracker, /aria-label="Due within kilometres"/);
  assert.match(tracker, /Overdue maintenance remains included/);
});

test('proximity filters participate in apply, clear and active-filter states', () => {
  assert.match(tracker, /setProximityFilters\(\{ \.\.\.draftProximityFilters \}\)/);
  assert.match(tracker, /setProximityFilters\(\{ \.\.\.EMPTY_PROXIMITY_FILTERS \}\)/);
  assert.match(tracker, /hasActiveFilter = ownerFilter !== 'all' \|\| statusFilter !== 'all' \|\| hasActiveProximityFilter/);
  assert.match(tracker, /assetMatchesProximityFilters\(asset, proximityFilters\)/);
  assert.match(styles, /\.dealerApp \.trackerFilterForm\.trackerFilterForm \{[\s\S]*?overflow-y: auto/);
});
