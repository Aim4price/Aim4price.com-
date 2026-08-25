import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('outside sharing offers the canonical PDF and Excel route for every timeline report', async () => {
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
  assert.match(client, /assetId: asset\.id,[\s\S]*?report: reportKind,[\s\S]*?format,/);
  assert.match(client, /const reportUrl = buildAssetPdfReportUrl\(asset, 'maintenance', filters, 'pdf'\)/);
  assert.match(client, /const reportUrl = buildAssetOwnershipReportUrl\(asset, filters, format\)/);
  assert.doesNotMatch(client, /buildExternalSharePdfUrl|\/api\/reports\/share-pdf/);
  assert.doesNotMatch(client, /This report can currently be attached as an Excel file/);

  assert.match(groupModal, /setReportStep\('format'\)/);
  assert.match(groupModal, /reportFormat === 'pdf' \? 'Add PDF report' : 'Add Excel report'/);
  assert.doesNotMatch(groupModal, /setReportStep\(reportDeliveryMode === 'attach' \? 'filters'/);
});

test('polished valuations open in-browser and share from the same canonical HTML', async () => {
  const client = await readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');

  assert.match(client, /async function handlePrintAssetSheet[\s\S]*?const reportPayload: AssetSheetPayload[\s\S]*?const reportHtml = buildAssetSheetReportHtml\(reportPayload\)[\s\S]*?html: reportHtml[\s\S]*?addExternalShareReport\(reportSource\)[\s\S]*?writeCanonicalReportHtml\(reportWindow,[\s\S]*?reportHtml\)/);
  assert.match(client, /async function handleExportPdf\([\s\S]*?const reportPayload: AssetRegisterSummaryPayload[\s\S]*?const reportHtml = buildAssetRegisterSummaryReportHtml\(reportPayload\)[\s\S]*?html: reportHtml[\s\S]*?addExternalShareReport\(reportSource\)[\s\S]*?writeCanonicalReportHtml\(reportWindow,[\s\S]*?reportHtml\)/);
  assert.match(client, /async function handleDownloadAssetGroupPdf[\s\S]*?await handleExportPdf\([\s\S]*?'full',[\s\S]*?groupAssets,[\s\S]*?group\.name/);
  assert.match(client, /url: '\/api\/reports\/render-pdf'/);
  assert.match(client, /request: \{[\s\S]*?method: 'POST' as const/);
  assert.doesNotMatch(client, /preferSourceFileName:\s*true/);
});
