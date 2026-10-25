import assert from 'node:assert/strict';
import test from 'node:test';
// Load the pure TypeScript builders under the repository's Node 20 CI runtime.
function loadBuilder(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, Buffer, Date, URL, require: (name) => loadBuilder('../lib/' + name.replace('./', '')),
  });
  return exports;
}
const { parseFuelSlipReportFilters, selectFuelSlipsForReport } = loadBuilder('../lib/fuel-slip-report-selection.ts');
const { buildFuelSlipWorkbook, buildFuelSlipReportHtml } = loadBuilder('../lib/fuel-slip-export.ts');

const slip = { documentDate: '2026-09-15', supplierName: '<script>alert(1)</script>', targetType: 'asset', assetTitle: 'Tractor', litres: 50.125, pricePerLitre: 20, totalAmount: 1002.50, vatAmount: null, reviewRequired: true, extractionStatus: 'needs_review', note: '=SUM(A1:A2) 4111 1111 1111 1111', cardLast4: '1111' };
test('PDF escapes slip text, identifies incomplete records and preserves numeric totals', () => {
  const html = buildFuelSlipReportHtml([slip]);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /50[,.]125 L/);
  assert.match(html, /R[\s\u00a0]*1[\s\u00a0]?002[,.]50/);
  assert.ok(html.includes('Not completed'));
  assert.ok(html.includes('assetReportFuelEventGroup'));
});
test('Excel is an actual workbook with numeric cells and safely stored free text', () => {
  const workbook = buildFuelSlipWorkbook([slip]);
  assert.equal(workbook.subarray(0, 2).toString(), 'PK');
  const xml = workbook.toString();
  assert.ok(xml.includes('xl/worksheets/sheet1.xml'));
  assert.ok(xml.includes('<v>50.125</v>'));
  assert.ok(xml.includes('=SUM(A1:A2) Card ending 1111'));
  assert.ok(!xml.includes('<f>'));
  assert.ok(!xml.includes('4111 1111 1111 1111'));
});

test('Excel keeps the supplier, activity and unrecorded work area in separate columns', () => {
  const xml = buildFuelSlipWorkbook([{ ...slip, supplierName: 'Engen George', activityText: 'Delivering feed to Farm A', workAreaText: '' }]).toString();
  assert.match(xml, /<c r="B2"[^>]*>[\s\S]*?<t[^>]*>Engen George<\/t>/);
  assert.match(xml, /<c r="X2"[^>]*>[\s\S]*?<t[^>]*>Delivering feed to Farm A<\/t>/);
  const workAreaCell = xml.match(/<c r="Y2"[^>]*>[\s\S]*?<\/c>/)?.[0] ?? '';
  assert.doesNotMatch(workAreaCell, /Engen|Farm A|N\/A/);
});

import ts from 'typescript';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function exportRoute({ authorized = true, slips = [] } = {}) {
  let rendered = false;
  class NextResponse extends Response { static json(body, init) { return new Response(JSON.stringify(body), init); } }
  const mocks = {
    'next/server': { NextResponse },
    '../../../../../lib/fuel-report': loadBuilder('../lib/fuel-report.ts'),
    '../../../../../lib/account-profile': { getAccountProfile: async () => ({ businessName: 'Owner Farm', logoUrl: '' }) },
    '../../../../../lib/asset-registers': { getAssetRegisterReportLogoUrl: async () => '' },
    '../../../../../lib/report-logo': { resolveReportLogoUrlForHtml: async () => '' },
    '../../../../../lib/owner-workspace-access': {
      resolveOwnerWorkspaceContext: async () => authorized ? { ok: true, context: { ownerUserId: 'owner' } } : { ok: false, response: new Response('', { status: 401 }) },
      filterFuelLedgerForWorkspace: async (_, ledger) => ({ ...ledger, recentFuelSlips: ledger.recentFuelSlips.filter((s) => s.allowed) }),
    },
    '../../../../../lib/fuel-ledger': { listFuelLedger: async () => ({ assets: slips.filter(s=>s.allowed).map(s=>({id:s.assetId})), recentFuelSlips: slips.slice(0,1) }), listFuelSlipsForReport: async () => slips },
    '../../../../../lib/fuel-slip-report-selection': { parseFuelSlipReportFilters, selectFuelSlipsForReport },
    '../../../../../lib/fuel-slip-export': { buildFuelSlipWorkbook: () => { rendered = true; return Buffer.from('PK'); }, buildFuelSlipReportHtml },
    '../../../../../lib/report-pdf': { renderReportHtmlToPdf: async () => { rendered = true; return Buffer.from('%PDF'); } },
  };
  const source = readFileSync(new URL('../app/api/fuel/slips/export/route.ts', import.meta.url), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: (name) => mocks[name], console, Buffer, Uint8Array, Set });
  return { post: (ids, format = 'xlsx') => exports.POST(new Request('https://example.com/api/fuel/slips/export', { method: 'POST', body: JSON.stringify({ ids, format }) })), postFilters: filters => exports.POST(new Request('https://example.com/api/fuel/slips/export', { method: 'POST', body: JSON.stringify({ filters, format:'xlsx' }) })), rendered: () => rendered };
}
test('export rejects unauthenticated requests before rendering', async () => {
  const route = exportRoute({ authorized: false });
  assert.equal((await route.post(['a'])).status, 401);
  assert.equal(route.rendered(), false);
});
test('export rejects IDs outside the scoped workspace and stale selections', async () => {
  const route = exportRoute({ slips: [{ id: 'a', allowed: true }, { id: 'b', allowed: false }] });
  for (const ids of [['b'], ['a', 'missing']]) assert.equal((await route.post(ids)).status, 409);
  assert.equal(route.rendered(), false);
});
test('export validates format and returns private attachments for accessible records', async () => {
  const route = exportRoute({ slips: [{ id: 'a', allowed: true }] });
  assert.equal((await route.post(['a'], 'csv')).status, 400);
  assert.equal((await route.post([])).status, 400);
  const response = await route.post(['a']);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.match(response.headers.get('Content-Type'), /spreadsheetml/);
});

