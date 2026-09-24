const assert = require('node:assert/strict');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
const { canUseEstimateBreakdown } = require('../lib/estimate-breakdown-access.ts');
const { genericEstimateBreakdown, tractorEstimateBreakdown } = require('../lib/estimate-breakdown.ts');
const { signEstimateBreakdown, verifyEstimateBreakdown } = require('../lib/estimate-breakdown-token.ts');
const { appendEstimateBreakdownHtml } = require('../lib/estimate-breakdown-report.ts');
const { enhanceEstimateReportHtml } = require('../lib/estimate-report-enhancement.ts');
const { normalizePrivateEstimateSettings } = require('../lib/private-estimate-settings.ts');
const { calculateEngineHoursValue, getValuationConditionFactorOverride } = require('../lib/valuation/shared.ts');
const { createRequire } = require('node:module');
const path = require('node:path');
const { NextRequest } = require('next/server');
const generic = (overrides = {}) => ({
  brand: { name: 'Test brand' }, family: { label: 'Asset' }, condition: 'good', advancedAssumptions: null,
  selectedCalculation: { replacementPriceExVat: 100000, aim4priceValueExVat: 54000,
    ageDepPct: 20, usageDepPct: 60, averageDepPct: 40, marketabilityFactor: 1, isSalvageEstimate: false, ...overrides },
});

test('access is an exact two-email exception, not an admin or domain exception', () => {
  for (const email of ['kallageldenhuys@gmail.com', 'aim4price@gmail.com', ' AIM4PRICE@gmail.com ']) assert.equal(canUseEstimateBreakdown(email), true);
  for (const email of [null, undefined, '', 'admin@gmail.com', 'kallageldenhuys+staff@gmail.com', 'aim4price@gmail.com.evil', 'staff@aim4price.com']) assert.equal(canUseEstimateBreakdown(email), false);
});

test('breakdown averages depreciation and reconciles every rand change', () => {
  const report = genericEstimateBreakdown(generic());
  assert.equal(report.rows[1].percent, -40);
  assert.equal(report.rows[1].value, 60000);
  assert.equal(report.rows[2].value, 54000);
  assert.equal(report.rows.reduce((sum, row) => sum + row.change, report.rows[0].value), report.total);
});

test('usage-only, condition/popularity, marketability and salvage reconcile to engine results', () => {
  for (const hours of [0, 2000, 50000]) for (const stars of [1, 3, 5]) {
    const advancedAssumptions = { maxLifetimeUsage: 10000, conditionFactorPercent: 75, popularityStars: stars, dealerAssessment: null };
    const combined = getValuationConditionFactorOverride('good', advancedAssumptions);
    const c = calculateEngineHoursValue({ replacementPriceExVat: 250000, yearModel: 2020, hours,
      maxLifetimeHours: 10000, condition: 'good', conditionFactorOverride: combined, marketabilityFactor: .8, includeAgeDepreciation: false });
    const result = generic({ replacementPriceExVat: 250000, aim4priceValueExVat: c.finalValueExVat, ageDepPct: null,
      usageDepPct: c.usageDepPct, averageDepPct: c.averageDepPct, marketabilityFactor: .8, isSalvageEstimate: c.isSalvageEstimate });
    result.advancedAssumptions = advancedAssumptions;
    const report = genericEstimateBreakdown(result);
    assert.ok(Math.abs(report.rows.reduce((sum, row) => sum + row.change, report.rows[0].value) - c.finalValueExVat) < 1e-7);
    assert.equal(report.rows.at(-1).value, c.finalValueExVat);
  }
});

