import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const tracker = read('components/DealerMaintenanceTrackerClient.tsx');
const styles = read('components/DealerMaintenanceTrackerClient.module.css');
const trackerData = read('lib/dealer-maintenance-tracker.ts');

test('maintenance tracker cards use explicit status colours in desktop and Dealer App modes', () => {
  assert.match(tracker, /if \(needsAttention\(status\)\) return styles\.trackerCardAttention/);
  assert.match(tracker, /status === 'done'\) return styles\.trackerCardDone/);
  assert.match(tracker, /return styles\.trackerCardUpcoming/);
  assert.match(tracker, /dealerAppMode \? styles\.dealerApp : styles\.dealerDesktop/);
  assert.match(styles, /\.trackerPage \.trackerCardAttention \{[\s\S]*?background-color: #ffe4e4[\s\S]*?#fff0f0/);
  assert.match(styles, /\.trackerPage \.trackerCardUpcoming \{[\s\S]*?background-color: #ffedcc[\s\S]*?#fff4df/);
  assert.match(styles, /\.trackerPage \.trackerCardDone \{[\s\S]*?background-color: #e5f5ec[\s\S]*?#edf9f2/);
  assert.match(styles, /background-size: 100% 100% !important/);
  assert.match(styles, /print-color-adjust: exact/);
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


test('due maintenance stays in attention and saved completions move assets to Done', () => {
  assert.match(tracker, /\['overdue', 'due', 'due_soon', 'usage_needed'\]/);
  assert.match(tracker, /type TrackerStatusFilter = 'all' \| 'attention' \| 'upcoming' \| 'done'/);
  assert.match(tracker, /statusFilter === 'done' && asset\.status !== 'done'/);
  assert.match(tracker, /const doneCount = assets\.filter\(\(asset\) => asset\.status === 'done'\)\.length/);
  assert.match(tracker, />Done<\/span>/);
  assert.doesNotMatch(tracker, /dealerAppMode \? 'Due' : 'Nothing due'/);
  assert.match(trackerData, /\| 'done'/);
  assert.match(trackerData, /function trackerNeedsAttention/);
  assert.match(trackerData, /trackerNeedsAttention\(nextStatus\)[\s\S]*completedRecords\.length[\s\S]*\? 'done'/);
  assert.match(trackerData, /status === 'done'\) return 'Done'/);
});
