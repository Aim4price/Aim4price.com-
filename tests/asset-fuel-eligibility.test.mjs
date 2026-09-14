import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function compile(path, imports = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  Function('module', 'exports', 'require', js)(module, module.exports, (name) => {
    assert.ok(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  });
  return module.exports;
}
const families = compile('lib/basic-fuel-families.ts');
const { assetCanReceiveFuel } = compile('lib/asset-fuel-eligibility.ts', { './basic-fuel-families': families });
const { BASIC_USAGE_FAMILIES } = compile('lib/basic-usage-profiles.ts');

for (const kind of ['equipment', 'manual']) {
  test(`${kind}: Basic powered family is eligible without saved flags`, () => {
    assert.equal(assetCanReceiveFuel({ kind, specsJson: {}, familyIsPropelled: true }), true);
    assert.equal(assetCanReceiveFuel({ kind, specsJson: {}, familyIsPropelled: false }), false);
    assert.equal(assetCanReceiveFuel({ kind, specsJson: {} }), false);
  });
}
for (const key of ['is_propelled', 'isPropelled', 'self_propelled', 'selfPropelled', 'accepts_fuel', 'acceptsFuel']) {
  test(`${key}: explicit flags take precedence over family`, () => {
    for (const value of [false, 0, 'false', 'no', 'n']) {
      assert.equal(assetCanReceiveFuel({ kind: 'equipment', specsJson: { [key]: value }, familyIsPropelled: true }), false);
    }
    for (const value of [true, 1, 'true', 'yes', 'y']) {
      assert.equal(assetCanReceiveFuel({ kind: 'equipment', specsJson: { [key]: value }, familyIsPropelled: false }), true);
    }
  });
}
test('tractor and vehicle default eligibility respects explicit opt-outs', () => {
  for (const kind of ['tractor', 'vehicle']) {
    assert.equal(assetCanReceiveFuel({ kind }), true);
    assert.equal(assetCanReceiveFuel({ kind, specsJson: { acceptsFuel: false }, familyIsPropelled: true }), false);
  }
});
test('invalid flags fall back to family and malformed specs are safe', () => {
  for (const specsJson of [null, [], 'invalid', { is_propelled: 'unknown' }]) {
    assert.equal(assetCanReceiveFuel({ kind: 'equipment', specsJson, familyIsPropelled: true }), true);
  }
});

const basic = (familyKey, overrides = {}) => ({
  kind: 'equipment',
  familyIsPropelled: null,
  specsJson: { basic_catalogue_release: 'basic_ballpark_20260907_v1',
    basic_catalogue: { familyKey }, ...overrides },
});

test('existing Basic assets use saved catalogue identity with no equipment family FK', () => {
  for (const family of ['orchard_vineyard_tractor', 'small_combine_harvester', 'self_propelled_sprayer',
    'engine_wood_chipper', 'mini_excavator', 'petrol_breaker', 'diesel_generator_set',
    'trailer_generator', 'diesel_counterbalance_forklift', 'sedan_fastback']) {
    assert.equal(assetCanReceiveFuel(basic(family)), true, family);
  }
});
test('Basic implements and electric machines stay excluded even under broad vehicle/propelled markers', () => {
  for (const family of ['mounted_boom_sprayer', 'trailed_boom_sprayer', 'pto_wood_chipper',
    'round_baler', 'mouldboard_plough', 'heavy_flatdeck_trailer', 'fuel_tanker_trailer',
    'electric_counterbalance_forklift', 'battery_solar_lighting_tower', 'crop_application_drone',
    'cnc_lathe', 'powered_pallet_truck', 'slab_scissor_lift', 'unknown_family']) {
    assert.equal(assetCanReceiveFuel({ ...basic(family, { is_propelled: true }), kind: 'vehicle', familyIsPropelled: true }), false, family);
  }
});
test('mixed-power families need actual fuel evidence and support independent engines', () => {
  for (const family of ['golf_cart', 'fixed_fire_pump_set', 'portable_concrete_mixer', 'refrigerated_freight_trailer']) {
    assert.equal(assetCanReceiveFuel(basic(family)), false, family);
    assert.equal(assetCanReceiveFuel(basic(family, { accepts_fuel: true })), true, family);
    assert.equal(assetCanReceiveFuel(basic(family, { fuel_type: 'diesel' })), true, family);
  }
});
test('electric and PTO power sources override kind, family and positive flags; hybrids still use fuel', () => {
  for (const fuel_type of ['electric', 'battery', 'pto', 'solar']) {
    assert.equal(assetCanReceiveFuel({ ...basic('mini_excavator', { fuel_type, acceptsFuel: true }), kind: 'vehicle' }), false);
    assert.equal(assetCanReceiveFuel({ kind: 'vehicle', specsJson: { fuel_type }, familyIsPropelled: true }), false);
  }
  assert.equal(assetCanReceiveFuel(basic('sedan_fastback', { fuel_type: 'hybrid' })), true);
});
test('legacy trailer classification cannot make non-powered trailers fuel eligible', () => {
  assert.equal(assetCanReceiveFuel({ kind: 'vehicle', equipmentFamilyKey: 'trailers', familyIsPropelled: true }), false);
  assert.equal(assetCanReceiveFuel({ kind: 'vehicle', equipmentFamilyKey: 'trailers', specsJson: { accepts_fuel: true } }), true);
});
test('saved flat Basic identity also works and explicit opt-out wins', () => {
  assert.equal(assetCanReceiveFuel({ kind: 'equipment', specsJson: {
    basic_catalogue_release: 'basic_ballpark_20260907_v1', family_key: 'diesel_generator_set',
  } }), true);
  assert.equal(assetCanReceiveFuel(basic('diesel_generator_set', { acceptsFuel: false })), false);
});
test('reviewed defaults use real, unambiguous Basic keys and never infer fuel from hours', () => {
  const keys = BASIC_USAGE_FAMILIES.map((row) => row[1]);
  assert.equal(new Set(keys).size, keys.length);
  for (const key of families.BASIC_FUEL_FAMILY_KEYS) assert.ok(keys.includes(key), key);
  assert.equal(assetCanReceiveFuel(basic('cnc_lathe', { usageMetricType: 'hours' })), false);
});
test('both consumers use the shared rule and receive the legacy family key', () => {
  const ledger = read('lib/fuel-ledger.ts');
  const register = read('lib/asset-register-db.ts');
  const client = read('app/asset-register/asset-register-client.tsx');
  assert.match(ledger, /return assetCanReceiveFuel\(\{/);
  assert.match(ledger, /equipmentFamilyKey: row\.equipment_family_key/);
  assert.equal((ledger.match(/coalesce\(ef\.family_key, ''\) as equipment_family_key/g) ?? []).length, 4);
  assert.match(register, /familyIsPropelled: row\.family_is_propelled/);
  assert.match(register, /ef\.is_propelled.*as family_is_propelled/);
  assert.match(client, /return assetCanReceiveFuel\(asset\)/);
});