test('tractor extras reconcile to the combined final estimate', () => {
  const input = { year: 2020, hours: 2500, condition: 'good' };
  const c = calculateEngineHoursValue({ replacementPriceExVat: 1100000, yearModel: input.year, hours: input.hours, maxLifetimeHours: 10000, condition: 'good' });
  const report = tractorEstimateBreakdown({ model: { brandName: 'Test', modelName: 'Tractor' },
    replacementPriceUsedExVat: 1000000, otherExtraReplacementPriceExVat: 100000, maxLifetimeHours: 10000,
    advancedAssumptions: null, frontPtoReplacementPriceExVat: 250000, frontPtoValueExVat: 50000,
    frontLoaderReplacementPriceExVat: 175000, frontLoaderValueExVat: 75000, gpsReplacementPriceExVat: null,
    gpsValueExVat: 0, aim4priceValueExVat: c.finalValueExVat + 125000 }, input);
  assert.equal(report.rows.at(-1).value, report.total);
  assert.equal(report.rows[0].value, 1100000);
});

test('signed snapshots reject tampering, other identities and expiry', () => {
  process.env.BETTER_AUTH_SECRET = 'test-only-breakdown-secret';
  const report = genericEstimateBreakdown(generic());
  const token = signEstimateBreakdown(report, 'allowed-user');
  assert.deepEqual(verifyEstimateBreakdown(token, 'allowed-user'), report);
  assert.equal(verifyEstimateBreakdown(token, 'someone-else'), null);
  assert.equal(verifyEstimateBreakdown(token + 'x', 'allowed-user'), null);
  assert.equal(verifyEstimateBreakdown('invalid', 'allowed-user'), null);
  const now = Date.now;
  try { Date.now = () => now() + 25 * 60 * 60 * 1000; assert.equal(verifyEstimateBreakdown(token, 'allowed-user'), null); }
  finally { Date.now = now; }
});


const baseHtml = '<html><head></head><body><h2>Estimated Value</h2>Page 1 of 1\n<script>\n(function () { })();</script></body></html>';

test('optional appendix and photo pages retain continuous numbering', () => {
  const report = genericEstimateBreakdown(generic());
  assert.equal(appendEstimateBreakdownHtml(baseHtml, report, false), baseHtml);
  const appended = appendEstimateBreakdownHtml(baseHtml, report, true);
  assert.match(appended, /Page 1 of 2/);
  assert.match(appended, /Page 2 of 2/);
  report.notes = Array(16).fill('Additional calculation detail.');
  const many = appendEstimateBreakdownHtml(baseHtml, report, true);
  assert.match(many, /Page 4 of 4/);
  const enhanced = enhanceEstimateReportHtml(many, { reportPhotos: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='] });
  assert.match(enhanced, /Page 1 of 5/);
  assert.match(enhanced, /Page 4 of 5/);
  assert.match(enhanced, /Page 5 of 5/);
});

test('custom settings are bounded, blank defaults reset, zero depreciation survives', () => {
  assert.equal(normalizePrivateEstimateSettings({}), null);
  assert.equal(normalizePrivateEstimateSettings(null), null);
  for (const field of ['ageDepreciationPercent', 'usageDepreciationPercent']) {
    assert.equal(normalizePrivateEstimateSettings({ [field]: 0 })[field], 0);
    assert.throws(() => normalizePrivateEstimateSettings({ [field]: 101 }));
    assert.throws(() => normalizePrivateEstimateSettings({ [field]: '30' }));
  }
  assert.throws(() => normalizePrivateEstimateSettings({ popularityPercent: Infinity }));
  assert.throws(() => normalizePrivateEstimateSettings({ conditionPercent: 0 }));
  assert.throws(() => normalizePrivateEstimateSettings({ lifetimeUsage: -1 }));
});

test('private overrides recalculate without mutating baseline assumptions', () => {
  const input = { replacementPriceExVat: 100000, yearModel: 2020, baseYear: 2026, hours: 2500, maxLifetimeHours: 10000, condition: 'good' };
  const original = calculateEngineHoursValue(input);
  const settings = normalizePrivateEstimateSettings({ conditionPercent: 80, popularityPercent: 110, ageDepreciationPercent: 20, usageDepreciationPercent: 40 });
  const factor = getValuationConditionFactorOverride('good', { privateSettings: settings });
  const custom = calculateEngineHoursValue({ ...input, privateSettings: settings, conditionFactorOverride: factor });
  assert.equal(custom.averageDepPct, 30);
  assert.equal(custom.finalValueExVat, 61600);
  assert.deepEqual(calculateEngineHoursValue(input), original);
  assert.equal(getValuationConditionFactorOverride('good', { privateSettings: null }), .9);
});

// Exercise actual route handlers with auth/database edges replaced, rather than
// allowing the tests to depend on a production session or database.
function loadRoute(file, mocks, suffix = '') {
  const filename = path.resolve(file);
  const normalRequire = createRequire(filename);
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync(filename, 'utf8') + suffix, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  }, fileName: filename }).outputText;
  new Function('require', 'module', 'exports', source)((key) => key in mocks ? mocks[key] : normalRequire(key), module, module.exports);
  return module.exports;
}

