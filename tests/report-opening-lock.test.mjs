import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { openCanonicalReportUrl } from '../lib/report-open.ts';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('canonical report URL opening claims the tab before navigation', () => {
  const previousWindow = globalThis.window;
  let openedUrl = '';
  const reportWindow = {
    opener: 'initial',
    location: {
      replace(url) {
        openedUrl = url;
      },
    },
  };
  globalThis.window = {
    open(url, target) {
      assert.equal(url, '');
      assert.equal(target, '_blank');
      return reportWindow;
    },
  };

  try {
    assert.equal(openCanonicalReportUrl('/api/report?format=html'), true);
    assert.equal(reportWindow.opener, null);
    assert.equal(openedUrl, '/api/report?format=html');
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('normal PDF actions use canonical browser HTML instead of the server Chromium renderer', async () => {
  const [assetRegister, maintenance, invoices, ownerPicker, dealerMaintenance, dealerOwnership, reportOpen] = await Promise.all([
    read('app/asset-register/asset-register-client.tsx'),
    read('app/maintenance/maintenance-client.tsx'),
    read('app/my-invoices/my-invoices-client.tsx'),
    read('app/owner-app/assets/[assetId]/owner-asset-report-picker.tsx'),
    read('components/DealerMaintenanceReportModal.tsx'),
    read('components/DealerCostOfOwnershipReportModal.tsx'),
    read('lib/report-open.ts'),
  ]);

  assert.match(assetRegister, /handleOpenAssetPdfReport[\s\S]*?buildAssetPdfReportUrl\(asset, reportKind, filters, 'html'\)/);
  assert.match(assetRegister, /buildAssetOwnershipReportUrl\(asset, filters, 'html'\)/);
  assert.match(assetRegister, /const printableReportUrl =[\s\S]*?buildAssetGroupOwnershipReportUrl\(group, filters, 'html'\)[\s\S]*?buildAssetGroupTimelineReportUrl\(group, reportKind, filters, 'html'\)/);
  assert.match(assetRegister, /writeCanonicalReportHtml\(reportWindow, `\$\{asset\.title\} valuation`, reportHtml\)/);
  assert.match(assetRegister, /writeCanonicalReportHtml\(reportWindow, `\$\{reportName\} - \$\{reportOption\.label\} Report`, reportHtml\)/);
  assert.doesNotMatch(assetRegister, /openPreparedExternalReport/);

  assert.match(maintenance, /format === 'pdf' \? 'html' : format/);
  assert.match(invoices, /format === 'pdf' \? 'html' : format/);
  assert.match(ownerPicker, /reportFormat === 'pdf' \? 'html' : reportFormat/);
  assert.match(ownerPicker, /openCanonicalReportHtml\('Aim4price asset valuation', valuationReportHtml\)/);
  assert.match(dealerMaintenance, /openCanonicalReportUrl\(buildReportUrl\('html'\)\)/);
  assert.match(dealerOwnership, /openCanonicalReportUrl\(buildReportUrl\('html'\)\)/);
  assert.match(reportOpen, /window\.open\('', '_blank'\)/);
  assert.match(reportOpen, /reportWindow\.opener = null/);
  assert.match(reportOpen, /reportWindow\.location\.replace\(url\)/);
});

test('external attachments keep an explicit canonical PDF source', async () => {
  const [assetRegister, ownerPicker] = await Promise.all([
    read('app/asset-register/asset-register-client.tsx'),
    read('app/owner-app/assets/[assetId]/owner-asset-report-picker.tsx'),
  ]);

  assert.match(assetRegister, /url: '\/api\/reports\/render-pdf'[\s\S]*?html: reportHtml/);
  assert.match(assetRegister, /if \(externalShareReportScope === 'asset'\)[\s\S]*?addExternalShareReport\(reportSource\)/);
  assert.match(assetRegister, /externalShareReportScope === 'register' \|\| externalShareReportScope === 'group'[\s\S]*?addExternalShareReport\(reportSource\)/);
  assert.match(ownerPicker, /buildOwnerValuationReportSource[\s\S]*?url: '\/api\/reports\/render-pdf'/);
  assert.match(ownerPicker, /const url = buildOwnerAssetReportUrl\(asset, report, reportFormat, year, month, maintenanceType\)/);
});

test('Owner App may open authenticated canonical HTML but still cannot request CSV', async () => {
  const route = await read('app/api/my-invoices/report/route.ts');

  assert.match(route, /ownerAppMode && requestedFormat !== 'xlsx' && requestedFormat !== 'html'[\s\S]*?\? 'pdf'[\s\S]*?: requestedFormat/);
});
