import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import reportTheme from './helpers/report-theme.cjs';
const { REPORT_THEME_CSS } = reportTheme;

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const reportRoute = read('lib/fuel-report.ts') + read('app/api/fuel/report/route.ts');
const fuelLedger = read('lib/fuel-ledger.ts');
const fuelIssueRoute = read('app/api/fuel-scan/storage/[publicFuelStorageCode]/issue/route.ts');

function loadReportHelpers() {
  const start = reportRoute.indexOf('type ReportFormat');
  const end = reportRoute.indexOf('function styled(');
  assert.notEqual(start, -1, 'report helper start marker must exist');
  assert.notEqual(end, -1, 'report helper end marker must exist');

  const helperSource = `${reportRoute.slice(start, end)}\nmodule.exports = { buildReportHtml, calculateAssetDieselBeforeFill, eventIssuedDateTime, eventWorkActivityLabel, eventWorkAreaLabel, renderFuelEventTable, eventGaugeIncrease, assetDieselBeforeFillFormula };`;
  const output = ts.transpileModule(helperSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: 'fuel-report-helpers.ts',
  }).outputText;
  const compiled = { exports: {} };
  Function('module', 'exports', 'REPORT_THEME_CSS', output)(compiled, compiled.exports, REPORT_THEME_CSS);
  return compiled.exports;
}

const helpers = loadReportHelpers();

test('fuel report retains the actual activity and never substitutes the supplier for a missing work area', () => {
  const event = fuelEvent({ sourceType: 'fuel_slip', fuelSlipSupplierName: 'Engen George', activityText: 'Delivering feed to Farm A', workAreaText: '' });
  assert.equal(helpers.eventWorkActivityLabel(event), 'Delivering feed to Farm A');
  assert.equal(helpers.eventWorkAreaLabel(event), '-');
});

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
    assetPlateLabel: 'A4P-001218',
    assetSerialNumber: 'VIN-TEST-12345',
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
    workUseExcluded: false,
    workUseExclusionReason: '',
    createdAtIso: '2026-08-15T14:49:00.000Z',
    ...overrides,
  };
}

test('litres before fill uses the captured gauge increase', () => {
  assert.equal(helpers.calculateAssetDieselBeforeFill(fuelEvent()), 20.1);
  assert.equal(helpers.calculateAssetDieselBeforeFill(fuelEvent({ litres: 70, assetFuelPercentBefore: 10 })), 7.778);
  assert.equal(helpers.calculateAssetDieselBeforeFill(fuelEvent({ assetFuelPercentBefore: 100, assetFuelPercentAfter: 100 })), null);
  assert.equal(helpers.calculateAssetDieselBeforeFill(fuelEvent({ assetFuelPercentBefore: null })), null);
  assert.equal(helpers.calculateAssetDieselBeforeFill(fuelEvent({ assetFuelPercentAfter: 75 })), null);
  assert.equal(helpers.calculateAssetDieselBeforeFill(fuelEvent({ assetFuelPercentBefore: -10 })), null);
  assert.equal(helpers.calculateAssetDieselBeforeFill(fuelEvent({ litres: 0 })), null);
});

test('PDF fuel entries use seven readable columns and preserve every detail underneath', () => {
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

  assert.equal((html.match(/<th>/g) ?? []).length, 7);
  assert.equal((html.match(/class="assetReportFuelEventGroup"/g) ?? []).length, 2);
  assert.equal((html.match(/colspan="7"/g) ?? []).length, 4);
  assert.equal((html.match(/class="assetReportFuelIdentityRow"/g) ?? []).length, 2);
  assert.match(html, /Serial \/ VIN: <b>VIN-TEST-12345<\/b>/);
  assert.match(html, /Register \/ plate ID: <b>A4P-001218<\/b>/);
  assert.match(html, /Storage balance/);
  assert.match(html, /2[\s,]?108[,.]6 L to 2[\s,]?048[,.]3 L/);
  assert.match(html, /25% to 100%/);
  assert.match(html, /75% · Filled to full/);
  assert.match(html, /Estimated fuel remaining before refill/);
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

test('work-use exclusions stay visible without changing physical litres', () => {
  const event = fuelEvent({
    litres: 42.5,
    workUseExcluded: true,
    workUseExclusionReason: 'Generator serving normal houses',
  });
  const html = helpers.renderFuelEventTable([event]);

  assert.match(html, /42[,.]5 L/);
  assert.match(html, /Excluded from work use/);
  assert.match(html, /Generator serving normal houses/);
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
    totalWorkUseIssued: 60.3,
    totalExcludedIssued: 0,
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
  assert.match(html, /Work-use Recorded/);
  assert.match(html, /not, by itself, a tax determination/);
});


test('each identity stays inside its own entry and escapes missing or unsafe identifiers', () => {
  const html = helpers.renderFuelEventTable([
    fuelEvent({assetTitle:'Tractor One',assetSerialNumber:'VIN<one>',activityText:'Plant maize'}),
    fuelEvent({assetTitle:'Tractor Two',assetSerialNumber:'',activityText:'Spray field'}),
  ]);
  const groups = html.match(/<tbody[\s\S]*?<\/tbody>/g);
  assert.match(groups[0], /Tractor One/);
  assert.match(groups[0], /VIN&lt;one&gt;/);
  assert.match(groups[0], /Plant maize/);
  assert.doesNotMatch(groups[0], /Tractor Two|Spray field/);
  assert.match(groups[1], /Serial \/ VIN: <b>Not recorded/);
  assert.match(groups[1], /Tractor Two/);
});


test('gauge increases use percent labels for full and partial fills and omit invalid readings', () => {
  assert.equal(helpers.eventGaugeIncrease(fuelEvent()), '75% · Filled to full');
  assert.equal(helpers.eventGaugeIncrease(fuelEvent({assetFuelPercentBefore: 25, assetFuelPercentAfter: 75})), '50% · Partial fill');
  for (const values of [{assetFuelPercentBefore: null}, {assetFuelPercentAfter: 101}, {assetFuelPercentBefore: 80, assetFuelPercentAfter: 75}]) {
    assert.equal(helpers.eventGaugeIncrease(fuelEvent(values)), '');
  }
});

test('Excel remaining-fuel estimate uses fractional percentage cells and the same ratio as PDF', () => {
  const formula = helpers.assetDieselBeforeFillFormula(8);
  assert.match(formula, /L8<1,M8=1/);
  assert.doesNotMatch(formula, /[LM]8[<=>]100/);
  assert.match(formula, /ROUND\(F8\*L8\/\(M8-L8\),3\)/);
  const litres = 60.3, before = 0.25, after = 1;
  assert.equal(Math.round(litres * before / (after - before) * 1000) / 1000,
    helpers.calculateAssetDieselBeforeFill(fuelEvent()));
});

test('recorded issue dates remain distinct without late-entry labels', () => {
  const html = helpers.renderFuelEventTable([fuelEvent({ isLateEntry: true, latitude: null, longitude: null, issueDate: '2026-07-01', issueTimeRecorded: false, entryAddedAtIso: '2026-08-16T08:15:00.000Z', lateEntryReason: 'Paper log captured later' })]);
  assert.doesNotMatch(html, /late[ -]entr/i);
  assert.match(html, /2026-07-01/);
  assert.match(html, /16 Aug 2026/);
  assert.match(html, /GPS not recorded/);
  assert.match(html, /Paper log captured later/);
});
