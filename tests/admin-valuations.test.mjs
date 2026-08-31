import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ADMIN_VALUATION_DELETE_LIMIT,
  ADMIN_VALUATION_HISTORY_START_ISO,
  buildAdminValuationInputSections,
  buildAdminValuationOutputSections,
  formatAdminValuationDetailValue,
  formatAdminValuationDateTime,
  formatAdminValuationMoney,
  normalizeAdminValuationDeleteIds,
} from '../lib/admin-valuations-shared.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const page = read('app/admin/valuations/page.tsx');
const client = read('app/admin/valuations/admin-valuations-client.tsx');
const api = read('app/api/admin/valuations/route.ts');
const data = read('lib/admin-valuations.ts');
const eventLogger = read('lib/admin-valuation-events.ts');
const genericRoute = read('app/api/generic-valuations/route.ts');
const tractorRoute = read('app/api/tractor-valuations/route.ts');
const valuationRunsRoute = read('app/api/valuation-runs/route.ts');
const valuationRuns = read('lib/valuation-runs.ts');
const valuationFlow = read('app/valuation/valuation-client.tsx');
const navigation = read('components/AdminNavigation.tsx');
const dashboard = read('lib/admin-dashboard.ts');
const dashboardPage = read('app/admin/dashboard/page.tsx');
const resetMigration = read('database/migrations/92-reset-admin-valuation-history.sql');

test('Admin Valuations page and API independently require Admin access', () => {
  assert.match(page, /await requireAdminPageAccess\(\)/);
  assert.match(api, /await requireAdminApiAccess\(\)/);
  assert.match(page, /AdminNavigation active="valuations"/);
  assert.match(page, /<h1>Valuations<\/h1>/);
  assert.doesNotMatch(page, /Every completed estimate and saved valuation/);
});

