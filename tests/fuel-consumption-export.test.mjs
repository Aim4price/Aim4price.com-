import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
function load(path) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, Buffer, Date, URL, require: name => load('../lib/' + name.replace('./', '')) });
  return exports;
}
const { buildReportHtml, buildFuelWorkbook } = load('../lib/fuel-report.ts');
const options = {
  assetTitle: 'Test Hilux', title: 'Test Hilux Fuel Report', subtitle: '', generatedAt: '', ownerEmail: '',
  ownerDetails: { businessName: 'Test Farm', contactDetails: '', businessEmail: '', locationAddress: '' }, logoUrl: '',
  dateRangeLabel: 'All available entries', storageName: 'All storage units + slips', storageCode: '', storageFuelType: '',
  totalIssued: 100, totalWorkUseIssued: 100, totalExcludedIssued: 0, totalStockIn: 0, currentLitres: 0,
  storageCount: 1, eventCount: 2, xlsxUrl: '',
  events: [0, 1].map(index => ({ id: `e${index}`, assetId: 'a', assetTitle: 'Test Hilux', eventType: 'asset_issue',
    createdAtIso: `2026-08-0${index + 1}T10:00:00Z`, assetUsageMetric: 'km', assetUsageReading: 1000 + index * 500,
    litres: 50, assetFuelPercentBefore: 25, assetFuelPercentAfter: 100 })),
};

test('PDF and Excel expose identical consumption, covered distance and interval counts', () => {
  const html = buildReportHtml(options);
  assert.match(html, /Average consumption \(L\/100 km\)/);
  assert.match(html, /500 km/);
  assert.match(html, /Valid refill intervals \(km\)/);
  assert.match(html, /Estimated fuel left in asset before filling/);
  const rows = buildFuelWorkbook(options)[0].rows;
  const value = label => rows.find(row => row[0]?.value === label)?.[1]?.value;
  assert.equal(value('Average consumption (L/100 km)'), '10');
  assert.equal(value('Distance covered'), '500 km');
  assert.equal(value('Valid refill intervals (km)'), '1');
  assert.match(value('Calculation basis'), /starting fill/);
});

test('filtered fuel sources and insufficient data have explicit unavailable states in both exports', () => {
  for (const extra of [
    { consumptionUnavailableReason: 'Select all storage units and include fuel slips to calculate consumption.' },
    { events: [options.events[0]] },
  ]) {
    const input = { ...options, ...extra };
    const html = buildReportHtml(input);
    const rows = buildFuelWorkbook(input)[0].rows;
    assert.doesNotMatch(html, /Average consumption \(L\/100 km\)/);
    assert.match(rows.find(row => row[0]?.value === 'Average consumption')[1].value, /Select all|Not enough/);
  }
  assert.doesNotMatch(buildReportHtml({ ...options, assetTitle: undefined }), /<h2>Fuel Consumption/);
});
