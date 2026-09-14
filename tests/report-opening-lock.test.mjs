import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { openCanonicalReportUrl, downloadCanonicalReportFile } from '../lib/report-open.ts';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function reportTab() {
  const elements = [];
  const element = () => ({
    style: {}, children: [], textContent: '', setAttribute() {},
    append(...children) { this.children.push(...children); },
    replaceChildren() { this.children = []; },
  });
  const body = element();
  return {
    opener: 'initial', closed: false, written: '',
    document: {
      title: '', body,
      createElement() { const node = element(); elements.push(node); return node; },
      open() {}, close() {}, addEventListener() {},
      write(html) { tab.written = html; },
    },
    close() { this.closed = true; },
    elements,
  };
}

let tab;
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('canonical reports claim a tab before fetching with the originating realm', async () => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  try {
    for (const [pathname, realm] of [
      ['/asset-register', 'website'], ['/asset-registers', 'website'],
      ['/owner-app/assets/asset-1', 'owner'], ['/dealer/tracking', 'dealer'],
      ['/middleman/tracking', 'middleman'], ['/field-manager/home', 'field'],
    ]) {
      const events = [];
      tab = reportTab();
      globalThis.window = {
        location: { href: 'https://www.aim4price.com' + pathname, origin: 'https://www.aim4price.com', pathname },
        setTimeout, clearTimeout,
        open(url, target) { assert.equal(url, ''); assert.equal(target, '_blank'); events.push('open'); return tab; },
      };
      globalThis.fetch = async (url, options) => {
        events.push('fetch');
        assert.equal(options.headers['x-aim4price-client-realm'], realm);
        assert.equal(options.credentials, 'same-origin');
        assert.equal(options.cache, 'no-store');
        assert.equal(options.redirect, 'error');
        assert.ok(options.signal);
        assert.match(url, /accountantShareId=share-1/);
        return new Response('<html><body>Canonical report</body></html>', { headers: { 'content-type': 'text/html' } });
      };
      assert.equal(openCanonicalReportUrl('/api/asset-register/export?format=html&reportKind=summary&accountantShareId=share-1'), true);
      assert.deepEqual(events, ['open', 'fetch']);
      await settle();
      assert.equal(tab.opener, null);
      assert.match(tab.written, /Canonical report/);
    }
  } finally { globalThis.window = previousWindow; globalThis.fetch = previousFetch; }
});

test('failed report responses show an actionable error and retry, never raw JSON', async () => {
  const previousWindow = globalThis.window, previousFetch = globalThis.fetch;
  try {
    for (const [status, contentType, expected] of [
      [401, 'application/json', /session has expired/],
      [403, 'application/json', /permission/],
      [404, 'application/json', /no longer available/],
      [500, 'application/json', /Unable to prepare/],
      [200, 'application/json', /could not be prepared/],
    ]) {
      tab = reportTab();
      globalThis.window = {
        location: { href: 'https://www.aim4price.com/asset-register', origin: 'https://www.aim4price.com', pathname: '/asset-register' },
        open: () => tab, setTimeout, clearTimeout,
      };
      globalThis.fetch = async () => new Response('{"error":"<script>bad</script>"}', { status, headers: { 'content-type': contentType } });
      assert.equal(openCanonicalReportUrl('/api/report?format=html'), true);
      await settle();
      assert.equal(tab.written, '');
      const message = tab.document.body.children[0].children.map((node) => node.textContent).join(' ');
      assert.match(message, expected);
      assert.match(message, /Retry/);
      assert.doesNotMatch(message, /<script>|bad/);
      globalThis.fetch = async () => new Response('<html>Retry succeeded</html>', { headers: { 'content-type': 'text/html' } });
      tab.elements.findLast((node) => node.textContent === 'Retry').onclick();
      await settle();
      assert.match(tab.written, /Retry succeeded/);
    }
  } finally { globalThis.window = previousWindow; globalThis.fetch = previousFetch; }
});

test('blocked popups and foreign URLs cannot trigger a credentialed report request', () => {
  const previousWindow = globalThis.window, previousFetch = globalThis.fetch;
  let fetches = 0;
  try {
    globalThis.window = {
      location: { href: 'https://www.aim4price.com/asset-register', origin: 'https://www.aim4price.com', pathname: '/asset-register' },
      open: () => null,
    };
    globalThis.fetch = () => { fetches++; throw Error('Unexpected fetch'); };
    assert.equal(openCanonicalReportUrl('/api/report?format=html'), false);
    assert.throws(() => openCanonicalReportUrl('https://other.example/api/report'), /not available/);
    assert.equal(fetches, 0);
  } finally { globalThis.window = previousWindow; globalThis.fetch = previousFetch; }
});

