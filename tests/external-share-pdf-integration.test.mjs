import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('outside sharing offers PDF and Excel for every timeline report', async () => {
  const [client, groupModal] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /setAssetReportStep\('fuel-format'\)/);
  assert.match(client, /setAssetReportStep\('maintenance-format'\)/);
  assert.match(client, /setAssetReportStep\('depreciation-format'\)/);
  assert.match(client, /setAssetReportStep\('ownership-format'\)/);
  assert.match(client, /assetReportDownloadFormat === 'pdf' \? 'Add PDF report' : 'Add Excel report'/);
  assert.match(client, /deliveryMode=\{isAttachingExternalReport \? 'attach' : 'download'\}/);
  assert.match(client, /buildExternalSharePdfUrl\('scan'/);
  assert.match(client, /buildExternalSharePdfUrl\('ownership'/);
  assert.match(client, /reportKind === 'ownership' \? 'ownership' : reportKind === 'maintenance' \? 'maintenance' : 'scan'/);
  assert.doesNotMatch(client, /This report can currently be attached as an Excel file/);

  assert.match(groupModal, /setReportStep\('format'\)/);
  assert.match(groupModal, /reportFormat === 'pdf' \? 'Add PDF report' : 'Add Excel report'/);
  assert.doesNotMatch(groupModal, /setReportStep\(reportDeliveryMode === 'attach' \? 'filters'/);
});

test('the share PDF adapter reuses normal report routes and emits binary PDFs', async () => {
  const route = await readFile(new URL('../app/api/reports/share-pdf/route.ts', import.meta.url), 'utf8');

  assert.match(route, /getScanReport/);
  assert.match(route, /getMaintenanceReport/);
  assert.match(route, /getOwnershipReport/);
  assert.match(route, /getRegisterExport/);
  assert.match(route, /buildBrandedReportPdfFromHtml/);
  assert.match(route, /'Content-Type': 'application\/pdf'/);
  assert.match(route, /'Content-Disposition': `attachment;/);
  assert.match(route, /ownerAppCanAccessAsset\(access, assetId\)/);
  assert.match(route, /groupId \|\| !assetId/);
  assert.match(route, /error: 'Report not found\.'/);
});