let session = null;
const reportRoute = loadRoute('app/api/valuation/report/route.ts', {
  '../../../../lib/auth-session': { getAnyServerSession: async () => session, getServerSession: async () => null },
  '../../../../lib/asset-registers': { getAssetRegisterReportLogoUrl: async () => '' },
  '../../../../lib/report-logo': { resolveReportLogoUrlForHtml: async () => `data:image/png;base64,${readFileSync('public/brand/Aim4price_Home_Logo.png').toString('base64')}` },
});
function reportRequest(body) { return new NextRequest('https://aim4price.test/api/valuation/report', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}); }

test('report route checks identity, signature, selected value and opt-in', async () => {
  process.env.BETTER_AUTH_SECRET = 'test-only-breakdown-secret';
  const report = genericEstimateBreakdown(generic());
  const estimateBreakdownToken = signEstimateBreakdown(report, 'allowed');
  const payload = { selectedValueExVat: report.total, machineTitle: report.title, estimateBreakdownToken, includeBreakdown: true };
  for (const email of [null, 'someone@gmail.com', 'staff@aim4price.com']) {
    session = email ? { user: { id: 'allowed', email } } : null;
    assert.equal((await reportRoute.POST(reportRequest(payload))).status, 403);
  }
  session = { user: { id: 'allowed', email: 'aim4price@gmail.com' } };
  const response = await reportRoute.POST(reportRequest(payload));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Page 2 of 2/);
  if (process.env.BREAKDOWN_HTML_SAMPLE) { mkdirSync('tmp/pdfs', { recursive: true }); writeFileSync('tmp/pdfs/combined-report.html', html); }
  const ordinary = await (await reportRoute.POST(reportRequest({ ...payload, includeBreakdown: false }))).text();
  assert.doesNotMatch(ordinary, /estimateBreakdownPage/);
  assert.equal((await reportRoute.POST(reportRequest({ ...payload, selectedValueExVat: 1 }))).status, 400);
  assert.equal((await reportRoute.POST(reportRequest({ ...payload, estimateBreakdownToken: estimateBreakdownToken + 'x' }))).status, 400);
  const customized = { ...report, settings: normalizePrivateEstimateSettings({ ageDepreciationPercent: 20 }) };
  const marked = await (await reportRoute.POST(reportRequest({ ...payload, includeBreakdown: false, estimateBreakdownToken: signEstimateBreakdown(customized, 'allowed') }))).text();
  assert.match(marked, /Manually adjusted estimate/);
  assert.match(marked, /Age depreciation/);
});