test('normal PDF actions use canonical browser HTML instead of the server Chromium renderer', async () => {
  const [assetRegister, assetRegisters, maintenance, invoices, ownerPicker, dealerMaintenance, dealerOwnership, reportOpen] = await Promise.all([
    read('app/asset-register/asset-register-client.tsx'),
    read('app/asset-registers/asset-registers-client.tsx'),
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
  assert.match(assetRegister, /buildAssetRegisterSummaryExportUrl\([\s\S]*?'html'[\s\S]*?openCanonicalReportUrl\(url\)/);
  assert.doesNotMatch(assetRegister, /openPreparedExternalReport/);

  assert.match(assetRegisters, /function buildScopedSummaryUrl[\s\S]*?format: "html"/);
  assert.match(assetRegisters, /handleSummaryPdfExport[\s\S]*?openCanonicalReportUrl\(url\)/);

  assert.match(maintenance, /format === 'pdf' \? 'html' : format/);
  assert.match(invoices, /format === 'pdf' \? 'html' : format/);
  assert.match(ownerPicker, /reportFormat === 'pdf' \? 'html' : reportFormat/);
  assert.match(ownerPicker, /openCanonicalReportHtml\('Aim4price asset valuation', valuationReportHtml\)/);
  assert.match(dealerMaintenance, /openCanonicalReportUrl\(buildReportUrl\('html'\)\)/);
  assert.match(dealerOwnership, /openCanonicalReportUrl\(buildReportUrl\('html'\)\)/);
  assert.match(reportOpen, /window\.open\('', '_blank'\)/);
  assert.match(reportOpen, /reportWindow\.opener = null/);
  assert.match(reportOpen, /reportWindow\.document\.write\(html\)/);
  assert.match(reportOpen, /x-aim4price-client-realm/);
  assert.doesNotMatch(reportOpen, /reportWindow\.location\.replace/);
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

test('Excel downloads preserve the original app session and validate the file before saving', async () => {
  const previousWindow = globalThis.window, previousFetch = globalThis.fetch, previousDocument = globalThis.document;
  const previousCreate = URL.createObjectURL, previousRevoke = URL.revokeObjectURL;
  const downloaded = [], revoked = [];
  try {
    globalThis.window = {
      location: { href: 'https://www.aim4price.com/owner-app/assets/asset-1', origin: 'https://www.aim4price.com', pathname: '/owner-app/assets/asset-1' },
      setTimeout(callback, delay) { if (delay === 60_000) { callback(); return 0; } return setTimeout(callback, delay); },
      clearTimeout,
    };
    globalThis.document = {
      body: { append() {} },
      createElement() { return { click() { downloaded.push({ href: this.href, filename: this.download }); }, remove() {} }; },
    };
    URL.createObjectURL = (blob) => { assert.ok(blob.size > 0); return 'blob:fixture'; };
    URL.revokeObjectURL = (url) => revoked.push(url);
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.headers['x-aim4price-client-realm'], 'owner');
      assert.equal(options.credentials, 'same-origin');
      return new Response('PK-fixture', { headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': 'attachment; filename="maintenance.xlsx"',
      } });
    };
    await downloadCanonicalReportFile('/api/maintenance/report?format=xlsx');
    assert.deepEqual(downloaded, [{ href: 'blob:fixture', filename: 'maintenance.xlsx' }]);
    assert.deepEqual(revoked, ['blob:fixture']);
    globalThis.fetch = async () => new Response('{"ok":false}', { headers: { 'content-type': 'application/json' } });
    await assert.rejects(downloadCanonicalReportFile('/api/maintenance/report?format=xlsx'), /spreadsheet could not be prepared/);
    globalThis.fetch = async () => new Response('{"error":"You must be signed in."}', { status: 401 });
    await assert.rejects(downloadCanonicalReportFile('/api/maintenance/report?format=xlsx'), /session has expired/);
    assert.equal(downloaded.length, 1);
  } finally {
    globalThis.window = previousWindow; globalThis.fetch = previousFetch; globalThis.document = previousDocument;
    URL.createObjectURL = previousCreate; URL.revokeObjectURL = previousRevoke;
  }
});
