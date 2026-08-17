import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const reportRoute = read('app/api/fuel/report/route.ts');
const fuelLedger = read('lib/fuel-ledger.ts');
const fuelIssueRoute = read('app/api/fuel-scan/storage/[publicFuelStorageCode]/issue/route.ts');

function loadReportHelpers() {
  const start = reportRoute.indexOf('type ReportFormat');
  const end = reportRoute.indexOf('function styled(');
  assert.notEqual(start, -1, 'report helper start marker must exist');
  assert.notEqual(end, -1, 'report helper end marker must exist');

  const helperSource = `${reportRoute.slice(start, end)}\nmodule.exports = { buildReportHtml, calculateAssetDieselBeforeFill, eventIssuedDateTime, eventWorkActivityLabel, eventWorkAreaLabel, renderFuelEventTable };`;
  const output = ts.transpileModule(helperSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: 'fuel-report-helpers.ts',
  }).outputText;
  const compiled = { exports: {} };
  Function('module', 'exports', output)(compiled, compiled.exports);
  return compiled.exports;
}

const helpers = loadReportHelpers();

function fuelEvent(overrides = {}) {
  return {
    id: 'event-1',
    storageId: 'storage-1',
    storageName: 'Main Diesel Tank',
    storagePublicCode: 'FUEL-ONE',
    eventType: 'asset_issue',
    sourceType: '',
    sourceLabel: '',
    fuelSlipId: '',
    fuelSlipTargetType: '',
    fuelSlipSupplierName: '',
    fuelSlipFuelType: '',
    fuelSlipDocumentDate: '',
    fuelSlipDocumentTime: '',
    fuelSlipExtractionStatus: '',
    fuelSlipReviewRequired: false,
    fuelSlipReviewStatus: '',
    totalAmount: null,
    documentFileUrl: '',
    paymentMethod: '',
    cardNumberMasked: '',
    assetId: 'asset-1',
    assetTitle: '2023 Toyota Hilux Single Cab',
    assetPlateLabel: '',
    litres: 60.3,
    storageLevelBefore: 2108.6,
    storageLevelAfter: 2048.3,
    assetFuelPercentBefore: 25,
    assetFuelPercentAfter: 100,
    assetUsageReading: 111683,
    assetUsageMetric: 'km',
    operatorName: 'Gerald',
    activityText: 'Transport workers to town',
    workAreaText: 'Skimmelkrans Boerdery',
    note: 'Verified fuel movement',
    latitude: -34.024051,
    longitude: 22.383678,
    locationText: '',
    isLateEntry: false,
    issueDate: '2026-08-15',
    issueTime: '16:49',
    issueTimeRecorded: true,
    issueAtIso: '2026-08-15T14:49:00.000Z',
    entryAddedAtIso: '2026-08-15T14:49:00.000Z',
    addedByUserId: 'user-1',
    addedByName: 'Gerald',
    addedByEmail: '',
    lateEntryReason: '',
    evidenceType: '',
    evidenceReference: '',
    evidenceStatus: '',
    evidenceFileName: '',
    evidenceFileUrl: '',
    tankBalanceTreatment: '',
    linkedAdjustmentEventId: '',
    linkedMissingEntryEventId: '',
    adjustmentKind: '',
    idempotencyKey: '',
    gpsCaptureStatus: 'captured',
    createdAtIso: '2026-08-15T14:49:00.000Z',
    ...overrides,
  };
}

test('litres before fill uses the captured gauge increase', () => {
  assert.equal(helpers.calculateAssetDieselBeforeFill(fuelEvent()), 20.1);
  assert.equal(helpers.calculateAssetDieselBeforeFill(fuelEvent({ litres: 70, assetFuelPercentBefore: 10 })), 7.778);
  assert.equal(helpers.calculateAssetDieselBeforeFill(fuelEvent({ assetFuelPercentBefore: 100, assetFuelPercentAfter: 100 })), null);
  assert.equal(helpers.calculateAssetDieselBeforeFill(fuelEvent({ assetFuelPercentBefore: null })), null);
});

