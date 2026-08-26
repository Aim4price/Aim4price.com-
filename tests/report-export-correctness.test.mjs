import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { reportYearInTimeZone, sortReportEntriesChronologically } from '../lib/report-chronology.ts';
import { createXlsxWorkbook } from '../lib/simple-xlsx.ts';
import { resolveMaintenanceMeterReading, toFiniteNumberOrNull } from '../lib/usage-readings.ts';

function depreciationEntry(overrides = {}) {
  return {
    id: 'entry-1',
    capturedAtIso: '2026-06-23T07:29:00.000Z',
    createdAtIso: '2026-06-23T07:29:00.000Z',
    previousValueExVat: 370_000,
    newValueExVat: 369_000,
    usageAmount: 14_029,
    usageMetric: 'hours',
    condition: 'good',
    replacementPriceExVat: 650_000,
    ...overrides,
  };
}

test('depreciation report entries are chronological even when display rows are newest first', async () => {
  const newestFirst = [
    depreciationEntry({
      id: 'latest',
      capturedAtIso: '2026-07-30T10:54:00.000Z',
      createdAtIso: '2026-07-30T10:54:00.000Z',
      previousValueExVat: 369_000,
      newValueExVat: 367_000,
      usageAmount: 14_056,
    }),
    depreciationEntry({ id: 'first' }),
  ];

  const ordered = sortReportEntriesChronologically(newestFirst);
  const timelineSource = await readFile(new URL('../lib/asset-depreciation-timeline.ts', import.meta.url), 'utf8');

  assert.equal(ordered[0].id, 'first');
  assert.equal(ordered.at(-1).id, 'latest');
  assert.match(timelineSource, /const orderedEntries = sortReportEntriesChronologically\(entries\)/);
  assert.match(timelineSource, /const first = orderedEntries\[0\]/);
  assert.match(timelineSource, /const latest = orderedEntries\[orderedEntries\.length - 1\]/);
});

test('annual depreciation grouping uses South African calendar years', () => {
  assert.equal(reportYearInTimeZone('2026-12-31T22:30:00.000Z'), 2027);
});

test('maintenance reports preserve the hour meter entered on the scan event', () => {
  assert.equal(toFiniteNumberOrNull(null), null);
  assert.equal(toFiniteNumberOrNull(''), null);
  assert.deepEqual(
    resolveMaintenanceMeterReading({
      hours: 14_056,
      assetUsageReading: 0,
      assetUsageMetric: 'hours',
    }, 'hours'),
    { value: 14_056, unit: 'hours' },
  );
  assert.deepEqual(
    resolveMaintenanceMeterReading({
      hours: null,
      assetUsageReading: 14_056,
      assetUsageMetric: 'hours',
    }, 'hours'),
    { value: 14_056, unit: 'hours' },
  );
});

test('XLSX exports preserve dates, model years, quantities and clickable links as native cells', () => {
  const workbook = createXlsxWorkbook([{
    name: 'Verification',
    rows: [
      [
        { value: 'Recorded on (SAST)', style: 'tableHeader' },
        { value: 'Model year', style: 'tableHeader' },
        { value: 'Usage', style: 'tableHeader' },
        { value: 'Location', style: 'tableHeader' },
      ],
      [
        { value: new Date(Date.UTC(2026, 7, 15, 14, 54)), style: 'dateTime' },
        { value: 2013, style: 'year' },
        { value: 14_056, style: 'decimal' },
        { value: 'Open latest position', hyperlink: 'https://www.google.com/maps?q=-34.024051,22.383678' },
      ],
    ],
  }]);
  const archiveText = workbook.toString('utf8');

  assert.match(archiveText, /formatCode="dd mmm yyyy hh:mm"/);
  assert.match(archiveText, /<c r="A2" s="21"><v>\d+\.\d+<\/v><\/c>/);
  assert.match(archiveText, /<c r="B2" s="19"><v>2013<\/v><\/c>/);
  assert.match(archiveText, /<c r="C2" s="10"><v>14056<\/v><\/c>/);
  assert.match(archiveText, /<hyperlink ref="D2" r:id="rId1"\/>/);
  assert.match(archiveText, /relationships\/hyperlink/);
  assert.match(archiveText, /<pageSetUpPr fitToPage="1" autoPageBreaks="0"\/>/);
  assert.doesNotMatch(archiveText, /2,013|14,056\.00/);
});

test('canonical reports use real PDF page totals and clear maintenance language', async () => {
  const [renderer, scanReport, ownershipReport] = await Promise.all([
    readFile(new URL('../lib/report-pdf.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/asset-register/scan-report/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/my-invoices-report.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(renderer, /displayHeaderFooter: true/);
  assert.match(renderer, /class="pageNumber"/);
  assert.match(renderer, /class="totalPages"/);
  assert.doesNotMatch(scanReport, /Page 1 of 1/);
  assert.doesNotMatch(ownershipReport, /Page 1 of 1/);
  assert.match(scanReport, /Recorded on \(SAST\)/);
  assert.match(scanReport, /Hour meter/);
  assert.match(scanReport, /formatMaintenanceEventUsage\(asset, entry\.event\)/);
  assert.match(scanReport, /Photo evidence/);
  assert.match(scanReport, /Fuel Audit/);
  assert.match(ownershipReport, /Fuel Costs/);
});
