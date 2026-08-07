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
  assert.match(eventRoute, /else if \(scheduledMaintenance\) \{/);
  assert.match(eventRoute, /completeAssetMaintenanceRecord\(/);
});

test('normal Owner and Field Manager maintenance never submits a null schedule id', () => {
  assert.match(
    scanClient,
    /function normalizeOptionalMaintenanceId[\s\S]*String\(value \?\? ""\)[\s\S]*\? "" : normalized/,
  );
  assert.match(
    scanClient,
    /normalizedScheduledMaintenanceId = useMemo\([\s\S]*normalizeOptionalMaintenanceId\(/,
  );
  assert.match(
    eventRoute,
    /scheduledMaintenanceId = normalizeOptionalMaintenanceId\([\s\S]*body\.scheduledMaintenanceId/,
  );
});

test('normal maintenance without a schedule creates a completed history record', () => {
  assert.match(
    eventRoute,
    /else if \(procedureKind\)[\s\S]*recordStandaloneAssetMaintenanceCompletion\(/,
  );
  assert.match(
    maintenance,
    /recordStandaloneAssetMaintenanceCompletion[\s\S]*insert into public\.asset_maintenance_records[\s\S]*'done'/,
  );
  assert.match(
    maintenance,
    /source_scan_event_id[\s\S]*on conflict do nothing/,
  );
});

test('normal and scheduled maintenance retries are idempotent', () => {
  assert.match(
    maintenance,
    /create unique index if not exists asset_maintenance_records_source_scan_event_idx/,
  );
  assert.match(
    eventRoute,
    /getAssetMaintenanceRecordBySourceScanEventId\([\s\S]*saved\.event\.id/,
  );
  assert.match(
    eventRoute,
    /sourceScanEventId: saved\.event\.id/,
  );
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

test('successful app maintenance returns to the clean asset action page', () => {
  assert.match(
    scanClient,
    /ownerAssetActionsHref[\s\S]*owner-app\/operations\/maintenance/,
  );
  assert.match(
    scanClient,
    /fieldManagerAssetActionsHref[\s\S]*field-manager\/assets/,
  );
  assert.match(
    scanClient,
    /setDoneMessage\(\`\$\{message\} Returning to asset actions…\`\)/,
  );
  assert.match(scanClient, /window\.location\.replace\(assetActionsHref\)/);
  assert.match(scanClient, /href=\{assetActionsHref\}[\s\S]*Back to asset/);

  const successFlow = scanClient.slice(
    scanClient.indexOf('async function redirectAfterFieldManagerServerSave'),
    scanClient.indexOf('async function loadUnlockedAsset'),
  );
  assert.doesNotMatch(successFlow, /clearQrScanSession/);
});

test('Add update saves immediately in Owner and Field Manager maintenance mode', () => {
  assert.match(
    scanClient,
    /if \(isFieldManagerMode\) \{[\s\S]*persistPendingScanUpdate\([\s\S]*nextPendingUpdate,[\s\S]*maintenanceChoice,[\s\S]*\)[\s\S]*redirectAfterFieldManagerServerSave/,
  );
  assert.match(
    scanClient,
    /updateToPersist\.hasService[\s\S]*!data\.scheduledMaintenanceCompletion\?\.completed/,
  );
});