test('PDF fuel entries use ten readable columns and preserve every detail underneath', () => {
  const html = helpers.renderFuelEventTable([
    fuelEvent(),
    fuelEvent({
      id: 'event-2',
      isLateEntry: true,
      issueDate: '2026-07-01',
      issueTimeRecorded: false,
      entryAddedAtIso: '2026-08-16T08:15:00.000Z',
      lateEntryReason: 'Paper log captured later',
      evidenceStatus: 'evidence_supplied_review_required',
      tankBalanceTreatment: 'already_reflected',
    }),
  ]);

  assert.equal((html.match(/<th>/g) ?? []).length, 10);
  assert.equal((html.match(/class="assetReportFuelEventGroup"/g) ?? []).length, 2);
  assert.equal((html.match(/colspan="10"/g) ?? []).length, 2);
  assert.match(html, /Storage Balance/);
  assert.match(html, /2[\s,]?108[,.]6 L to 2[\s,]?048[,.]3 L/);
  assert.match(html, /25% to 100%/);
  assert.match(html, /Transport workers to town/);
  assert.match(html, /Skimmelkrans Boerdery/);
  assert.match(html, /GPS -34\.024051, 22\.383678/);
  assert.match(html, /Paper log captured later/);
  assert.match(html, /Evidence supplied/);
  assert.match(html, /Already reflected/);
});

test('fuel-slip entries use the document date rather than the later upload date', () => {
  const event = fuelEvent({
    sourceType: 'fuel_slip',
    fuelSlipDocumentDate: '2026-08-10',
    fuelSlipDocumentTime: '08:30',
    createdAtIso: '2026-08-17T12:00:00.000Z',
    entryAddedAtIso: '2026-08-17T12:00:00.000Z',
  });

  assert.match(helpers.eventIssuedDateTime(event), /10 Aug 2026/);
  assert.match(helpers.eventIssuedDateTime(event), /08:30/);
  assert.doesNotMatch(helpers.eventIssuedDateTime(event), /17 Aug 2026/);
  assert.match(helpers.renderFuelEventTable([event]), /Entry Added On/);
  assert.match(helpers.renderFuelEventTable([event]), /17 Aug 2026/);
});

test('fuel-slip activity and work-area columns contain the fields named by their headers', () => {
  const event = fuelEvent({
    sourceType: 'fuel_slip',
    fuelSlipSupplierName: 'Example Fuel Supplier',
    fuelSlipFuelType: 'diesel',
    activityText: 'Planting',
    workAreaText: 'Block S2',
  });

  assert.equal(helpers.eventWorkActivityLabel(event), 'Planting');
  assert.equal(helpers.eventWorkAreaLabel(event), 'Block S2');
});

test('complete reports are not silently capped and scan responses stay intentionally small', () => {
  assert.ok(fuelLedger.includes('const limit = options.limit === undefined ? null'));
  assert.ok(fuelLedger.includes('return limit === null ? sortedEvents : sortedEvents.slice(0, limit)'));
  assert.ok(fuelLedger.includes("const eventDateExpression = `coalesce(${fuelSlipReportDateSql('fs')}, e.issue_at, e.created_at)`"));
  assert.match(fuelLedger, /filter \+= ` and \$\{eventDateExpression\} >=/);
  assert.match(fuelLedger, /filter \+= ` and \$\{eventDateExpression\} </);
  assert.match(fuelIssueRoute, /storageId: access\.storage\.id,\s+limit: 20,/);
  assert.doesNotMatch(fuelIssueRoute, /recentEvents\.slice\(0, 20\)/);
});

test('the printable report does not claim a false one-page count', () => {
  const html = helpers.buildReportHtml({
    title: 'Fuel Ledger Report',
    subtitle: 'All fuel movements.',
    generatedAt: '17 Aug 2026, 14:50',
    ownerEmail: 'owner@example.com',
    ownerDetails: {
      businessName: 'Example Farm',
      contactDetails: '012 345 6789',
      businessEmail: 'owner@example.com',
      locationAddress: 'George, Western Cape',
    },
    logoUrl: '',
    dateRangeLabel: 'All available entries',
    storageName: 'All storage units + slips',
    storageCode: 'All storage QR codes + slips',
    storageFuelType: 'All fuel types',
    totalIssued: 60.3,
    totalStockIn: 0,
    currentLitres: 2048.3,
    storageCount: 1,
    eventCount: 1,
    events: [fuelEvent()],
    xlsxUrl: '/api/fuel/report?format=xlsx',
  });

  assert.doesNotMatch(html, /Page 1 of 1/);
  assert.match(html, /Complete fuel ledger/);
  assert.doesNotMatch(html, /nth-child\((?:1[1-9]|[2-9][0-9])\)/);
  assert.match(html, /page-break-inside: avoid/);
});
