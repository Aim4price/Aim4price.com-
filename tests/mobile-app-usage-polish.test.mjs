import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  scanAssets,
  fuelLedger,
  fuelClient,
  fuelStyles,
  fieldStyles,
  ownerStyles,
  maintenanceClient,
  dealerMaintenanceModal,
  dealerMaintenanceStyles,
] = await Promise.all([
  read('lib/scan-assets.ts'),
  read('lib/fuel-ledger.ts'),
  read('app/fuel-scan/[publicFuelStorageCode]/fuel-scan-client.tsx'),
  read('app/fuel-scan/[publicFuelStorageCode]/page.module.css'),
  read('app/field-manager/page.module.css'),
  read('app/owner-app/owner-app.module.css'),
  read('app/field-manager/assets/[publicAssetCode]/maintenance/field-manager-maintenance-client.tsx'),
  read('components/DealerMaintenanceScheduleModal.tsx'),
  read('app/maintenance/page.module.css'),
]);

test('maintenance scan usage follows the Asset Register usage resolver', () => {
  assert.match(scanAssets, /import \{ resolveAssetUsage \} from "\.\/asset-usage"/);
  assert.match(scanAssets, /specs\.usageBasis/);
  assert.match(scanAssets, /specs\.selectedUsageMode/);
  assert.match(scanAssets, /resolvedUsage\.metric === "not_applicable"/);
  assert.match(scanAssets, /resolvedUsage\.metric === "percentage"/);
});

test('fuel only updates a meter reading for meter-based assets', () => {
  assert.match(fuelLedger, /import \{ resolveAssetUsage \} from '\.\/asset-usage'/);
  assert.match(fuelLedger, /resolvedUsage\.metric === 'not_applicable'.*return 'none'/);
  assert.match(fuelLedger, /resolvedUsage\.metric === 'percentage'.*return 'percentage'/);
  assert.match(fuelClient, /function assetHasMeter/);
  assert.match(fuelClient, /assetUsageReading: !assetHasMeter\(selectedAsset\) \|\| usageNotApplicable \? null/);
  assert.match(fuelClient, /Saved in Asset Register/);
  assert.match(fuelClient, /selectedAsset \? assetUsageText\(selectedAsset\)/);
  assert.match(fuelClient, /No meter update needed/);
  assert.doesNotMatch(fuelClient, /New hours \/ km reading/);
});

test('mobile cards retain comfortable gutters and touch targets', () => {
  assert.match(fieldStyles, /--field-page-gutter: 28px/);
  assert.match(fieldStyles, /\.assetMetaGridVertical > div:last-child/);
  assert.match(ownerStyles, /--owner-page-gutter: 28px/);
  assert.match(ownerStyles, /\.managerAssetMetaGrid > div:last-child/);
  assert.match(fuelStyles, /\.usageSourceNote/);
  assert.match(fuelStyles, /env\(safe-area-inset-bottom\)/);
});

test('active maintenance schedule uses a compact next-due summary', () => {
  assert.match(maintenanceClient, /styles\.maintenanceActiveCard/);
  assert.match(maintenanceClient, /<span>Next due<\/span>/);
  assert.match(maintenanceClient, /upcomingMaintenance\.title\?\.trim\(\)/);
  assert.match(fieldStyles, /\.maintenanceActiveCard/);
  assert.match(fieldStyles, /\.maintenanceNextDue/);
});

test('dealer scheduling uses the same focused mobile modal treatment', () => {
  assert.match(
    dealerMaintenanceModal,
    /className=\{\`\$\{styles\.formModal\} \$\{styles\.maintenanceStepModal\}\`\}/,
  );
  assert.match(dealerMaintenanceStyles, /Dealer scheduling: compact, thumb-friendly phone flow/);
  assert.match(dealerMaintenanceStyles, /\.maintenanceStepModal \.maintenanceChoiceCard/);
  assert.match(dealerMaintenanceStyles, /grid-template-columns: 3\.15rem minmax\(0, 1fr\)/);
  assert.match(dealerMaintenanceStyles, /\.maintenanceStepModal \.modalFooter \.primaryButton/);
});