test('PDF export renders authorized records with account context', async () => {
  const route = exportRoute({ slips: [{ id: 'a', allowed: true }] });
  const response = await route.post(['a'], 'pdf');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type'), /application\/pdf/);
});

test('filtered asset exports include matching slips beyond the loaded page, never other assets', async () => {
  const slips = [
    {id:'hidden',allowed:false,assetId:'other',targetType:'asset',documentDate:'2026-09-01'},
    {id:'old-loaded-out',allowed:true,assetId:'tractor',targetType:'asset',documentDate:'2026-09-02'},
  ];
  const route=exportRoute({slips});
  const response=await route.postFilters({assetId:'tractor',year:'2026',month:'9'});
  assert.equal(response.status,200);
  assert.equal((await route.postFilters({assetId:'other',year:'2026',month:'9'})).status,404);
});
test('fuel slip export dates, capture status and storage targets are independent',()=>{
  const records=[{id:'a',assetId:'a',targetType:'asset',documentDate:'2026-09-01',extractionStatus:'extracted'},
    {id:'b',assetId:'a',targetType:'asset',documentDate:'2026-08-31',extractionStatus:'manual'},
    {id:'s',storageId:'tank',targetType:'storage_tank',documentDate:'2026-09-01',reviewRequired:true}];
  const filter=parseFuelSlipReportFilters({assetId:'a',year:'2026',month:'9',capture:'automatic'});
  assert.deepEqual(selectFuelSlipsForReport(records,filter).map(s=>s.id),['a']);
  assert.deepEqual(selectFuelSlipsForReport(records,parseFuelSlipReportFilters({storageId:'tank',capture:'needs_review'})).map(s=>s.id),['s']);
  assert.equal(parseFuelSlipReportFilters({month:'9'}),null);
  assert.equal(parseFuelSlipReportFilters({year:'2026x'}),null);
});

test('PDF and Excel preserve clickable document/GPS links and reject unsafe link schemes', () => {
  const record = { ...slip, documentFileUrl: '/api/capture-requests/demo/files/slip', latitude: -33.96, longitude: 22.46 };
  const html = buildFuelSlipReportHtml([record], { baseUrl: 'https://www.aim4price.com/api/fuel/slips/export' });
  assert.match(html, /href="https:\/\/www\.aim4price\.com\/api\/capture-requests\/demo\/files\/slip"/);
  assert.match(html, /href="https:\/\/www\.google\.com\/maps\?q=-33.96,22.46"/);
  const workbook = buildFuelSlipWorkbook([record], 'https://www.aim4price.com').toString();
  assert.match(workbook, /relationships\/hyperlink/);
  assert.match(workbook, /https:\/\/www\.aim4price\.com\/api\/capture-requests\/demo\/files\/slip/);
  assert.match(workbook, /https:\/\/www\.google\.com\/maps\?q=-33.96,22.46/);
  const unsafe = { ...record, documentFileUrl: 'javascript:alert(1)', latitude: 100, longitude: 200 };
  assert.doesNotMatch(buildFuelSlipReportHtml([unsafe]), /href="javascript:|maps\?q=100/);
  assert.doesNotMatch(buildFuelSlipWorkbook([unsafe]).toString(), /Target="javascript:|maps\?q=100/);
});

test('Excel preserves explicit N/A separately from missing or zero usage', () => {
  const xml = buildFuelSlipWorkbook([
    { ...slip, usageNotApplicable: true, odometerReading: null, hourMeterReading: null },
    { ...slip, usageNotApplicable: false, odometerReading: 0, hourMeterReading: null },
  ]).toString();
  assert.match(xml.match(/<c r="U2"[^>]*>[\s\S]*?<\/c>/)?.[0] ?? '', /N\/A/);
  assert.match(xml.match(/<c r="V2"[^>]*>[\s\S]*?<\/c>/)?.[0] ?? '', /N\/A/);
  assert.match(xml.match(/<c r="U3"[^>]*>[\s\S]*?<\/c>/)?.[0] ?? '', /<v>0<\/v>/);
  assert.doesNotMatch(xml.match(/<c r="V3"[^>]*>[\s\S]*?<\/c>/)?.[0] ?? '', /N\/A/);
});


test('PDF distinguishes explicitly inapplicable usage from an unrecorded reading', () => {
  const explicit = buildFuelSlipReportHtml([{ ...slip, usageNotApplicable: true, odometerReading: null, hourMeterReading: null }]);
  const missing = buildFuelSlipReportHtml([{ ...slip, usageNotApplicable: false, odometerReading: null, hourMeterReading: null }]);
  assert.match(explicit, /N\/A/);
  assert.doesNotMatch(missing, /N\/A/);
});

test('Excel shows explicit operator N/A rather than a blank or stale operator', () => {
  const xml = buildFuelSlipWorkbook([{ ...slip, operatorNotApplicable: true, operatorName: 'Old name' }]).toString();
  const operatorCell = xml.match(/<c r="W2"[^>]*>[\s\S]*?<\/c>/)?.[0] ?? '';
  assert.match(operatorCell, /N\/A/);
  assert.doesNotMatch(operatorCell, /Old name/);
});