test('both valuation endpoints reject unauthorized settings before running calculations', async () => {
  for (const kind of ['tractor', 'generic']) {
    let calculations = 0;
    const route = loadRoute(`app/api/${kind}-valuations/route.ts`, {
      '../../../lib/auth-session': { getAnyServerSession: async () => session },
      '../../../lib/account-profile': { getAccountProfile: async () => ({ accountStatus: 'active' }) },
      '../../../lib/admin-valuation-events': {},
      '../../../lib/server-valuation': { runServerValuation: async () => { calculations++; } },
      '../../../lib/generic-valuation': { runGenericValuation: async () => { calculations++; } },
    });
    for (const email of [null, 'someone@gmail.com', 'staff@aim4price.com']) {
      session = email ? { user: { id: 'other', email } } : null;
      const body = { modelId: 'tractor', sectorKey: 'agricultural', familyKey: 'tractor', brandSlug: 'test', year: 2020, hours: 1000, condition: 'good', advancedAssumptions: { privateSettings: { popularity_4: 125, mechanical_good: 95, lifetimeUsage: 20000 } } };
      const response = await route.POST(new NextRequest(`https://aim4price.test/api/${kind}-valuations`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }));
      assert.equal(response.status, 403);
    }
    assert.equal(calculations, 0);
  }
});

const genericEngine = loadRoute('lib/generic-valuation.ts', { './db': { getDb: () => { throw new Error('Unexpected database call'); } } }, '\nexport { buildCalculation };');
test('generic settings cover hours, kilometres, percentages, unknown ages and no-usage assets', () => {
  const defaults = { sectorKey: 'agricultural', replacementPrice: 100000, year: 2020, yearModelUnknown: false,
    usageAmount: 2500, lifeWorkedPercent: 25, usageMetricType: 'hours', valuationMode: 'engine_hours',
    condition: 'good', isPropelled: true, familyKey: 'field-tractor', specsJson: {}, basicLifetime: 10000,
    advancedAssumptions: null, replacementPriceBasis: 'user' };
  const custom = normalizePrivateEstimateSettings({ ageDepreciationPercent: 20, usageDepreciationPercent: 40, conditionPercent: 80, popularityPercent: 110, lifetimeUsage: 20000 });
  for (const change of [{}, { usageMetricType: 'km' }, { valuationMode: 'percent_used', isPropelled: false }, { yearModelUnknown: true }]) {
    const input = { ...defaults, ...change };
    const baseline = genericEngine.buildCalculation(input);
    const calculated = genericEngine.buildCalculation({ ...input, advancedAssumptions: { privateSettings: custom } });
    assert.equal(calculated.averageDepPct, 30);
    assert.equal(calculated.aim4priceValueExVat, 61600);
    assert.deepEqual(genericEngine.buildCalculation({ ...input, advancedAssumptions: null }), baseline);
  }
  const noUsage = genericEngine.buildCalculation({ ...defaults, valuationMode: 'year_condition', advancedAssumptions: { privateSettings: custom } });
  assert.equal(noUsage.usageDepPct, null);
  assert.equal(noUsage.averageDepPct, 20);
  assert.equal(noUsage.aim4priceValueExVat, 70400);
  const lifetime = genericEngine.buildCalculation({ ...defaults, advancedAssumptions: { privateSettings: normalizePrivateEstimateSettings({ lifetimeUsage: 20000 }) } });
  assert.equal(lifetime.usageDepPct, 12.5);
  const unknown = genericEngine.buildCalculation({ ...defaults, yearModelUnknown: true });
  assert.equal(unknown.ageDepPct, null);
  assert.equal(unknown.averageDepPct, 25);
});

test('annual schedule adds year 1–5 and repeats onward, with zero and caps', () => {
  const { annualDepreciationPercent, weightedDepreciationPercent } = require('../lib/private-estimate-settings.ts');
  const settings = normalizePrivateEstimateSettings({ year1Percent: 10, year2Percent: 8, year3Percent: 6, year4Percent: 4, year5Percent: 2, onwardPercent: 1 });
  assert.deepEqual([0,1,2,3,4,5,6,10].map(age => annualDepreciationPercent(age, settings)), [0,10,18,24,28,30,31,35]);
  assert.equal(annualDepreciationPercent(200, settings), 100);
  assert.equal(annualDepreciationPercent(1, normalizePrivateEstimateSettings({ year1Percent: 0 })), 0);
  for (const ageWeightPercent of [0,25,50,75,100]) {
    const custom = normalizePrivateEstimateSettings({ ...settings, ageWeightPercent });
    assert.equal(weightedDepreciationPercent(20, 60, custom), 60 - ageWeightPercent * .4);
    assert.equal(weightedDepreciationPercent(null, 60, custom), 60);
  }
  for (const key of ['year1Percent','year2Percent','year3Percent','year4Percent','year5Percent','onwardPercent','ageWeightPercent']) {
    for (const value of [-1,101,Infinity,'10']) assert.throws(() => normalizePrivateEstimateSettings({ [key]: value }));
  }
});

