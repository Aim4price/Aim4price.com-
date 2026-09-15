import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
function load(path, mocks = {}, extra = []) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8') + `\nObject.assign(exports, {${extra.join(',')}});`;
  const module = { exports: {} };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}
const xlsx = load('lib/simple-xlsx.ts');
const slips = load('lib/fuel-slip-export.ts', { './simple-xlsx.ts': xlsx, './report-theme.ts': { REPORT_THEME_CSS: '' } });

test('Excel preserves cents, GPS precision, reference text and native SAST dates', () => {
  const date = xlsx.reportExcelDate('2026-12-31T22:30:00Z');
  assert.equal(date.toISOString(), '2027-01-01T00:30:00.000Z');
  assert.equal(xlsx.reportExcelDate('2026-09-15').toISOString(), '2026-09-15T00:00:00.000Z');
  assert.equal(xlsx.reportExcelDate('invalid'), null);
  const buffer = xlsx.createXlsxWorkbook([{ name: 'Example', rows: [[
    { value: 23.67, style: 'currency' }, { value: -33.952511, style: 'coordinate' },
    { value: '=1+1', style: 'text' }, { value: date, style: 'dateTime' },
  ]], columns: Array(34).fill(20) }]).toString();
  assert.match(buffer, /#,##0.00/);
  assert.match(buffer, /0.000000/);
  assert.match(buffer, /t="inlineStr"[^>]*><is><t[^>]*>=1\+1/);
  assert.match(buffer, /fitToWidth="0"/);
});

test('fuel slip identifiers survive masking while payment numbers in notes remain masked', () => {
  const record = { documentDate: '2026-09-15', slipNumber: '1234567890123456', transactionNumber: '9876543210987654', targetType: 'asset', assetTitle: 'Tractor', litres: 12.345, pricePerLitre: 23.67, totalAmount: 292.21, vatAmount: 38.11, note: 'Paid using 4111 1111 1111 1111', cardLast4: '1111' };
  const bytes = slips.buildFuelSlipWorkbook([record]).toString();
  assert.match(bytes, /1234567890123456/);
  assert.match(bytes, /9876543210987654/);
  assert.doesNotMatch(bytes, /4111 1111 1111 1111/);
  assert.match(bytes, /name="Summary"/);
  assert.match(bytes, /<v>23.67<\/v>/);
  const html = slips.buildFuelSlipReportHtml([record], { accountName: 'Example & Farm', logoUrl: 'data:image/png;base64,AA==' });
  assert.match(html, /1234567890123456/);
  assert.match(html, /Example &amp; Farm/);
});

test('insurance inventory excludes old policies and identifies shared amounts and unknown VAT', () => {
  const insurance = load('lib/insurance-report.ts', {
    './report-theme.ts': {}, './db': {}, './insurance-workspaces': {},
    './insurance-cover-catalogue': {}, './insurance-workspace-readiness': {},
  }, ['assetTable']);
  const policy = (status, amount, vatBasis) => ({ status, insurerName: status, sections: [{ scheduleItems: [{ itemLabel: 'Equipment', assetIds: ['a', 'b'], financialTerms: [{ termType: 'sum_insured', amount, vatBasis, currency: 'ZAR' }] }] }] });
  const html = insurance.assetTable({ workspace: {
    assessments: [], policies: [policy('expired', '999999', 'inclusive'), policy('current', '1000', 'unknown'), policy('current', '2000', 'exclusive')],
    assets: [{ id: 'a', title: 'Tractor', snapshot: {} }],
  } });
  assert.doesNotMatch(html, /999/);
  assert.match(html, /VAT basis unconfirmed/);
  assert.match(html, /shared across 2 assets/);
  assert.match(html, /VAT excl./);
  assert.doesNotMatch(html, /Recorded sum insured \(VAT incl\.\)/);
});

test('accountant fuel exports request full history and keep same-name assets separate', async () => {
  class NextResponse extends Response { static json(body, init) { return new Response(JSON.stringify(body), init); } }
  let fullHistory = false;
  const records = Array.from({ length: 100 }, (_, i) => ({ assetId: i % 2 ? 'a' : 'b', assetTitle: 'Same tractor', eventType: 'asset_issue', litres: 1, totalAmount: 2 }));
  const route = load('app/api/accountant/registers/[shareId]/reports/route.ts', {
    'next/server': { NextResponse },
    '../../../../../../lib/auth-session': { getServerSession: async () => ({ user: { id: 'accountant' } }) },
    '../../../../../../lib/accounting-collaboration': {}, '../../../../../../lib/asset-lifecycle': {}, '../../../../../../lib/db': {},
    '../../../../../../lib/accountant-workspace': {
      getAccountantRegisterData: async () => ({ items: [{ id: 'a' }, { id: 'b' }], register: { businessName: 'Farm' } }),
      getAccountantLedger: async options => { fullHistory = options.fullFuelHistory; return { fuel: { recentEvents: [...records, { eventType: 'stock_in', litres: 1000 }] } }; },
    },
  }, ['csvCell']);
  const response = await route.GET(new Request('https://example.com?kind=fuel-report'), { params: { shareId: 'share' } });
  const csv = await response.text();
  assert.equal(fullHistory, true);
  assert.match(csv, /a,Same tractor,50,50,100/);
  assert.match(csv, /b,Same tractor,50,50,100/);
  assert.doesNotMatch(csv, /1000/);
  assert.equal(route.csvCell('=1+1'), "'=1+1");
  assert.equal(route.csvCell(-12.5), '-12.5');
});
