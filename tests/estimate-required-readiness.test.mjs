import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the actual wizard gate with representative basic and advanced state.
const source = readFileSync(new URL('../app/valuation/valuation-client.tsx', import.meta.url), 'utf8');
const gate = source.slice(source.indexOf('  function nextRequiredMessage()'), source.indexOf('  function handleNext()')).replace('(): string | null', '()');
function missing(overrides = {}) {
  return vm.runInNewContext(`${gate}; nextRequiredMessage()`, {
    step: 2, basicEstimateActive: true, unlistedBrandName: '', basicSpecLevel: '',
    basicBaseReplacementPriceExVat: null, selectedFamily: {}, selectedSector: 'agriculture',
    normalizeText: value => value.trim(), validateDetails: () => null,
    validateGenericModelSelection: () => null, validateMotorCanonicalSelection: () => null,
    isMotorSector: sector => sector === 'motor', selectedMotorSubtypeConfig: null,
    selectedBrand: {}, flowMode: 'generic', exactTractorAvailable: false,
    ...overrides,
  });
}
test('basic identity requires a non-blank brand but no optional model', () => {
  assert.ok(missing({ unlistedBrandName: '   ' }));
  assert.equal(missing({ unlistedBrandName: 'John Deere' }), null);
});
test('specification and replacement price must be valid before advancing', () => {
  assert.ok(missing({ step: 3 }));
  assert.equal(missing({ step: 3, basicSpecLevel: 'standard' }), null);
  for (const price of [null, 0, -5000]) assert.ok(missing({ step: 5, basicBaseReplacementPriceExVat: price }));
  assert.equal(missing({ step: 5, basicBaseReplacementPriceExVat: 5000 }), null);
});
test('both flows use the same details validation as submission', () => {
  for (const basicEstimateActive of [true, false]) {
    assert.equal(missing({ step: 4, basicEstimateActive, validateDetails: () => 'Choose the condition.' }), 'Choose the condition.');
    assert.equal(missing({ step: 4, basicEstimateActive }), null);
  }
});
test('advanced motor and model choices retain their existing requirements', () => {
  assert.equal(missing({ basicEstimateActive: false, selectedSector: 'motor', validateMotorCanonicalSelection: () => 'Choose type.' }), 'Choose type.');
  assert.ok(missing({ step: 3, basicEstimateActive: false, flowMode: 'exact_model', exactTractorAvailable: true, tractorSetupComplete: false }));
  assert.equal(missing({ step: 3, basicEstimateActive: false, validateGenericModelSelection: () => 'Choose a model.' }), 'Choose a model.');
});