test('yearly rates and age weighting reach basic and advanced valuation paths', () => {
  const settings = normalizePrivateEstimateSettings({ year1Percent: 10, year2Percent: 8, year3Percent: 6, year4Percent: 4, year5Percent: 2, onwardPercent: 1, ageWeightPercent: 75, conditionPercent: 80, popularityPercent: 110 });
  const baseYear = new Date().getFullYear();
  const conditionFactorOverride = getValuationConditionFactorOverride('good', { privateSettings: settings });
  const engine = calculateEngineHoursValue({ replacementPriceExVat: 100000, yearModel: baseYear - 6, hours: 4000, maxLifetimeHours: 10000, condition: 'good', conditionFactorOverride, privateSettings: settings });
  assert.equal(engine.ageDepPct, 31);
  assert.equal(engine.averageDepPct, 33);
  assert.equal(engine.finalValueExVat, 58960);
  const input = { sectorKey: 'agricultural', replacementPrice: 100000, year: baseYear - 6, yearModelUnknown: false,
    usageAmount: 4000, lifeWorkedPercent: 40, usageMetricType: 'hours', valuationMode: 'engine_hours', condition: 'good', isPropelled: true,
    familyKey: 'field-tractor', specsJson: {}, basicLifetime: 10000, advancedAssumptions: { privateSettings: settings }, replacementPriceBasis: 'user' };
  for (const changes of [{}, { usageMetricType: 'km' }, { valuationMode: 'percent_used', isPropelled: false }]) {
    const result = genericEngine.buildCalculation({ ...input, ...changes });
    assert.equal(result.ageDepPct, 31);
    assert.equal(result.averageDepPct, 33);
    assert.equal(result.aim4priceValueExVat, 58960);
  }
  const ageOnly = genericEngine.buildCalculation({ ...input, valuationMode: 'year_condition' });
  assert.equal(ageOnly.averageDepPct, 31);
  const unknown = genericEngine.buildCalculation({ ...input, yearModelUnknown: true });
  assert.equal(unknown.ageDepPct, null);
  assert.equal(unknown.averageDepPct, 40);
  const report = genericEstimateBreakdown({ ...generic(), advancedAssumptions: { privateSettings: settings }, selectedCalculation: { ...generic().selectedCalculation, ...engine, aim4priceValueExVat: engine.finalValueExVat, marketabilityFactor: 1 } });
  assert.match(report.notes.join('\n'), /75% age weight.*25% usage weight/);
  assert.equal(report.rows.at(-1).value, engine.finalValueExVat);
});

test('both approved accounts can download signed custom reports with form payloads', async () => {
  for (const email of ['aim4price@gmail.com', 'kallageldenhuys@gmail.com']) {
    session = { user: { id: email, email } };
    const report = genericEstimateBreakdown(generic());
    const form = new FormData();
    form.set('payload', JSON.stringify({ selectedValueExVat: report.total, estimateBreakdownToken: signEstimateBreakdown(report, email), includeBreakdown: true }));
    const response = await reportRoute.POST(new NextRequest('https://aim4price.test/api/valuation/report', { method: 'POST', body: form }));
    assert.equal(response.status, 200);
    assert.match(await response.text(), /estimateBreakdownPage/);
  }
});

