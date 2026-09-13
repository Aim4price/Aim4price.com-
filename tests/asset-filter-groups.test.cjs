const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const component = fs.readFileSync('components/AssetFilterDialog.tsx', 'utf8');
const helper = component.slice(component.indexOf('export function replaceFilterGroup'), component.indexOf('export default function'));
const compiled = ts.transpile(helper, { module: ts.ModuleKind.CommonJS });
const exportsObject = {};
new Function('exports', compiled)(exportsObject);
const { replaceFilterGroup } = exportsObject;
const insurance = [{ value: 'insured' }, { value: 'not-insured' }];
const finance = [{ value: 'financed' }, { value: 'not-financed' }];

test('group selections combine, replace only their own group, and clear independently', () => {
  const initial = ['mapped'];
  const selected = replaceFilterGroup(replaceFilterGroup(initial, insurance, 'insured'), finance, 'financed');
  assert.deepEqual(selected, ['mapped', 'insured', 'financed']);
  const changed = replaceFilterGroup(selected, insurance, 'not-insured');
  assert.deepEqual(changed, ['mapped', 'financed', 'not-insured']);
  assert.deepEqual(replaceFilterGroup(changed, finance, ''), ['mapped', 'not-insured']);
  assert.deepEqual(initial, ['mapped']);
});

const client = fs.readFileSync('app/asset-register/asset-register-client.tsx', 'utf8');
const filterSource = client.slice(client.indexOf('function filterAssetsByRegisterFilter('), client.indexOf('function readBooleanFromSpecs('));
const filterJs = ts.transpile(filterSource, { target: ts.ScriptTarget.ES2020 });
const dependencies = {
  readInsuranceStatusChoice: (asset) => asset.insurance,
  readFinanceStatusChoice: (asset) => asset.finance,
  readLicenseStatusChoice: (asset) => asset.license,
  hasAssetMapCoordinates: (asset) => asset.mapped,
  isAim4priceValuedAsset: (asset) => asset.selectedMethod === 'aim4price',
  isLiveOnMarketplace: (asset) => asset.listed,
};
const filter = new Function(...Object.keys(dependencies), `${filterJs}; return filterAssetsByRegisterFilter;`)(...Object.values(dependencies));

test('combined predicates narrow the same list and keep unknown insurance separate from not insured', () => {
  const assets = [
    { id: 'a', insurance: 'yes', finance: 'yes', license: 'not_applicable' },
    { id: 'b', insurance: 'yes', finance: 'no', license: 'yes' },
    { id: 'c', insurance: 'no', finance: 'yes', license: 'no' },
    { id: 'd', insurance: '', finance: 'yes', license: '' },
  ];
  assert.deepEqual(['insured', 'financed'].reduce(filter, assets).map((asset) => asset.id), ['a']);
  assert.deepEqual(filter(assets, 'not-insured').map((asset) => asset.id), ['c']);
  assert.deepEqual(filter(assets, 'license-not-applicable').map((asset) => asset.id), ['a']);
  assert.equal(assets.length, 4);
});

test('all prior filter and sort choices remain represented in the new groups', () => {
  const oldOptions = client.slice(client.indexOf('const ASSET_FILTER_OPTIONS:'), client.indexOf('const ASSET_FILTER_LABEL_BY_VALUE:'));
  const controls = client.slice(client.indexOf('const ASSET_FILTER_GROUPS:'), client.indexOf('const LEAFLET_SCRIPT_ID'));
  for (const [, key] of oldOptions.matchAll(/value: '([^']+)'/g)) {
    assert.ok(controls.includes(`'${key}'`), `Missing option: ${key}`);
  }
});
