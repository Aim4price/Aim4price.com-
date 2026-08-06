import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Owner operations centers the simplified Maintenance and Fuel launcher', async () => {
  const [operations, styles] = await Promise.all([
    source('app/owner-app/operations/page.tsx'),
    source('app/owner-app/owner-app.module.css'),
  ]);

  assert.doesNotMatch(operations, /Choose option/);
  assert.match(operations, /styles\.operationsLandingContent/);
  assert.match(operations, /styles\.operationsLandingLauncher/);
  assert.match(operations, /styles\.operationChoiceCard/);
  assert.match(styles, /\.operationsLandingContent,[\s\S]*?align-content: center/);
  assert.match(styles, /\.operationChoiceCard/);
});

test('Fuel first asks for storage tank or petrol station', async () => {
  const choice = await source('app/owner-app/operations/fuel/page.tsx');

  assert.doesNotMatch(choice, /Choose fuel source|Where is the fuel coming from/);
  assert.doesNotMatch(choice, /Use fuel held|Record the fill, cost/);
  assert.match(choice, /styles\.fuelSourceContent/);
  assert.match(choice, /styles\.fuelSourceLauncher/);
  assert.match(choice, /href="\/owner-app\/operations\/fuel\/storage"/);
  assert.match(choice, />Storage tank</);
  assert.match(choice, /href="\/owner-app\/operations\/fuel\/petrol-station"/);
  assert.match(choice, />Petrol station</);
});

test('Storage tank choice opens the Owner App storage tool', async () => {
  const storage = await source('app/owner-app/operations/fuel/storage/page.tsx');

  assert.match(storage, /FieldManagerDieselClient ownerAppMode/);
});

test('Petrol station flow captures GPS, fuel details and a receipt-backed cost', async () => {
  const [page, client, locationModal] = await Promise.all([
    source('app/owner-app/operations/fuel/petrol-station/page.tsx'),
    source('app/owner-app/operations/fuel/petrol-station/petrol-station-fuel-client.tsx'),
    source('components/FuelLocationModal.tsx'),
  ]);

  assert.match(page, /ownerAppCan\(access, 'operate'\)/);
  assert.match(page, /operatorName=\{access\.displayName\}/);
  assert.match(client, /\['diesel', 'petrol'\]/);
  assert.match(client, /capture="environment"/);
  assert.match(client, /fetch\('\/api\/fuel\/slips\/upload'/);
  assert.match(client, /fetch\('\/api\/fuel\/slips'/);
  assert.match(client, /mode: 'automatic'/);
  assert.match(client, /targetType: 'asset'/);
  assert.match(client, /latitude: coordinates\.latitude/);
  assert.match(client, /gpsAccuracyMeters: coordinates\.accuracyMeters/);
  assert.match(locationModal, />Location required</);
  assert.match(locationModal, /enableHighAccuracy: true/);
  assert.match(locationModal, /maximumAge: 0/);
});

test('Fuel slip persistence links the photo cost and GPS event to the asset', async () => {
  const [ledger, uploadRoute] = await Promise.all([
    source('lib/fuel-ledger.ts'),
    source('app/api/fuel/slips/upload/route.ts'),
  ]);

  assert.match(ledger, /source,\s+raw_extracted_text[\s\S]*'fuel_slip'/);
  assert.match(ledger, /insert into public\.asset_invoices/);
  assert.match(ledger, /insert into public\.asset_invoice_blocks/);
  assert.match(ledger, /latitude,\s+longitude,\s+location_text,\s+client_captured_at,\s+gps_accuracy_meters/);
  assert.match(ledger, /lastFuelSlipLocationText: locationText/);
  assert.match(uploadRoute, /resolved\.context\.ownerUserId/);
  assert.match(uploadRoute, /ALLOWED_ASSET_REGISTER_IMAGE_TYPES/);
});

test('Storage-tank fuelling uses the standard blocking location modal', async () => {
  const fuelScan = await source('app/fuel-scan/[publicFuelStorageCode]/fuel-scan-client.tsx');

  assert.match(fuelScan, /import FuelLocationModal/);
  assert.match(fuelScan, /!isLoading && \(preview \|\| storage\) && !coordinates/);
  assert.match(fuelScan, /subject=\{visibleStorageName\}/);
  assert.match(fuelScan, /owner-app\/operations\/fuel\/storage/);
});
