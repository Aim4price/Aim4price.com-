import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const tracker = read('components/DealerMaintenanceTrackerClient.tsx');
const styles = read('components/DealerMaintenanceTrackerClient.module.css');

test('maintenance tracker cards use explicit status colours in desktop and Dealer App modes', () => {
  assert.match(tracker, /if \(needsAttention\(status\)\) return styles\.trackerCardAttention/);
  assert.match(tracker, /status === 'no_open'\) return styles\.trackerCardClear/);
  assert.match(tracker, /return styles\.trackerCardUpcoming/);
  assert.match(tracker, /dealerAppMode \? styles\.dealerApp : styles\.dealerDesktop/);
  assert.match(styles, /\.trackerPage \.trackerCardAttention \{[\s\S]*?#ffeaea/);
  assert.match(styles, /\.trackerPage \.trackerCardUpcoming \{[\s\S]*?#fff0d4/);
  assert.match(styles, /\.trackerPage \.trackerCardClear \{[\s\S]*?#e6f5ed/);
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
