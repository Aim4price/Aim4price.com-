import assert from 'node:assert/strict';
import test from 'node:test';
// Load the pure TypeScript builders under the repository's Node 20 CI runtime.
function loadBuilder(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, Buffer, Date, require: (name) => loadBuilder('../lib/' + name.replace('./', '')),
  });
  return exports;
}
const { parseFuelSlipReportFilters, selectFuelSlipsForReport } = loadBuilder('../lib/fuel-slip-report-selection.ts');
const { buildFuelSlipWorkbook, buildFuelSlipReportHtml } = loadBuilder('../lib/fuel-slip-export.ts');

const slip = { documentDate: '2026-09-15', supplierName: '<script>alert(1)</script>', targetType: 'asset', assetTitle: 'Tractor', litres: 50.125, pricePerLitre: 20, totalAmount: 1002.50, vatAmount: null, reviewRequired: true, extractionStatus: 'needs_review', note: '=SUM(A1:A2) 4111 1111 1111 1111', cardLast4: '1111' };
test('PDF escapes slip text, identifies incomplete records and preserves numeric totals', () => {
  const html = buildFuelSlipReportHtml([slip]);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('50.125 litres'));
  assert.ok(html.includes('R 1002.50'));
  assert.ok(html.includes('Not completed'));
  assert.ok(html.includes('—'));
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

import ts from 'typescript';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function exportRoute({ authorized = true, slips = [] } = {}) {
  let rendered = false;
  class NextResponse extends Response { static json(body, init) { return new Response(JSON.stringify(body), init); } }
  const mocks = {
    'next/server': { NextResponse },
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
