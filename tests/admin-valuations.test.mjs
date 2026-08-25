import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  formatAdminValuationDateTime,
  formatAdminValuationMoney,
} from '../lib/admin-valuations-shared.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const page = read('app/admin/valuations/page.tsx');
const client = read('app/admin/valuations/admin-valuations-client.tsx');
const api = read('app/api/admin/valuations/route.ts');
const data = read('lib/admin-valuations.ts');
const eventLogger = read('lib/admin-valuation-events.ts');
const genericRoute = read('app/api/generic-valuations/route.ts');
const tractorRoute = read('app/api/tractor-valuations/route.ts');
const navigation = read('components/AdminNavigation.tsx');
const dashboard = read('lib/admin-dashboard.ts');
const dashboardPage = read('app/admin/dashboard/page.tsx');

test('Admin Valuations page and API independently require Admin access', () => {
  assert.match(page, /await requireAdminPageAccess\(\)/);
  assert.match(api, /await requireAdminApiAccess\(\)/);
  assert.match(page, /AdminNavigation active="valuations"/);
  assert.match(page, /Every completed estimate and saved valuation/);
});

test('the valuation history combines every estimate event and saved valuation run', () => {
  assert.match(data, /from public\.admin_usage_events event/);
  assert.match(data, /event\.event_type = 'free_estimate_completed'/);
  assert.match(data, /from public\.valuation_runs valuation/);
  assert.match(data, /select \* from free_estimate_rows\s+union all\s+select \* from saved_valuation_rows/);
  assert.match(data, /valuation_payload/);
});

test('account details resolve when available and remain explicitly unknown for guests', () => {
  assert.match(data, /left join public\.account_profiles profile/);
  assert.match(data, /left join public\."user" auth_user/);
  assert.match(data, /'Unknown \/ guest'/);
  assert.match(data, /history\.account_user_id is not null/);
  assert.match(client, /No account attached/);
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
  assert.match(client, /Asset, account, email, input or reference/);
  assert.match(client, /Rows per page/);
});

test('new free estimates retain normalized inputs and calculated outputs', () => {
  assert.match(eventLogger, /metadata: \{\s*valuationMode: event\.valuationMode,\s*input: event\.input,\s*output: event\.output/);
  assert.match(eventLogger, /recordTractorValuationForAdminSafely/);
  assert.match(eventLogger, /recordGenericValuationForAdminSafely/);
  assert.match(eventLogger, /selectedValueExVat: result\.aim4priceValueExVat/);
  assert.match(eventLogger, /specsJson: result\.specsJson/);
  assert.match(genericRoute, /recordGenericValuationForAdminSafely\(\{\s*userId: await getUsageUserId\(\),\s*result/);
  assert.match(tractorRoute, /recordTractorValuationForAdminSafely\(\{\s*userId: await getUsageUserId\(\),\s*valuationInput: input,\s*result/);
});

test('the detail modal exposes who, when, inputs and estimate output', () => {
  assert.match(client, /role="dialog"/);
  assert.match(client, /Who and when/);
  assert.match(client, /What was estimated/);
  assert.match(client, /Inputs recorded/);
  assert.match(client, /Estimate output/);
  assert.match(client, /keepFocusInsideDetails/);
  assert.match(client, /older free-estimate events show only the fields that were recorded/);
});

test('Valuations is available in the consolidated Admin Manage menu', () => {
  assert.match(navigation, /href: "\/admin\/valuations"/);
  assert.match(navigation, /label: "Valuations"/);
  assert.match(navigation, /Review every estimate, input, result and account/);
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
