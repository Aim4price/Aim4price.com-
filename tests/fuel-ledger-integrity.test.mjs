import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ledger = read('lib/fuel-ledger.ts');
const migration = read('database/migrations/76-fuel-ledger-exclusions-and-audit.sql');
const fuelClient = read('app/fuel/fuel-client.tsx');
const fuelStyles = read('app/fuel/page.module.css');
const report = read('app/api/fuel/report/route.ts');
const exclusionRoute = read('app/api/fuel/exclusions/[assetId]/route.ts');
const slipRoute = read('app/api/fuel/slips/[slipId]/route.ts');
const storageRoute = read('app/api/fuel/storage/[storageId]/route.ts');
const petrolStationClient = read('app/owner-app/operations/fuel/petrol-station/petrol-station-fuel-client.tsx');
const fuelScanClient = read('app/fuel-scan/[publicFuelStorageCode]/fuel-scan-client.tsx');

test('asset exclusion is additive and propagated to existing and future ledger records', () => {
  assert.match(migration, /create table if not exists public\.fuel_asset_exclusions/);
  assert.match(migration, /work_use_excluded boolean not null default false/);
  assert.match(ledger, /update public\.fuel_storage_events\s+set work_use_excluded/);
  assert.match(ledger, /update public\.fuel_slips\s+set work_use_excluded/);
  assert.match(ledger, /getFuelAssetWorkUseExclusion\(client, input\.userId, input\.assetId\)/);
  assert.match(ledger, /workUseExcluded: assetWorkUse\.excluded/);
  assert.match(exclusionRoute, /assertWorkspaceAssetAccess\(workspace, assetId\)/);
});

test('fuel exclusions stay manageable on desktop but are hidden from operational app pickers', () => {
  assert.match(fuelClient, /Choose Saved Assets/);
  assert.match(petrolStationClient, /asset\.canReceiveFuel && !asset\.workUseExcluded/);
  assert.match(fuelScanClient, /isAuthenticatedAppMode \? assets\.filter\(\(asset\) => !asset\.workUseExcluded\) : assets/);
  assert.match(fuelScanClient, /if \(!query\) return appVisibleAssets/);
});

test('fuel exclusions support multi-select review without an included status pill', () => {
  assert.match(fuelClient, /selectedExclusionAssetIds/);
  assert.match(fuelClient, /toggleExclusionAsset/);
  assert.match(fuelClient, /for \(const asset of selectedExclusionAssets\)/);
  assert.match(fuelClient, /data-asset-choice-selected=\{isSelected \? 'true' : undefined\}/);
  assert.match(fuelClient, /Review exclusions \(\$\{selectedExclusionAssets\.length\}\)/);
  assert.doesNotMatch(fuelClient, /asset\.workUseExcluded \? 'Excluded' : 'Included'/);
});

test('bulk exclusion selection stays status-safe and excluded assets can be included again', () => {
  assert.match(fuelClient, /function toggleAllVisibleExclusionAssets\(\)/);
  assert.match(fuelClient, /asset\.workUseExcluded === targetStatus/);
  assert.match(fuelClient, /Select all shown/);
  assert.match(fuelClient, /Review inclusions/);
  assert.match(fuelClient, /const excluded = exclusionSelectionAction === 'exclude'/);
  assert.match(fuelClient, /body: JSON\.stringify\(\{ excluded, reason:/);
  assert.match(fuelClient, /Include these assets in work-use totals again/);
});

test('fuel exclusion modal keeps its primary review action green', () => {
  const modalTheme = fuelStyles.slice(
    fuelStyles.indexOf('.fuelSlipFlowBackdrop {'),
    fuelStyles.indexOf('.fuelSlipFlowBackdrop .assetModal'),
  );
  assert.match(modalTheme, /--action-primary: #197454/);
  assert.match(modalTheme, /--action-primary-deep: #0f5840/);
  assert.match(modalTheme, /--action-primary-hover: #0b4b37/);
  assert.match(modalTheme, /--action-primary-border: #0f6248/);
});

test('exclusions never alter physical tank movement', () => {
  const exclusionFunction = ledger.slice(
    ledger.indexOf('export async function setFuelAssetWorkUseExclusion'),
    ledger.indexOf('export async function listFuelLedgerAuditEvents'),
  );
  assert.doesNotMatch(exclusionFunction, /current_litres\s*=/);
  assert.doesNotMatch(exclusionFunction, /delete from public\.fuel_storage_events/);
  assert.match(fuelClient, /Fuel movement and tank balances will stay unchanged/);
});

test('fuel slips are voided and storage units are archived instead of hard deleted', () => {
  assert.match(ledger, /export async function voidFuelSlipTransaction/);
  assert.match(ledger, /record_status = 'voided'/);
  assert.doesNotMatch(slipRoute, /deleteFuelSlipTransaction/);
  assert.match(slipRoute, /voidFuelSlipTransaction/);
  assert.match(ledger, /export async function archiveFuelStorage/);
  assert.doesNotMatch(storageRoute, /deleteFuelStorage/);
  assert.match(storageRoute, /archiveFuelStorage/);
  assert.doesNotMatch(ledger, /delete from public\.fuel_storage_units/);
});

test('accountant corrections and exclusions write actor-attributed audit history', () => {
  assert.match(migration, /create table if not exists public\.fuel_ledger_audit_events/);
  assert.match(ledger, /action: existingSlip \? 'updated' : 'created'/);
  assert.match(ledger, /action: 'voided'/);
  assert.match(ledger, /action: 'exclusion_changed'/);
  assert.match(slipRoute, /workspace\.actorName/);
  assert.match(exclusionRoute, /workspace\.actorName/);
  assert.match(fuelClient, /Change History/);
});

test('reports separate physical issue totals from work-use and excluded totals', () => {
  assert.match(report, /totalWorkUseIssued/);
  assert.match(report, /totalExcludedIssued/);
  assert.match(report, /event\.eventType === 'asset_issue' && !event\.workUseExcluded/);
  assert.match(report, /event\.eventType === 'asset_issue' && event\.workUseExcluded/);
  assert.match(report, /Work-use Status/);
  assert.match(report, /not, by itself, a tax determination/);
});

test('supporting fuel proof remains optional at the petrol-station flow', () => {
  assert.doesNotMatch(petrolStationClient, /step === 'slip' && !receipt/);
  assert.match(petrolStationClient, /mode: upload \? 'automatic' : 'manual'/);
  assert.match(petrolStationClient, /Add fuel slip photo \(optional\)/);
  assert.match(petrolStationClient, /kept separately by your accountant/);
});
