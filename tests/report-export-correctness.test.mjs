import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { reportYearInTimeZone, sortReportEntriesChronologically } from '../lib/report-chronology.ts';
import { createXlsxWorkbook } from '../lib/simple-xlsx.ts';
import { buildAssetMaintenanceWorkbook } from '../lib/asset-maintenance-report.ts';
import {
  combineDepreciationUmbrellaAnnualSummaries,
  combineDepreciationUmbrellaLogSummaries,
} from '../lib/depreciation-umbrella-summary.ts';
import { resolveMaintenanceMeterReading, toFiniteNumberOrNull } from '../lib/usage-readings.ts';

function depreciationEntry(overrides = {}) {
  return {
    id: 'entry-1',
    assetRegisterItemId: 'asset-1',
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

test('umbrella depreciation totals each asset independently instead of mixing separate timelines', () => {
  const entries = [
    depreciationEntry({
      id: 'asset-1-opening',
      assetRegisterItemId: 'asset-1',
      capturedAtIso: '2026-01-10T08:00:00.000Z',
      previousValueExVat: 100_000,
      newValueExVat: 90_000,
    }),
    depreciationEntry({
      id: 'asset-2-opening',
      assetRegisterItemId: 'asset-2',
      capturedAtIso: '2026-02-10T08:00:00.000Z',
      previousValueExVat: 200_000,
      newValueExVat: 180_000,
    }),
  ];
  const summaries = [
    {
      openingLogValueExVat: 100_000, openingTimelineValueExVat: 100_000, currentValueExVat: 90_000,
      totalDifferenceExVat: -10_000, totalMarketDepreciationExVat: -10_000, totalMovementPercent: -10,
      firstLogEntryDateIso: '2026-01-10T08:00:00.000Z', firstSnapshotDateIso: '2026-01-10T08:00:00.000Z',
      latestLogEntryDateIso: '2026-01-10T08:00:00.000Z', latestSnapshotDateIso: '2026-01-10T08:00:00.000Z',
      logEntryCount: 1, snapshotCount: 1, latestUsageAmount: 14_029, latestUsageMetric: 'hours',
      latestCondition: 'good', replacementPriceUsedExVat: 250_000,
    },
    {
      openingLogValueExVat: 200_000, openingTimelineValueExVat: 200_000, currentValueExVat: 180_000,
      totalDifferenceExVat: -20_000, totalMarketDepreciationExVat: -20_000, totalMovementPercent: -10,
      firstLogEntryDateIso: '2026-02-10T08:00:00.000Z', firstSnapshotDateIso: '2026-02-10T08:00:00.000Z',
      latestLogEntryDateIso: '2026-02-10T08:00:00.000Z', latestSnapshotDateIso: '2026-02-10T08:00:00.000Z',
      logEntryCount: 1, snapshotCount: 1, latestUsageAmount: 3_000, latestUsageMetric: 'hours',
      latestCondition: 'good', replacementPriceUsedExVat: 400_000,
    },
  ];
  const annualSummaries = summaries.map((summary) => ({
    year: 2026,
    openingValueExVat: summary.openingLogValueExVat,
    closingValueExVat: summary.currentValueExVat,
    yearlyDifferenceExVat: summary.totalDifferenceExVat,
    yearlyDepreciationExVat: summary.totalDifferenceExVat,
    yearlyMovementPercent: summary.totalMovementPercent,
    logEntryCount: summary.logEntryCount,
    snapshotCount: summary.snapshotCount,
    latestUsageAmount: summary.latestUsageAmount,
    latestUsageMetric: summary.latestUsageMetric,
    latestCondition: summary.latestCondition,
  }));

  const summary = combineDepreciationUmbrellaLogSummaries(summaries, entries);
  const annual = combineDepreciationUmbrellaAnnualSummaries(annualSummaries, entries);

  assert.equal(summary.openingLogValueExVat, 300_000);
  assert.equal(summary.currentValueExVat, 270_000);
  assert.equal(summary.totalDifferenceExVat, -30_000);
  assert.equal(summary.totalMovementPercent, -10);
  assert.equal(annual.length, 1);
  assert.equal(annual[0].openingValueExVat, 300_000);
  assert.equal(annual[0].closingValueExVat, 270_000);
  assert.equal(annual[0].yearlyDifferenceExVat, -30_000);
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

test('QR, fuel and maintenance data survives intact into complete report exports', async () => {
  const [scanData, scanReport, fuelLedger, fuelIssueRoute, fuelScanClient, scanEventRoute, maintenanceData, maintenanceReport] = await Promise.all([
    readFile(new URL('../lib/scan-assets.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/asset-register/scan-report/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/fuel-ledger.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/fuel-scan/storage/[publicFuelStorageCode]/issue/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/fuel-scan/[publicFuelStorageCode]/fuel-scan-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/scan/assets/[publicAssetCode]/event/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/asset-maintenance.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/asset-maintenance-report.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(scanReport, /listScanEventsForAsset\(entry\.id, null,/);
  assert.match(scanReport, /fuelEventTimestamp\(event\)/);
  assert.match(scanReport, /Fuel Slip Document/);
  assert.match(scanReport, /Work Use Exclusion Reason/);
  assert.match(scanReport, /buildUmbrellaFuelAverageSection/);
  assert.match(scanReport, /buildUmbrellaFuelAveragesWorkbookSheet/);
  assert.match(scanReport, /Each average is calculated only from that asset's own valid fill intervals/);
  assert.match(scanReport, /isUmbrellaReportScope\(asset, scopeAssets\)/);
  assert.match(scanReport, /const summary = isUmbrellaReport[\s\S]*?buildDepreciationUmbrellaLogSummary\(entries, scopeAssets\)/);
  assert.match(scanReport, /const annualSummaries = isUmbrellaReport[\s\S]*?buildDepreciationUmbrellaAnnualSummary\(entries\)/);
  assert.match(scanReport, /buildDepreciationUmbrellaLogSummary\(logEntries, reportAssets\)/);
  assert.match(scanReport, /buildDepreciationUmbrellaAnnualSummary\(logEntries\)/);
  assert.match(scanData, /fs\.document_date/);
  assert.match(scanData, /reportOccurredAtIso/);
  assert.match(scanData, /left join public\.fuel_slips fs/);
  assert.match(scanData, /asset_usage_reading/);
  assert.match(scanData, /asset_usage_metric/);

  assert.match(fuelScanClient, /assetUsageMetric: usageNotApplicable \? 'none' : assetMeterMetric\(selectedAsset\)/);
  assert.match(fuelIssueRoute, /assetUsageMetric: body\.assetUsageMetric/);
  assert.match(fuelLedger, /assetUsageMetric: requestedUsageMetric/);
  assert.match(fuelLedger, /'fuel_storage_issue', 'Fuel Storage QR'/);
  assert.match(fuelLedger, /'fuel_slip', 'Fuel Slip'/);
  assert.match(fuelLedger, /where se\.fuel_slip_id = fs\.id/);
  assert.match(fuelLedger, /latitude: slip\.latitude/);
  assert.match(fuelLedger, /locationText: slip\.locationText/);
  assert.match(fuelLedger, /slip\.latitude !== null && slip\.longitude !== null/);

  assert.match(scanEventRoute, /completedAt: saved\.event\.createdAtIso/);
  assert.match(scanEventRoute, /saved\.event\.assetUsageReading \?\? saved\.event\.hours/);
  assert.match(maintenanceData, /left join public\.asset_scan_events se/);
  assert.match(maintenanceData, /sourcePhotoUrls: event\.photoUrls/);
  assert.match(maintenanceData, /sourceLatitude: event\.latitude/);
  assert.match(maintenanceReport, /Photo Evidence URLs/);
  assert.match(maintenanceReport, /Recorded Location/);
});

test('maintenance workbook exposes QR location and every captured photo URL', () => {
  const workbook = buildAssetMaintenanceWorkbook({
    title: 'Asset Maintenance Report',
    subtitle: 'Complete maintenance history',
    generatedAt: '26 Aug 2026',
    ownerEmail: 'owner@example.com',
    ownerDetails: { businessName: 'Example Farm', contactDetails: '', businessEmail: 'owner@example.com', locationAddress: '' },
    logoUrl: '',
    reportScopeLabel: 'All maintenance records',
    assetLabel: '2013 Landini 5-100H',
    selectedAsset: null,
    summary: { totalCount: 1, openCount: 0, doneCount: 1, dueSoonCount: 0, dueCount: 0, overdueCount: 0 },
    records: [{
      id: 'maintenance-1', userId: 'user-1', assetId: 'asset-1', assetTitle: '2013 Landini 5-100H', assetKind: 'tractor',
      assetCategoryLabel: 'Tractor', assetYearModel: 2013, assetUsageReading: 14056, assetUsageMetric: 'hours', assetCondition: 'good',
      assetValue: 367000, assetMeta: '2013 · 14,056 hours', maintenanceType: 'service', triggerType: 'usage', status: 'done',
      computedStatus: 'done', computedStatusLabel: 'Done', title: 'Service', notes: '', assignedFieldManagerId: null, assignedName: '',
      dueDate: null, dueUsage: 14000, usageMetric: 'hours', currentUsage: null, remainingUsage: null, daysUntilDue: null,
      alertBeforeValue: null, alertBeforeUnit: null, recurringEnabled: false, recurringIntervalValue: null, recurringIntervalUnit: null,
      generatedFromMaintenanceId: null, sourceScanEventId: 'scan-1', completedAtIso: '2026-08-25T08:00:00.000Z', completedUsage: 14056,
      completedNotes: 'Serviced\nCompany: Example Service\nMechanic: Alex', completedBy: 'Gerald',
      sourcePhotoUrls: ['https://example.com/photo-1.jpg', 'https://example.com/photo-2.jpg'], sourceLatitude: -34.024051,
      sourceLongitude: 22.383678, sourceLocationText: 'Workshop', alertNotedAtIso: null,
      createdAtIso: '2026-08-25T08:00:00.000Z', updatedAtIso: '2026-08-25T08:00:00.000Z',
    }],
    xlsxUrl: '',
  });

  const sheet = workbook[0];
  const headers = sheet.rows[21].map((cell) => String(cell.value ?? ''));
  const values = sheet.rows[22].map((cell) => cell.value);
  assert.equal(headers.length, 23);
  assert.ok(headers.includes('Recorded Location'));
  assert.ok(headers.includes('Photo Evidence URLs'));
  assert.ok(values.includes('Workshop'));
  assert.ok(values.includes(2));
  assert.ok(values.includes('https://example.com/photo-1.jpg\nhttps://example.com/photo-2.jpg'));
});
