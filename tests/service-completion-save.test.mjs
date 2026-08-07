import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const modal = read('components/DesktopServiceModal.tsx');
const maintenance = read('lib/asset-maintenance.ts');

test('service completion can be saved when an asset has no captured usage', () => {
  assert.doesNotMatch(
    modal,
    /final \$\{unit\} reading for this usage-based maintenance/,
  );
  assert.match(modal, /Current \$\{unit\} \(optional\)/);
  assert.doesNotMatch(
    maintenance,
    /throw new Error\('COMPLETION_USAGE_REQUIRED'\)/,
  );
  assert.match(
    maintenance,
    /completedUsage = existing\.triggerType === 'usage'[\s\S]*?existing\.currentUsage/,
  );
});

test('all open maintenance statuses can reach the shared completion update', () => {
  assert.match(
    maintenance,
    /lower\(trim\(coalesce\(status, 'upcoming'\)\)\) not in \('done', 'cancelled', 'canceled'\)/,
  );
  assert.match(maintenance, /export async function completeAssetMaintenanceRecord/);
});
