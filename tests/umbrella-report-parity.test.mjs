import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('umbrella manager uses dedicated icon tiles that shared modal CSS cannot collapse', async () => {
  const [modal, styles] = await Promise.all([
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.module.css', import.meta.url), 'utf8'),
  ]);

  assert.match(modal, /styles\.manageMenuIconTile/);
  assert.match(modal, /styles\.manageMenuEditIcon/);
  assert.match(modal, /styles\.manageMenuReportIcon/);
  assert.match(modal, /styles\.manageMenuRemoveIcon/);
  assert.match(modal, /<i className=\{`\$\{styles\.manageMenuIconTile\}/);
  assert.doesNotMatch(modal, /<span className=\{`\$\{styles\.manageMenuIconTile\}/);
  assert.match(styles, /\.manageMenuIconTile \{[\s\S]*?grid-column: 1;[\s\S]*?justify-self: center;[\s\S]*?width: 46px;[\s\S]*?height: 46px;[\s\S]*?font-style: normal;/);
  assert.match(styles, /\.manageMenuIconGlyph \{[\s\S]*?width: 24px;[\s\S]*?height: 24px;/);
  assert.doesNotMatch(modal, /MembersIcon className=\{`\$\{registerStyles\.buttonIcon\}/);
});

test('umbrella maintenance offers the same completed-work types as an individual report', async () => {
  const [client, modal, route] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/maintenance/report/route.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(modal, /Checked only/);
  assert.match(modal, /Services only/);
  assert.match(modal, /Repairs only/);
  assert.match(client, /maintenanceParams\.set\('procedureKind', maintenanceSelection\)/);
  assert.match(route, /parseProcedureKind/);
  assert.match(route, /maintenanceRecordProcedureKind\(record\) === procedureKind/);
});

test('umbrella fuel and depreciation reports calculate each asset independently', async () => {
  const report = await readFile(new URL('../app/api/asset-register/scan-report/route.ts', import.meta.url), 'utf8');

  assert.match(report, /function isUmbrellaReportScope\(asset: AssetRegisterItem, scopeAssets: AssetRegisterItem\[\]\): boolean/);
  assert.equal((report.match(/isUmbrellaReportScope\(asset, scopeAssets\)/g) ?? []).length, 3);
  assert.match(report, /Fuel Average by Asset/);
  assert.match(report, /reportAssetForEvent\(event, fallbackAsset\)\.id === scopeAsset\.id/);
  assert.match(report, /buildUmbrellaFuelAveragesWorkbookSheet/);
  assert.match(report, /Different hour and kilometre meters are never combined/);
  assert.match(report, /const summary = isUmbrellaReport[\s\S]*?buildDepreciationUmbrellaLogSummary\(entries, scopeAssets\)[\s\S]*?: buildDepreciationLogSummary\(entries, asset\)/);
  assert.match(report, /const annualSummaries = isUmbrellaReport[\s\S]*?buildDepreciationUmbrellaAnnualSummary\(entries\)[\s\S]*?: buildDepreciationAnnualSummary\(entries\)/);
  assert.match(report, /buildDepreciationUmbrellaLogSummary\(logEntries, reportAssets\)/);
  assert.match(report, /buildDepreciationUmbrellaAnnualSummary\(logEntries\)/);
});

test('every umbrella export remains restricted to the selected grouped assets', async () => {
  const [client, scanReport, maintenanceRoute, ownershipRoute] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/asset-register/scan-report/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/maintenance/report/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/my-invoices/report/route.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /assetsForGroup\(group\)/);
  assert.match(client, /buildAssetGroupTimelineReportUrl\(group, reportKind, filters, format\)/);
  assert.match(client, /buildAssetGroupOwnershipReportUrl\(group, filters, format\)/);
  assert.match(scanReport, /group\.members\.map\(\(member\) => getAssetRegisterItemById/);
  assert.match(maintenanceRoute, /groupMemberIds\.has\(record\.assetId\)/);
  assert.match(ownershipRoute, /workspaceData\.invoices\.filter\(\(invoice\) => groupMemberIds\.has\(invoice\.assetId\)\)/);
});
