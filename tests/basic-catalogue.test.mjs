import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { resolveCatalogueGuide } from '../lib/basic-catalogue-guide.ts';
import {
  BASIC_REPLACEMENT_GUIDE_ROUNDING,
  BASIC_REPLACEMENT_SLIDER_STEP,
} from '../lib/basic-estimate.ts';
import { BASIC_USAGE_FAMILIES, getBasicUsageProfile } from '../lib/basic-usage-profiles.ts';

const release = 'basic_ballpark_20260907_v1';
const root = resolve(import.meta.dirname, '..');
const nativeRequire = createRequire(import.meta.url);

function loadActualFunctions(path, names) {
  const source = readFileSync(resolve(root, path), 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const selected = ast.statements.filter((s) => ts.isFunctionDeclaration(s) && names.includes(s.name?.text));
  assert.equal(selected.length, names.length);
  const code = selected.map((s) => s.getText(ast)).join('\n') + `\nexports.helpers = {${names.join(',')}};`;
  const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInThisContext(`(function(exports){${compiled}})`)(exports);
  return exports.helpers;
}

// Run the actual catalogue reader, shared calculation and save function against
// a query double. Unexpected legacy lookups or writes fail immediately.
function harness({ available = true, brandAvailable = true, familyKey = 'compact_tractor', sectorKey = 'agricultural' } = {}) {
  const queries = [];
  const row = { family_key: familyKey, label: 'Test family', group_key: 'test_group', group_label: 'Test group',
    sector_id: 1, sector_key: sectorKey, sector_label: 'Test sector', minimum_ex_vat: '100000',
    maximum_ex_vat: '750000', pricing_as_of: '2026-09-07', confidence: 'low' };
  const db = { async query(sql, values) {
    queries.push({ sql, values });
    if (sql.includes('from aim4price_basic.releases')) return { rows: available ? [{ '?column?': 1 }] : [] };
    if (sql.includes('from aim4price_basic.families')) return { rows: [row] };
    if (sql.startsWith('select id, slug, name from public.brands')) return { rows: brandAvailable ? [{ id: 10, slug: 'unknown', name: 'Unknown' }] : [] };
    if (/insert into (?:public\.)?valuation_runs/.test(sql)) return { rows: [{ id: 99, created_at: '2026-09-07T00:00:00Z' }] };
    throw new Error(`Unexpected query: ${sql}`);
  } };
  const cache = new Map();
  function load(file) {
    const filename = resolve(root, file);
    if (filename === resolve(root, 'lib/asset-register-db.ts')) return {};
    if (filename === resolve(root, 'lib/db.ts')) return { getDb: () => db };
    if (filename === resolve(root, 'lib/server-valuation.ts')) return { runServerValuation: () => { throw new Error('Unexpected tractor calculation'); } };
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    let compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    if (filename.endsWith('/asset-register-projection.ts')) compiled += '\nexports.projectUsage = calculateMotorProjection; exports.isPercentProjection = isPercentProjectionCandidate; exports.isMeterProjection = isMotorProjectionCandidate;';
    const require = (name) => name.startsWith('.')
      ? load(resolve(dirname(filename), name.endsWith('.ts') ? name : `${name}.ts`))
      : nativeRequire(name);
    vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(require, module, module.exports);
    return module.exports;
  }
  return { queries, row, ...load('lib/basic-catalogue.ts'), ...load('lib/generic-valuation.ts'), ...load('lib/valuation-runs.ts'), ...load('lib/asset-register-projection.ts') };
}

function input(overrides = {}) {
  return { sectorKey: 'agricultural', familyKey: 'compact_tractor', brandSlug: 'unknown', year: 2022,
    typedModelName: null, condition: 'good', lifeWorkedPercent: 40, usageAmount: null,
    userReplacementPriceExVat: 900000, saveModelCandidate: true,
    specsJson: { basic_estimate: true, basic_catalogue_release: release, basic_specification_level: 'standard',
      typed_brand_name: 'My brand', catalog_model_id: 123, basic_catalogue: { minimumExVat: 1 } },
    ...overrides };
}

test('Entry, Standard and Quality share clean R10k guide boundaries and a R5k slider step', () => {
  for (const [min, max] of [[100000, 750000], [0, 150000], [25000, 1200000], [9000000, 22000000]]) {
    const guides = ['entry', 'standard', 'premium'].map((level) => resolveCatalogueGuide({ minimumExVat: min, maximumExVat: max }, level));
    const expectedMin = Math.max(0, Math.round(min / BASIC_REPLACEMENT_GUIDE_ROUNDING) * BASIC_REPLACEMENT_GUIDE_ROUNDING);
    const expectedMax = Math.max(
      expectedMin + BASIC_REPLACEMENT_GUIDE_ROUNDING * 3,
      Math.round(max / BASIC_REPLACEMENT_GUIDE_ROUNDING) * BASIC_REPLACEMENT_GUIDE_ROUNDING,
    );

    assert.equal(guides[0].minExVat, expectedMin);
    assert.equal(guides[2].maxExVat, expectedMax);
    assert.equal(guides[0].maxExVat, guides[1].minExVat);
    assert.equal(guides[1].maxExVat, guides[2].minExVat);

    for (const guide of guides) {
      assert.ok(guide.maxExVat > guide.minExVat);
      assert.equal(guide.minExVat % BASIC_REPLACEMENT_GUIDE_ROUNDING, 0);
      assert.equal(guide.maxExVat % BASIC_REPLACEMENT_GUIDE_ROUNDING, 0);
      assert.equal(guide.suggestedExVat % BASIC_REPLACEMENT_GUIDE_ROUNDING, 0);
      assert.equal(guide.sliderStep, BASIC_REPLACEMENT_SLIDER_STEP);
      assert.ok(guide.suggestedExVat >= guide.minExVat && guide.suggestedExVat <= guide.maxExVat);
    }
  }
  assert.throws(() => resolveCatalogueGuide({ minimumExVat: 10, maximumExVat: 5 }, 'entry'));
  for (const invalid of ['luxury', '__proto__', 'constructor', null]) {
    assert.throws(() => resolveCatalogueGuide({ minimumExVat: 0, maximumExVat: 100 }, invalid));
  }
});

test('catalogue is disabled by default and rejects unavailable or different releases', async () => {
  delete process.env.AIM4PRICE_BASIC_CATALOGUE_RELEASE;
  const h = harness();
  await assert.rejects(h.listBasicCatalogueFamilies(null), /not enabled/);
  assert.equal(h.queries.length, 0);
  process.env.AIM4PRICE_BASIC_CATALOGUE_RELEASE = release;
  await assert.rejects(h.getBasicCatalogueFamily('agricultural', 'compact_tractor', 'wrong'), /Unknown/);
  await assert.rejects(harness({ available: false }).listBasicCatalogueFamilies(null), /unavailable/);
});

test('catalogue calculation keeps manual prices, optional models and server-sourced identity', async () => {
  process.env.AIM4PRICE_BASIC_CATALOGUE_RELEASE = release;
  const h = harness();
  const result = await h.runGenericValuation(input());
  assert.equal(result.family.id, null);
  assert.equal(result.family.key, 'compact_tractor');
  assert.equal(result.replacementPriceUsedExVat, 900000);
  assert.equal(result.replacementPriceMinExVat, 100000);
  assert.equal(result.replacementPriceMaxExVat, 750000);
  assert.equal(result.specsJson.basic_catalogue.minimumExVat, 100000);
  assert.equal(result.specsJson.catalog_model_id, undefined);
  assert.equal(result.typedModelName, null);
  assert.equal(result.usageAmount, null);
  assert.equal(result.maxLifetimeHours, null);
  assert.equal(result.estimatedHours, null);
  assert.equal(result.lifeWorkedPercent, 40);
  assert.equal(result.replacementPriceBand, null);
  assert.ok(result.genericEstimateExVat > 0);
  assert.ok(h.queries.every(({ sql }) => !/insert|update|delete/i.test(sql)));
});

test('all sectors retain explicit percentage fallback, including mounted and trailed families', async () => {
  process.env.AIM4PRICE_BASIC_CATALOGUE_RELEASE = release;
  for (const [sectorKey, familyKey] of [['agricultural', 'mounted_boom_sprayer'], ['agricultural', 'trailed_boom_sprayer'], ['construction', 'mini_excavator'], ['industrial', 'powered_pallet_truck'], ['motor', 'sedan_fastback']]) {
    const h = harness({ sectorKey, familyKey });
    const result = await h.runGenericValuation(input({ sectorKey, familyKey, typedModelName: 'Optional model' }));
    assert.equal(result.family.key, familyKey);
    assert.equal(result.specsJson.basic_usage_basis, 'percent');
    assert.equal(result.depreciationMethodUsed, 'percentage_depreciation');
    assert.equal(result.maxLifetimeHours, null);
    assert.equal(result.typedModelName, 'Optional model');
  }
});

test('missing family, brand, replacement or life worked cannot silently use a default', async () => {
  process.env.AIM4PRICE_BASIC_CATALOGUE_RELEASE = release;
  await assert.rejects(harness().runGenericValuation(input({ familyKey: 'missing' })), /family not found/);
  await assert.rejects(harness({ brandAvailable: false }).runGenericValuation(input()), /BRAND_NOT_FOUND/);
  for (const lifeWorkedPercent of [null, -1, 101, NaN]) {
    await assert.rejects(harness().runGenericValuation(input({ lifeWorkedPercent })), /life worked/);
  }
  await assert.rejects(harness().runGenericValuation(input({ userReplacementPriceExVat: 0 })), /positive replacement/);
  const result = await harness().runGenericValuation(input({ lifeWorkedPercent: 0 }));
  assert.equal(result.lifeWorkedPercent, 0);
});

test('save and recalculation preserve Basic identity without public family or price-band foreign keys', async () => {
  process.env.AIM4PRICE_BASIC_CATALOGUE_RELEASE = release;
  const h = harness();
  const result = await h.runGenericValuation(input());
  const saved = await h.saveGenericValuationRunFromResult({ result, selectedMethod: 'aim4price', userId: 'test-user' });
  assert.equal(saved.runId, 99);
  const insert = h.queries.find(({ sql }) => /insert into/.test(sql));
  assert.equal(insert.values[4], null, 'Basic family must not be an Advanced family FK');
  const snapshot = insert.values.filter((v) => typeof v === 'string' && v.includes('basic_catalogue_release')).map((v) => JSON.parse(v));
  assert.ok(snapshot.some((v) => v.basic_catalogue?.familyKey === 'compact_tractor'));
  const recalculated = await h.runGenericValuation(input({ specsJson: result.specsJson, userReplacementPriceExVat: 1200000 }));
  assert.equal(recalculated.family.key, result.family.key);
  assert.equal(recalculated.userReplacementPriceExVat, 1200000);
  assert.equal(recalculated.specsJson.basic_catalogue.releaseKey, release);
});

test('all 713 reviewed families have one positive, unit-consistent lifetime profile', () => {
  assert.equal(BASIC_USAGE_FAMILIES.length, 713);
  assert.equal(new Set(BASIC_USAGE_FAMILIES.map(([s, k]) => `${s}/${k}`)).size, 713);
  const counts = {};
  for (const [sector, key] of BASIC_USAGE_FAMILIES) {
    const p = getBasicUsageProfile(sector, key);
    counts[sector] = (counts[sector] ?? 0) + 1;
    assert.ok(Number.isFinite(p.expectedLifetime) && p.expectedLifetime > 0);
    assert.equal(p.lifetimeUnit, p.primaryMetric === 'percent' ? 'years' : p.primaryMetric);
    assert.equal(p.percentageFallback, true);
    assert.ok(Object.isFrozen(p));
  }
  assert.deepEqual(counts, { agricultural: 140, construction: 154, industrial: 275, motor: 144 });
  assert.throws(() => getBasicUsageProfile('motor', 'compact_tractor'), /not found/);
  assert.throws(() => getBasicUsageProfile('industrial', '__proto__'), /not found/);
  for (const key of ['mounted_boom_sprayer', 'trailed_boom_sprayer', 'tractor_front_loader']) {
    assert.equal(getBasicUsageProfile('agricultural', key).primaryMetric, 'percent');
  }
  assert.equal(getBasicUsageProfile('agricultural', 'self_propelled_sprayer').primaryMetric, 'hours');
  assert.equal(getBasicUsageProfile('motor', 'heavy_flatdeck_trailer').lifetimeUnit, 'years');
});

test('the actual UI parser accepts zero only for Basic and keeps blank input missing', () => {
  const { toNumberOrNull } = loadActualFunctions('app/valuation/valuation-client.tsx', ['normalizeText', 'parseFlexibleNumber', 'toNumberOrNull']);
  assert.equal(toNumberOrNull('0', true), 0);
  assert.equal(toNumberOrNull('0'), null, 'legacy callers retain their existing behaviour');
  assert.equal(toNumberOrNull('', true), null);
  assert.equal(toNumberOrNull('  ', true), null);
  assert.equal(toNumberOrNull('-1', true), null);
  assert.equal(toNumberOrNull('3 500', true), 3500);
  const client = readFileSync(resolve(root, 'app/valuation/valuation-client.tsx'), 'utf8');
  assert.equal((client.match(/toNumberOrNull\(usageAmount, Boolean\(selectedFamily\?\.basicCatalogue\)\)/g) ?? []).length, 3);
});

test('the API parser preserves Basic missing inputs and does not coerce booleans to readings', () => {
  const { normalizeUsageNumber } = loadActualFunctions('app/api/generic-valuations/route.ts', ['normalizeUsageNumber']);
  assert.equal(normalizeUsageNumber(null, true), null);
  assert.equal(normalizeUsageNumber(undefined, true), null);
  assert.equal(normalizeUsageNumber(0, true), 0);
  for (const value of ['', ' ', false, true, '3500']) assert.ok(Number.isNaN(normalizeUsageNumber(value, true)));
  assert.equal(normalizeUsageNumber('3500'), 3500, 'existing non-Basic coercion is unchanged');
});

test('meter calculations use the server profile in every sector and preserve zero readings', async () => {
  process.env.AIM4PRICE_BASIC_CATALOGUE_RELEASE = release;
  for (const [sectorKey, familyKey, unit, lifetime] of [
    ['agricultural', 'compact_tractor', 'hours', 8000],
    ['construction', 'mini_excavator', 'hours', 8000],
    ['industrial', 'electric_counterbalance_forklift', 'hours', 10000],
    ['motor', 'sedan_fastback', 'km', 300000],
    ['motor', 'utility_quad', 'hours', 3000],
  ]) {
    const h = harness({ sectorKey, familyKey });
    for (const ratio of [0, 0.5, 1.2]) {
      const r = await h.runGenericValuation(input({ sectorKey, familyKey, usageAmount: ratio * lifetime, lifeWorkedPercent: null }));
      assert.equal(r.depreciationMethodUsed, 'full_depreciation');
      assert.equal(r.usageAmount, ratio * lifetime);
      assert.equal(r.maxLifetimeHours, lifetime);
      assert.equal(r.lifeWorkedPercent, Math.min(100, ratio * 100));
      assert.equal(r.specsJson.usageMode, unit);
      assert.equal(r.specsJson.basic_usage_basis, 'reading');
      assert.ok(r.genericEstimateExVat >= 0);
    }
  }
});

test('invalid readings fail without silent zero or percentage defaults', async () => {
  process.env.AIM4PRICE_BASIC_CATALOGUE_RELEASE = release;
  const h = harness();
  for (const usageAmount of [null, undefined, '', '800', NaN, Infinity, -1]) {
    const i = input({ usageAmount, lifeWorkedPercent: null });
    i.specsJson.basic_usage_basis = 'reading';
    await assert.rejects(h.runGenericValuation(i), /non-negative/);
  }
  const unsupported = input();
  unsupported.specsJson.basic_usage_profile_version = 'unknown';
  await assert.rejects(h.runGenericValuation(unsupported), /version is unavailable/);
  await assert.rejects(harness({ familyKey: 'unknown' }).listBasicCatalogueFamilies('agricultural'), /profile not found/);
});

test('explicit reading clears stale modes and ignores a caller-supplied lifetime', async () => {
  process.env.AIM4PRICE_BASIC_CATALOGUE_RELEASE = release;
  const h = harness();
  const old = await h.runGenericValuation(input());
  const specsJson = { ...old.specsJson, basic_usage_basis: 'reading', selected_usage_mode: 'percent',
    max_lifetime_hours: 999999, basic_usage_profile: { expectedLifetime: 1 } };
  const r = await h.runGenericValuation(input({ specsJson, usageAmount: 4000, lifeWorkedPercent: 90 }));
  assert.equal(r.depreciationMethodUsed, 'full_depreciation');
  assert.equal(r.lifeWorkedPercent, 50);
  assert.equal(r.maxLifetimeHours, 8000);
  assert.equal(r.specsJson.basic_usage_profile.expectedLifetime, 8000);
  assert.equal(r.specsJson.selected_usage_mode, undefined);
  const again = await h.runGenericValuation(input({ specsJson: r.specsJson, usageAmount: r.usageAmount, lifeWorkedPercent: r.lifeWorkedPercent }));
  assert.equal(again.genericEstimateExVat, r.genericEstimateExVat);
  assert.equal(again.depreciationMethodUsed, 'full_depreciation');
  const fallback = await h.runGenericValuation(input({ specsJson: { ...r.specsJson, basic_usage_basis: 'percent' }, usageAmount: 4000, lifeWorkedPercent: 60 }));
  assert.equal(fallback.usageAmount, null);
  assert.equal(fallback.lifeWorkedPercent, 60);
  assert.equal(fallback.maxLifetimeHours, null);
});

test('existing saved percentage estimates remain percentage estimates after rollout', async () => {
  process.env.AIM4PRICE_BASIC_CATALOGUE_RELEASE = release;
  const i = input({ usageAmount: 4000 });
  i.specsJson.basic_calculation_profile = 'user_life_worked_v1';
  const r = await harness().runGenericValuation(i);
  assert.equal(r.depreciationMethodUsed, 'percentage_depreciation');
  assert.equal(r.lifeWorkedPercent, 40);
  assert.equal(r.usageAmount, null);
});

test('saved motor hours and future projections keep hours and the selected lifetime', async () => {
  process.env.AIM4PRICE_BASIC_CATALOGUE_RELEASE = release;
  for (const [sectorKey, familyKey] of [['motor', 'utility_quad'], ['construction', 'mini_excavator']]) {
    const h = harness({ sectorKey, familyKey });
    const r = await h.runGenericValuation(input({ sectorKey, familyKey, usageAmount: 500, lifeWorkedPercent: null }));
    await h.saveGenericValuationRunFromResult({ result: r, selectedMethod: 'aim4price', userId: 'test-user' });
    const insert = h.queries.find(({ sql }) => /insert into/.test(sql));
    const snapshots = insert.values.filter((v) => typeof v === 'string' && v.includes('basic_catalogue_release')).map((v) => JSON.parse(v));
    assert.ok(snapshots.some((v) => v.usageMode === 'hours' || v.input?.usageMode === 'hours'));
    const context = { asset: { id: 'asset', title: 'Test', kind: sectorKey === 'motor' ? 'vehicle' : 'equipment',
      specsJson: r.specsJson, hours: r.usageAmount, yearModel: r.year, maxLifetimeHours: r.maxLifetimeHours,
      condition: 'good', depreciationMethodUsed: r.depreciationMethodUsed, value: r.genericEstimateExVat },
      row: {}, valuationInput: {}, valuationOutput: r, selectedMethod: 'aim4price',
      currentRegisterValueExVat: r.genericEstimateExVat, baseYear: 2026, targetYear: 2027, inflationRatePct: 0,
      extraUsage: 100, targetCondition: 'good' };
    assert.equal(h.isPercentProjection(context), false, 'derived worked percentage cannot switch the projection mode');
    assert.equal(h.isMeterProjection(context), true);
    const projection = h.projectUsage(context);
    assert.equal(projection.usageMetric, 'hours');
    assert.equal(projection.extraUsage, 100);
  }
  const h = harness({ sectorKey: 'motor', familyKey: 'heavy_flatdeck_trailer' });
  const r = await h.runGenericValuation(input({ sectorKey: 'motor', familyKey: 'heavy_flatdeck_trailer' }));
  assert.equal(h.isPercentProjection({ asset: { kind: 'vehicle', specsJson: r.specsJson }, row: {}, valuationInput: {}, valuationOutput: r }), true);
});
