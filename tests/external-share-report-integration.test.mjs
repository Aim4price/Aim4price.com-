import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the normal Aim4price report modals attach back into the same outside-share draft', async () => {
  const client = await readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');

  assert.match(client, /type ExternalShareReportScope = 'asset' \| 'register' \| 'group' \| null/);
  assert.match(client, /const \[externalShareReportFiles, setExternalShareReportFiles\] = useState<ExternalShareFileSource\[]>\(\[\]\)/);
  assert.match(client, /function addExternalShareReport\(source: ExternalShareFileSource\)/);
  assert.match(client, /current\.some\(\(file\) => file\.id === source\.id\)/);
  assert.match(client, /function removeExternalShareReport\(reportId: string\)/);

  const registerHandoff = client.match(/function openRegisterShareReportsAndDocuments\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(registerHandoff, 'register report handoff should exist');
  assert.match(registerHandoff[1], /setExternalShareReportScope\(group \? 'group' : 'register'\)/);
  assert.doesNotMatch(registerHandoff[1], /closeRegisterShareModal/);

  const assetHandoff = client.match(/function openAssetShareReportsAndDocuments\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(assetHandoff, 'asset report handoff should exist');
  assert.match(assetHandoff[1], /setExternalShareReportScope\('asset'\)/);
  assert.doesNotMatch(assetHandoff[1], /closeAssetQuoteModal/);

  assert.equal((client.match(/reportFiles=\{externalShareReportFiles\}/g) ?? []).length, 2);
  assert.equal((client.match(/onAddAim4priceReport=\{/g) ?? []).length, 2);
  assert.equal((client.match(/onRemoveAim4priceReport=\{removeExternalShareReport\}/g) ?? []).length, 2);
  assert.match(client, /externalShareReportTriggerRef\.current = document\.activeElement/);
  assert.match(client, /window\.requestAnimationFrame\(\(\) => trigger\.focus\(\{ preventScroll: true \}\)\)/);
});

test('share-mode report completion produces real scoped files instead of opening or downloading them', async () => {
  const client = await readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');

  assert.match(client, /assetIds: string\[] = \[]/);
  assert.match(client, /params\.set\('assetIds', cleanedAssetIds\.join\(','\)\)/);
  assert.match(client, /externalShareReportScope === 'asset'[\s\S]*?buildAssetRegisterExportUrl\([\s\S]*?'pdf',[\s\S]*?\[asset\.id\]/);
  assert.match(client, /externalShareReportScope === 'register'[\s\S]*?reportAssets\.map\(\(asset\) => asset\.id\)/);
  assert.match(client, /if \(!reportAssets\.length\) \{[\s\S]*?No assets match the/);
  assert.match(client, /externalShareReportScope === 'group'[\s\S]*?group\.id,[\s\S]*?'pdf'/);
  assert.match(client, /externalShareReportScope === 'asset'[\s\S]*?buildAssetPdfReportUrl\(asset, reportKind, filters, 'xlsx'\)/);
  assert.match(client, /externalShareReportScope === 'group'[\s\S]*?format !== 'xlsx'/);
  assert.match(client, /contentType: format === 'pdf'[\s\S]*?'application\/pdf'/);
});

test('report pickers retain normal download wording outside share mode and hide document detours while attaching', async () => {
  const [client, groupModal] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /isAttachingExternalReport \? 'Add asset valuation' : 'Download asset valuation'/);
  assert.match(client, /!isAttachingExternalReport \? \([\s\S]*?<Link[\s\S]*?Saved documents/);
  assert.match(client, /isAttachingExternalReport \? 'Add Excel report' : assetReportDownloadFormat === 'pdf' \? 'Open PDF report' : 'Download Excel'/);
  assert.match(client, /reportDeliveryMode=\{externalShareReportScope === 'group' \? 'attach' : 'download'\}/);

  assert.match(groupModal, /reportDeliveryMode\?: 'download' \| 'attach'/);
  assert.match(groupModal, /setReportStep\(reportDeliveryMode === 'attach' \? 'filters' : 'format'\)/);
  assert.match(groupModal, /!isAttachingReport \? <a href="\/documents"/);
  assert.match(groupModal, /isAttachingReport \? 'Add Excel report' : reportFormat === 'pdf' \? 'Open PDF report' : 'Download Excel'/);
});
