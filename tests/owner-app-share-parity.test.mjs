import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ownerOptionsUrl = new URL('../app/owner-app/assets/[assetId]/owner-asset-options-client.tsx', import.meta.url);
const ownerDetailUrl = new URL('../app/owner-app/assets/[assetId]/owner-asset-detail-client.tsx', import.meta.url);
const ownerReportsUrl = new URL('../app/owner-app/assets/[assetId]/owner-asset-report-picker.tsx', import.meta.url);

test('Owner App Share reuses the Inside or Outside chooser and the simplified external share flow', async () => {
  const [options, detail, reportPicker] = await Promise.all([
    readFile(ownerOptionsUrl, 'utf8'),
    readFile(ownerDetailUrl, 'utf8'),
    readFile(ownerReportsUrl, 'utf8'),
  ]);

  assert.match(options, /AssetShareDestinationPicker/);
  assert.match(options, /AssetExternalShare/);
  assert.match(options, /useState<OptionsStage>\('destination'\)/);
  assert.match(options, /onInside=\{\(\) => returnToStage\('inside'\)\}/);
  assert.match(options, /onOutside=\{\(\) => returnToStage\('outside'\)\}/);
  assert.match(options, /stage === 'outside'[\s\S]*?<AssetExternalShare/);
  assert.match(options, /onAddAim4priceReport=/);
  assert.match(options, /onRemoveAim4priceReport=/);
  assert.doesNotMatch(options, /navigator\.share|wa\.me|api\.whatsapp\.com/);

  assert.match(detail, /serialNumber: draft\.serialNumber/);
  assert.match(detail, /yearModel: draft\.yearModel/);
  assert.match(detail, /usage: usageText/);
  assert.match(detail, /condition: conditionLabel\(draft\.condition\)/);
  assert.match(detail, /replacementPriceExVat: draft\.replacementPriceExVat/);
  assert.match(detail, /valueExVat: draft\.value/);
  assert.match(detail, /photoUrls: draft\.photos/);
  assert.match(detail, /reportAsset=\{draft\}/);

  assert.match(detail, /section === 'reports' \? <OwnerAssetReportPicker/);
  assert.match(options, /<OwnerAssetReportPicker[\s\S]*?mode="attach"/);
  assert.match(reportPicker, /mode\?: 'open' \| 'attach'/);
  assert.doesNotMatch(reportPicker, /Documents|Add any file|type="file"/i);
});

test('Owner App report attachments are real PDFs, support repeated additions, and retain the selected asset scope', async () => {
  const [options, picker] = await Promise.all([
    readFile(ownerOptionsUrl, 'utf8'),
    readFile(ownerReportsUrl, 'utf8'),
  ]);

  assert.match(options, /setReportFiles\(\(current\) => current\.some\(\(report\) => report\.id === source\.id\)/);
  assert.match(picker, /source: report === 'valuation' \? 'valuation' : report === 'ownership' \? 'ownership' : 'scan'/);
  assert.match(picker, /params\.set\('registerId', asset\.registerId\)/);
  assert.match(picker, /params\.set\('report', report\)/);
  assert.match(picker, /contentType: 'application\/pdf'/);
  assert.match(picker, /fileName,[\s\S]*?url,[\s\S]*?credentials: 'include'/);
  assert.match(picker, />Add PDF<\/button>/);
  assert.doesNotMatch(picker, /\.xlsx|Add Excel|format.*xlsx/i);
});

test('Owner App report attachments name each selected period and maintenance type while retaining URL-derived identity', async () => {
  const picker = await readFile(ownerReportsUrl, 'utf8');

  assert.match(picker, /function reportFilterMeta\([\s\S]*?report === 'valuation'[\s\S]*?labelSuffix: ''/);
  assert.match(picker, /REPORT_MONTHS\[monthIndex\]/);
  assert.match(picker, /report === 'maintenance' && maintenanceType !== 'all'/);
  assert.match(picker, /reportFileName\(asset\.title, report, year, month, maintenanceType\)/);
  assert.match(picker, /label: `\$\{REPORT_TITLES\[report\]\}\$\{filterMeta\.labelSuffix\} · PDF`/);
  assert.match(picker, /return `\$\{slugFileName\(assetTitle\)\}-\$\{report\}\$\{filterMeta\.fileSuffix\}\.pdf`/);
  assert.match(picker, /id: `owner-report:\$\{report\}:\$\{asset\.id\}:\$\{params\.toString\(\) \|\| 'all'\}`/);
});

test('direct report routes hide missing or cross-scope Owner App assets', async () => {
  const [scanReport, ownershipReport, valuationExport] = await Promise.all([
    readFile(new URL('../app/api/asset-register/scan-report/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/my-invoices/report/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/asset-register/export/route.ts', import.meta.url), 'utf8'),
  ]);

  for (const route of [scanReport, ownershipReport]) {
    assert.match(route, /getOwnerAppAccess/);
    assert.match(route, /ownerAppAccess\?\.sessionKind === 'owner-app-user'/);
    assert.match(route, /!ownerAppCanAccessAsset\(ownerAppAccess,/);
    assert.match(route, /!.*assetId \|\| Boolean\(groupId\)/s);
    assert.match(route, /The requested asset report could not be found\./);
    assert.match(route, /status: 404/);
  }

  assert.match(valuationExport, /validateOwnerAppAssetSelection/);
  assert.match(valuationExport, /ownerAppCanAccessAsset\(ownerAppAccess, assetId\)/);
  assert.match(valuationExport, /ownerAppSelection === 'asset_ids_required'/);
  assert.match(valuationExport, /ownerAppSelection === 'not_found'[\s\S]*?requestedAssetsNotFound\(\)/);
});

test('Owner App sharing surfaces are responsive and the report picker remains readable', async () => {
  const styles = await readFile(new URL('../app/owner-app/owner-app.module.css', import.meta.url), 'utf8');

  assert.match(styles, /\.ownerShareDestinationSection \{/);
  assert.match(styles, /\.ownerExternalShareSection \{[\s\S]*?min-width: 0;[\s\S]*?padding: 16px;/);
  assert.match(styles, /\.ownerShareReportModal \{ width: min\(100%, 600px\);/);
  assert.match(styles, /\.reportFilterModalHeader p \{[\s\S]*?font-size: 0\.82rem;/);
  assert.match(styles, /\.reportFilterActions > \.ownerReportAttachButton \{[\s\S]*?background: var\(--owner-green\);[\s\S]*?color: #fff;/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*?\.ownerExternalShareSection \{ border-radius: 20px; padding: 10px; \}/);
});
