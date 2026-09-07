import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { resolveCatalogueGuide } from '../lib/basic-catalogue-guide.ts';

const release = 'basic_ballpark_20260907_v1';
const root = resolve(import.meta.dirname, '..');
const nativeRequire = createRequire(import.meta.url);

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
    if (filename === resolve(root, 'lib/db.ts')) return { getDb: () => db };
    if (filename === resolve(root, 'lib/server-valuation.ts')) return { runServerValuation: () => { throw new Error('Unexpected tractor calculation'); } };
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const require = (name) => name.startsWith('.')
      ? load(resolve(dirname(filename), name.endsWith('.ts') ? name : `${name}.ts`))
      : nativeRequire(name);
    vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(require, module, module.exports);
    return module.exports;
  }
  return { queries, row, ...load('lib/basic-catalogue.ts'), ...load('lib/generic-valuation.ts'), ...load('lib/valuation-runs.ts') };
}

function input(overrides = {}) {
  return { sectorKey: 'agricultural', familyKey: 'compact_tractor', brandSlug: 'unknown', year: 2022,
    typedModelName: null, condition: 'good', lifeWorkedPercent: 40, usageAmount: null,
    userReplacementPriceExVat: 900000, saveModelCandidate: true,
    specsJson: { basic_estimate: true, basic_catalogue_release: release, basic_specification_level: 'standard',
      typed_brand_name: 'My brand', catalog_model_id: 123, basic_catalogue: { minimumExVat: 1 } },
    ...overrides };
}

test('thirds cover the whole interval without gaps or changing the researched endpoints', () => {
  for (const [min, max] of [[100000, 750000], [0, 150000], [25000, 1200000], [9000000, 22000000]]) {
    const guides = ['entry', 'standard', 'premium'].map((level) => resolveCatalogueGuide({ minimumExVat: min, maximumExVat: max }, level));
    assert.equal(guides[0].minExVat, min);
    assert.equal(guides[2].maxExVat, max);
    assert.equal(guides[0].maxExVat, guides[1].minExVat);
    assert.equal(guides[1].maxExVat, guides[2].minExVat);
    for (const guide of guides) {
      assert.ok(Math.abs(guide.maxExVat - guide.minExVat - (max - min) / 3) < 1e-8);
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
  assert.equal(result.maxLifetimeHours, null);
  assert.equal(result.estimatedHours, null);
  assert.equal(result.lifeWorkedPercent, 40);
  assert.equal(result.replacementPriceBand, null);
  assert.ok(result.genericEstimateExVat > 0);
  assert.ok(h.queries.every(({ sql }) => !/insert|update|delete/i.test(sql)));
});

test('all sectors and unmapped mounted/trailed families use the same explicit percentage basis', async () => {
  process.env.AIM4PRICE_BASIC_CATALOGUE_RELEASE = release;
  for (const [sectorKey, familyKey] of [['agricultural', 'mounted_boom_sprayer'], ['agricultural', 'trailed_boom_sprayer'], ['construction', 'mini_excavator'], ['industrial', 'pallet_truck'], ['motor', 'sedan']]) {
    const h = harness({ sectorKey, familyKey });
    const result = await h.runGenericValuation(input({ sectorKey, familyKey, typedModelName: 'Optional model' }));
    assert.equal(result.family.key, familyKey);
    assert.equal(result.family.valuationMode, 'percent_used');
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
