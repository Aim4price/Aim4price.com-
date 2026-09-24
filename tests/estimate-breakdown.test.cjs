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
const { renderEstimateBreakdownPdf } = require('../lib/estimate-breakdown-pdf.ts');
const { calculateEngineHoursValue, getValuationConditionFactorOverride } = require('../lib/valuation/shared.ts');
const { PDFDocument } = require('pdf-lib');
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

test('PDF is valid and long asset names paginate safely', async () => {
  const report = genericEstimateBreakdown(generic());
  const pdf = await renderEstimateBreakdownPdf(report);
  assert.equal((await PDFDocument.load(pdf)).getPageCount(), 1);
  if (process.env.BREAKDOWN_PDF_SAMPLE) { mkdirSync('tmp/pdfs', { recursive: true }); writeFileSync('tmp/pdfs/breakdown.pdf', pdf); }
  report.title = 'Very long model name '.repeat(20);
  report.notes = Array(40).fill('Additional equipment details with a long but ordinary explanation.');
  assert.ok((await PDFDocument.load(await renderEstimateBreakdownPdf(report))).getPageCount() > 1);
});

test('server enforces identity before accepting a signed report', () => {
  const route = readFileSync('app/api/valuation/breakdown/route.ts', 'utf8');
  assert.ok(route.indexOf('canUseEstimateBreakdown(session.user.email)') < route.indexOf('await request.json()'));
  assert.match(route, /verifyEstimateBreakdown\(body.token, session.user.id\)/);
  for (const name of ['generic', 'tractor']) {
    const api = readFileSync(`app/api/${name}-valuations/route.ts`, 'utf8');
    assert.match(api, /breakdownSession\?\.user\?\.id && canUseEstimateBreakdown\(breakdownSession.user.email\)/);
  }
});