test('the valuation history combines every estimate event and saved valuation run', () => {
  assert.match(data, /from public\.admin_usage_events event/);
  assert.match(data, /event\.event_type = 'free_estimate_completed'/);
  assert.match(data, /from public\.valuation_runs valuation/);
  assert.match(data, /select \* from free_estimate_rows\s+union all\s+select \* from saved_valuation_rows/);
  assert.match(data, /valuation_payload/);
  assert.match(data, /left join public\.equipment_models event_model/);
  assert.match(data, /event_document\.metadata #>> '\{output,model,modelName\}'/);
});

test('account details resolve when available and remain explicitly unknown for guests', () => {
  assert.match(data, /left join public\.account_profiles profile/);
  assert.match(data, /left join public\."user" auth_user/);
  assert.match(data, /'Unknown \/ guest'/);
  assert.match(data, /history\.account_user_id is not null/);
  assert.match(client, /Unknown \/ guest/);
  assert.match(client, /Open account/);
});

test('Admin Valuations supports server search, filters, sorting and pagination', () => {
  assert.match(data, /input_json::text, output_json::text/);
  assert.match(data, /record_type = \$\$\{params\.length\}/);
  assert.match(data, /valuation_mode = \$\$\{params\.length\}/);
  assert.match(data, /created_at >= now\(\) - interval '30 days'/);
  assert.match(data, /group by valuation_year/);
  assert.match(data, /limit \$\{limitParameter\}/);
  assert.match(data, /offset \$\{offsetParameter\}/);
  assert.match(client, /Asset, account, email or reference/);
  assert.match(client, /Rows per page/);
});

test('new free estimates retain normalized inputs and calculated outputs', () => {
  assert.match(eventLogger, /captureVersion: 2/);
  assert.match(eventLogger, /captureScope: 'complete-estimate-flow'/);
  assert.match(eventLogger, /metadata: \{[\s\S]*valuationMode: event\.valuationMode,[\s\S]*input: event\.input,[\s\S]*output: event\.output/);
  assert.match(eventLogger, /recordTractorValuationForAdminSafely/);
  assert.match(eventLogger, /recordGenericValuationForAdminSafely/);
  assert.match(eventLogger, /output: \{\s*\.\.\.result/);
  assert.match(eventLogger, /selectedValueExVat: result\.aim4priceValueExVat/);
  assert.match(eventLogger, /const specs = valuation\.specsJson \?\? result\.specsJson/);
  assert.match(genericRoute, /const valuationInput: GenericValuationInput/);
  assert.match(genericRoute, /recordGenericValuationForAdminSafely\(\{\s*userId: await getUsageUserId\(\),\s*valuationInput,\s*result/);
  assert.match(tractorRoute, /recordTractorValuationForAdminSafely\(\{\s*userId: await getUsageUserId\(\),\s*valuationInput: input,\s*result/);
});

test('tractor estimates retain the usage path and percentage originally entered', () => {
  assert.match(valuationFlow, /function getTractorUsageRequestFields\(\)/);
  assert.match(valuationFlow, /usageMode: usageNumber !== null \? 'hours' : 'percent'/);
  assert.match(valuationFlow, /lifeWorkedPercent: usageNumber === null \? lifeWorkedPercentNumber : null/);
  assert.match(tractorRoute, /lifeWorkedPercent: normalizeLifeWorkedPercent/);
  assert.match(valuationRunsRoute, /usageMode: normalizeTractorUsageMode/);
  assert.match(valuationRuns, /lifeWorkedPercent: input\.lifeWorkedPercent \?\? null/);
  assert.match(data, /\) = 'percent' then coalesce\([\s\S]*lifeWorkedPercent/);
});

test('the detail modal exposes the record, asset and full estimate flow', () => {
  assert.match(client, /role="dialog"/);
  assert.match(client, /<h3>Record<\/h3>/);
  assert.match(client, /<h3>Asset<\/h3>/);
  assert.match(client, />Inputs<\/h3>/);
  assert.match(client, />Calculation<\/h3>/);
  assert.match(client, /buildAdminValuationInputSections/);
  assert.match(client, /buildAdminValuationOutputSections/);
  assert.doesNotMatch(client, /fields<\/span>/);
  assert.match(client, /keepFocusInsideDetails/);
  assert.doesNotMatch(client, /Fresh valuation history from 26 August 2026/);
});

test('the valuation ledger restarts at a fixed cutoff without hiding future records', () => {
  assert.equal(ADMIN_VALUATION_HISTORY_START_ISO, '2026-08-26T00:00:00.000Z');
  assert.match(data, /event\.created_at >= \$\{ADMIN_VALUATION_HISTORY_START_SQL\}/);
  assert.match(data, /valuation\.created_at >= \$\{ADMIN_VALUATION_HISTORY_START_SQL\}/);
  assert.match(resetMigration, /reset_cutoff constant timestamptz := timestamptz '2026-08-26 02:00:00\+02'/);
  assert.match(resetMigration, /delete from public\.admin_usage_events[\s\S]*event_type = 'free_estimate_completed'[\s\S]*created_at < reset_cutoff/);
  assert.match(resetMigration, /delete from public\.valuation_runs[\s\S]*created_at < reset_cutoff/);
  assert.match(resetMigration, /set valuation_run_id = null/);
  assert.match(resetMigration, /'admin_valuation_history_reset'/);
});

test('single and bulk valuation deletion use validated prefixed record IDs', () => {
  assert.deepEqual(
    normalizeAdminValuationDeleteIds(['estimate:12', 'saved:7', 'estimate:12']),
    ['estimate:12', 'saved:7'],
  );
  assert.throws(
    () => normalizeAdminValuationDeleteIds([]),
    /ADMIN_VALUATION_DELETE_IDS_REQUIRED/,
  );
  assert.throws(
    () => normalizeAdminValuationDeleteIds(['free_estimate_completed:1']),
    /ADMIN_VALUATION_DELETE_ID_INVALID/,
  );
  assert.throws(
    () => normalizeAdminValuationDeleteIds(
      Array.from({ length: ADMIN_VALUATION_DELETE_LIMIT + 1 }, (_, index) => `estimate:${index + 1}`),
    ),
    /ADMIN_VALUATION_DELETE_LIMIT_EXCEEDED/,
  );

  assert.match(api, /export async function DELETE\(request: NextRequest\)/);
  assert.match(api, /valuationIds: body\.valuationIds/);
  assert.match(data, /delete from public\.admin_usage_events[\s\S]*event_type = 'free_estimate_completed'/);
  assert.match(data, /delete from public\.valuation_runs/);
  assert.match(data, /clearValuationRunReferences/);
  assert.match(data, /'admin_valuation_records_deleted'/);
  assert.match(client, /Delete selected/);
  assert.match(client, />\s*Delete\s*</);
  assert.match(client, /Type DELETE to confirm/);
  assert.match(client, /Delete permanently/);
  assert.match(client, /Select all valuations on this page/);
});

test('flow detail helpers show entered fields in order and format usage correctly', () => {
  const valuation = {
    id: 'estimate:42',
    sourceId: '42',
    recordType: 'estimate',
    valuationMode: 'tractor',
    source: 'tractor-valuations',
    createdAtIso: '2026-08-26T12:00:00.000Z',
    account: {
      userId: null,
      known: false,
      label: 'Unknown / guest',
      name: '',
      businessName: '',
      email: '',
      accountType: '',
      accountStatus: '',
    },
    asset: {
      sectorKey: 'agricultural',
      sectorLabel: 'Agricultural',
      familyKey: 'tractors',
      familyLabel: 'Tractors',
      brandName: 'John Deere',
      modelName: '6155M',
      yearModel: 2020,
      condition: 'good',
      usageAmount: 42,
      usageUnit: 'percent',
    },
    estimate: {
      selectedValueExVat: 850000,
      lowValueExVat: 800000,
      midValueExVat: 850000,
      highValueExVat: 900000,
      replacementPriceExVat: 1900000,
      confidenceLabel: 'Medium',
    },
    input: {
      modelId: '123',
      year: 2020,
      usageMode: 'percent',
      hours: 5880,
      lifeWorkedPercent: 42,
      condition: 'good',
      frontPto: false,
      frontLoader: true,
      frontLoaderYear: 2021,
      frontLoaderReplacementPriceExVat: 180000,
      specsJson: { power_kw: 115, cab_type: 'cab' },
      advancedAssumptions: {
        maxLifetimeUsage: 14000,
        popularityStars: 4,
        dealerAssessment: {
          mechanicalCondition: 'good',
          bodyCondition: 'average',
          tyreCondition: '50_75',
          serviceHistory: 'complete_verified',
          requiredWork: 'minor',
          conditionFactorPercent: 82.5,
        },
      },
    },
    output: {
      selectedValueExVat: 850000,
      replacementPriceUsedExVat: 1900000,
      lifeWorkedPercent: 42,
      marketSources: [{ title: 'Comparable one', advertisedPriceExVat: 875000 }],
      notes: ['Detailed assessment applied'],
    },
  };

  const inputSections = buildAdminValuationInputSections(valuation);
  const allInputRows = inputSections.flatMap((section) => section.rows);
  assert.deepEqual(inputSections.slice(0, 4).map((section) => section.title), [
    '1. Asset selection',
    '2. Asset specifications',
    '3. Usage and condition',
    '4. Replacement pricing and extras',
  ]);
  assert.equal(allInputRows.find((row) => row.label === 'Usage entered')?.value, '42% worked');
  assert.equal(allInputRows.find((row) => row.label === 'Mechanical condition')?.value, 'Good');
  assert.equal(allInputRows.find((row) => row.label === 'Tyres / wear components')?.value, '50-75%');
  assert.equal(allInputRows.find((row) => row.label === 'Front PTO selected')?.value, 'No');
  assert.match(allInputRows.find((row) => row.label === 'Front Loader replacement price excl. VAT')?.value ?? '', /180/);

  const outputSections = buildAdminValuationOutputSections(valuation);
  const outputRows = outputSections.flatMap((section) => section.rows);
  assert.ok(outputRows.some((row) => row.value === 'Comparable one'));
  assert.ok(outputRows.some((row) => row.value === 'Detailed assessment applied'));
  assert.equal(formatAdminValuationDetailValue(5880, ['usageAmount']).startsWith('R'), false);
  assert.equal(formatAdminValuationDetailValue(850000, ['selectedValueExVat']).startsWith('R'), true);
  assert.match(formatAdminValuationDetailValue(42, ['lifeWorkedPercent']), /42.*%/);
});

test('Valuations is available in the consolidated Admin Manage menu', () => {
  assert.match(navigation, /href: "\/admin\/valuations"/);
  assert.match(navigation, /label: "Valuations"/);
  assert.doesNotMatch(navigation, /description:/);
  assert.match(dashboard, /href: '\/admin\/valuations\?type=estimate'/);
  assert.match(dashboard, /href: '\/admin\/valuations\?type=saved'/);
  assert.match(dashboardPage, /card\.linkLabel/);
});

test('valuation helpers preserve safe defaults and South African display formatting', () => {
  assert.equal(formatAdminValuationMoney(null), 'Not recorded');
  assert.match(formatAdminValuationMoney(850000), /850[\s,]?000/);
  assert.notEqual(formatAdminValuationDateTime('2026-08-25T21:30:00.000Z'), 'Not recorded');
  assert.match(data, /function normalizeAdminValuationFilters/);
  assert.match(data, /ADMIN_VALUATION_PAGE_SIZES\.includes/);
});
