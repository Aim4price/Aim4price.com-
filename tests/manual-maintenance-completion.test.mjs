import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const eventRoute = read('app/api/scan/assets/[publicAssetCode]/event/route.ts');
const maintenance = read('lib/asset-maintenance.ts');
const scanClient = read('app/scan/[publicAssetCode]/scan-client.tsx');

test('manual Owner and Field Manager service matches the nearest open maintenance for the asset', () => {
  assert.match(
    eventRoute,
    /!scheduledMaintenanceId[\s\S]*procedureKind[\s\S]*access\.accessMode === "field_manager"[\s\S]*access\.accessMode === "owner_session"/,
  );
  assert.match(
    eventRoute,
    /listAssetMaintenanceRecords\([\s\S]*assetId: access\.asset\.id[\s\S]*type: maintenanceType[\s\S]*status: "upcoming"/,
  );
  assert.match(
    eventRoute,
    /scheduledMaintenance = openMaintenance\.find\([\s\S]*record\.status === "upcoming"/,
  );
  assert.match(eventRoute, /if \(scheduledMaintenance\) \{/);
  assert.match(eventRoute, /completeAssetMaintenanceRecord\(/);
});

test('service and repair entries complete service schedules while checks complete checkups', () => {
  assert.match(
    maintenance,
    /maintenanceType === 'checkup'[\s\S]*procedureKind === 'checked'[\s\S]*procedureKind === 'serviced' \|\| procedureKind === 'repaired'/,
  );
  assert.match(
    eventRoute,
    /const maintenanceType = procedureKind === "checked" \? "checkup" : "service"/,
  );
});

test('early recurring maintenance advances from actual completion usage', () => {
  assert.match(
    maintenance,
    /const baseUsage = completedRecord\.completedUsage[\s\S]*\?\? completedRecord\.currentUsage[\s\S]*\?\? completedRecord\.dueUsage/,
  );
  assert.doesNotMatch(
    maintenance,
    /Math\.max\(completionUsage, completedRecord\.dueUsage/,
  );
  assert.match(
    maintenance,
    /nextDueUsage = Math\.round\(\(baseUsage \+ completedRecord\.recurringIntervalValue\)/,
  );
});

test('Add update saves immediately in Owner and Field Manager maintenance mode', () => {
  assert.match(
    scanClient,
    /if \(isFieldManagerMode\) \{[\s\S]*persistPendingScanUpdate\(nextPendingUpdate\)[\s\S]*redirectAfterFieldManagerServerSave/,
  );
});
