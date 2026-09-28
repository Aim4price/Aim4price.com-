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