if (process.env.BREAKDOWN_HTML_SAMPLE) test('render full yearly settings sample', async () => {
  session = { user: { id: 'allowed', email: 'aim4price@gmail.com' } };
  const settings = normalizePrivateEstimateSettings({ year1Percent: 10, year2Percent: 8, year3Percent: 6, year4Percent: 4, year5Percent: 2, onwardPercent: 1, ageWeightPercent: 75, conditionPercent: 80, popularityPercent: 110 });
  const report = genericEstimateBreakdown({ ...generic({ ageDepPct: 31, usageDepPct: 40, averageDepPct: 33, aim4priceValueExVat: 58960 }), advancedAssumptions: { privateSettings: settings } });
  const response = await reportRoute.POST(reportRequest({ selectedValueExVat: report.total, machineTitle: 'Sample tractor', recordRows: [{label: 'Year model', value: '2020'}, {label: 'Usage',value:'4000 hours'}, {label:'Condition',value:'Good'}, {label:'Replacement price',value:'R 100 000'}], estimateBreakdownToken: signEstimateBreakdown(report, 'allowed'), includeBreakdown: true }));
  writeFileSync('tmp/pdfs/combined-report.html', await response.text());
});


test('individual condition and popularity settings affect only the selected rating', () => {
  const settings = normalizePrivateEstimateSettings({ basic_good: 80, basic_fair: 60, popularity_4: 110, popularity_1: 50 });
  assert.ok(Math.abs(getValuationConditionFactorOverride('good', { privateSettings: settings, popularityStars: 4 }) - .88) < 1e-12);
  assert.equal(getValuationConditionFactorOverride('fair', { privateSettings: settings, popularityStars: 3 }), .6);
  assert.equal(getValuationConditionFactorOverride('excellent', { privateSettings: settings, popularityStars: 3 }), 1);
  assert.throws(() => normalizePrivateEstimateSettings({ basic_good: 0 }));
  assert.throws(() => normalizePrivateEstimateSettings({ popularity_4: 151 }));
  assert.throws(() => normalizePrivateEstimateSettings({ work_major: NaN }));
});

test('each detailed answer contributes its configured factor and reconciles in the breakdown', () => {
  const { normalizeAdvancedAssumptions } = require('../lib/valuation/shared.ts');
  const answers = { mechanicalCondition: 'good', bodyCondition: 'average', tyreCondition: '50_75', serviceHistory: 'partial', requiredWork: 'moderate' };
  const settings = { mechanical_good: 80, body_average: 60, tyre_50_75: 70, service_partial: 3, work_moderate: -5, popularity_4: 110 };
  const advancedAssumptions = normalizeAdvancedAssumptions({ dealerAssessment: answers, popularityStars: 4, privateSettings: settings }, 'hours');
  // 80% x 50% + 60% x 30% + 70% x 20% + 3pp - 5pp = 70%.
  assert.equal(advancedAssumptions.dealerAssessment.conditionFactorPercent, 70);
  assert.ok(Math.abs(getValuationConditionFactorOverride('excellent', advancedAssumptions) - .77) < 1e-12);
  const report = genericEstimateBreakdown({ ...generic({ aim4priceValueExVat: 46200 }), advancedAssumptions });
  assert.equal(report.total, 46200);
  assert.ok(report.rows.every(row => Number.isFinite(row.value)));
  assert.match(report.notes.join(' '), /mechanical 80% x 50%, body 60% x 30%, tyres \/ wear 70% x 20%/);
  assert.match(report.notes.join(' '), /Service history: 3 percentage points; required work: -5/);
  const changedUnused = normalizeAdvancedAssumptions({ dealerAssessment: answers, popularityStars: 4, privateSettings: { ...settings, mechanical_poor: 99 } }, 'hours');
  assert.equal(getValuationConditionFactorOverride('excellent', changedUnused), getValuationConditionFactorOverride('excellent', advancedAssumptions));
});
