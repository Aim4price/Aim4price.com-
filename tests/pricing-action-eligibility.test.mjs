import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');
const start = source.indexOf('function getRecalculationUnavailableReason(');
const end = source.indexOf('const REPLACEMENT_PRICE_SPEC_KEYS', start);
const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const { refresh, project, reason } = Function('assetUsesPercentUsage', 'readAssetReplacementPriceExVat', 'getAssetLifeWorkedPercent', 'isPlainRecord', 'isMotorProjectionAsset', 'isTractorAsset', `${js}; return {refresh: canRefreshAssetEstimate, project: canProjectFuturePrice, reason: getProjectionUnavailableReason};`)(
  a => a.specsJson.basic_usage_basis === 'percent',
  a => a.replacementPriceExVat > 0 ? a.replacementPriceExVat : null,
  a => a.lifeWorkedPercent ?? null,
  value => value !== null && typeof value === 'object' && !Array.isArray(value),
  a => a.kind === 'vehicle' || a.specsJson.sector_key === 'motor',
  a => a.kind === 'tractor' || Boolean(a.tractorType || a.drive || a.cab),
);
const asset = (overrides = {}) => ({ valuationRunId: 12, selectedMethod: 'aim4price', kind: 'equipment', yearModel: 2022, condition: 'good', replacementPriceExVat: 500000, powerKw: null, tractorType: '', specsJson: {}, ...overrides });
test('Basic hours and km use the supported usage calculation without Advanced tractor details', () => {
  for (const kind of ['equipment', 'tractor', 'vehicle']) {
    for (const usage_metric of ['hours', 'km']) {
      const a = asset({ kind, specsJson: { basic_catalogue_release: 'basic_ballpark_20260907_v1', basic_usage_basis: 'reading', usage_metric } });
      assert.equal(project(a), true);
      assert.equal(refresh(a), true);
    }
  }
});
test('manual and unlinked values remain disabled with actionable reasons', () => {
  for (const overrides of [{ selectedMethod: 'manual' }, { valuationRunId: null }, { valuationRunId: undefined }, { valuationRunId: 0 }]) {
    const a = asset(overrides);
    assert.equal(refresh(a), false);
    assert.equal(project(a), false);
    assert.match(reason(a), /Save an Aim4price estimate/);
  }
});
test('missing Basic inputs explain why projection is unavailable', () => {
  const a = asset({ specsJson: { basic_catalogue_release: 'basic_ballpark_20260907_v1' } });
  assert.equal(reason({ ...a, replacementPriceExVat: 0 }), 'Add a replacement price.');
  assert.equal(reason({ ...a, yearModel: null }), 'Add the year model.');
});
test('percentage assets permit zero worked and explain missing inputs', () => {
  const a = asset({ yearModel: null, lifeWorkedPercent: 0, specsJson: { basic_usage_basis: 'percent' } });
  assert.equal(project(a), true);
  assert.equal(reason({ ...a, lifeWorkedPercent: null }), 'Add the lifetime worked percentage.');
  assert.equal(reason({ ...a, condition: '' }), 'Add the asset condition.');
});
test('Advanced tractors still require their own specifications', () => {
  const a = asset({ kind: 'tractor' });
  assert.equal(reason(a), 'Add the tractor power in kW.');
  assert.equal(reason({ ...a, powerKw: 90 }), 'Add the tractor type.');
  assert.equal(project({ ...a, powerKw: 90, tractorType: 'utility' }), true);
});
test('Motor is checked before incidental tractor-like metadata', () => {
  assert.equal(project(asset({ kind: 'vehicle', drive: '4WD' })), true);
});
test('unsupported Advanced equipment remains clearly identified', () => {
  assert.match(reason(asset()), /not yet supported/);
  assert.equal(refresh(asset()), true);
});
test('the disabled buttons expose their own reasons in visible helper text', () => {
  assert.match(source, /<small>\{getRecalculationUnavailableReason\(activeAsset\) \?\?/);
  assert.match(source, /<small>\{getProjectionUnavailableReason\(activeAsset\) \?\?/);
});
