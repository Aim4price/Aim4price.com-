import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const jsx = (type, props) => ({ type, props });
function componentHarness() {
  let slots = [], index = 0;
  const runtime = { jsx, jsxs: jsx };
  const currency = {};
  new Function('exports', 'require', compile(read('components/GroupedCurrencyInput.tsx')))(currency, () => runtime);
  const exports = {};
  new Function('exports', 'require', compile(read('components/MarketplacePriceInput.tsx')))(exports, name => {
    if (name === 'react') return { useState: initial => {
      const slot = index++; if (!(slot in slots)) slots[slot] = initial;
      return [slots[slot], next => { slots[slot] = next; }];
    } };
    if (name === 'react/jsx-runtime') return runtime;
    if (name.includes('GroupedCurrencyInput')) return currency;
    return { default: {} };
  });
  return props => { index = 0; return exports.default(props); };
}
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
test('controlled VAT toggles notify the parent without changing the canonical price', () => {
  const render = componentHarness(); let included = false, value = '400000', updates = 0;
  const props = () => ({ value, vatIncluded: included, onVatIncludedChange: next => { included = next; }, onChange: next => { value = next; updates++; } });
  let tree = nodes(render(props()));
  tree.find(n => n.type === 'button' && n.props.children === 'Incl. VAT').props.onClick();
  assert.equal(included, true);
  tree = nodes(render(props()));
  assert.equal(tree.find(n => n.props?.['aria-label'] === 'Asking price including VAT').props.value, '460000');
  assert.equal(updates, 0);
  tree.find(n => n.type === 'button' && n.props.children === 'Excl. VAT').props.onClick();
  assert.equal(included, false);
  assert.equal(value, '400000');
});
test('VAT-inclusive entry converts once to the stored excluding-VAT amount', () => {
  const render = componentHarness(); let value = '400000';
  const props = () => ({ value, vatIncluded: true, onChange: next => { value = next; } });
  let tree = nodes(render(props()));
  tree.find(n => n.props?.['aria-label'] === 'Asking price including VAT').props.onValueChange('575000');
  assert.equal(value, '500000');
  tree = nodes(render(props()));
  assert.equal(tree.find(n => n.props?.['aria-label'] === 'Asking price including VAT').props.value, '575000');
});
test('uncontrolled price inputs retain their existing VAT toggle behaviour', () => {
  const render = componentHarness(), props = { value: '100', onChange() {} };
  nodes(render(props)).find(n => n.type === 'button' && n.props.children === 'Incl. VAT').props.onClick();
  assert.equal(nodes(render(props)).find(n => n.props?.['aria-label'] === 'Asking price including VAT').props.value, '115');
});
const client = read('app/marketplace/marketplace-client.tsx');
const editCode = compile(client.slice(client.indexOf('  function editMarketplaceListing('), client.indexOf('  function closeListingEditModal(')));
test('owner edit shortcut goes directly to the selected asset edit flow', () => {
  let navigated = null;
  const edit = new Function('compactAppMode', 'window', `${editCode}; return editMarketplaceListing;`)(false, { location: { origin: 'https://www.aim4price.com', assign: url => { navigated = url; } } });
  edit({ canManage: false, sourceAssetId: 'other' }); assert.equal(navigated, null);
  edit({ canManage: true }); assert.equal(navigated, null);
  edit({ canManage: true, sourceAssetId: 'asset-123' });
  const url = new URL(navigated);
  assert.equal(url.pathname, '/asset-register');
  assert.equal(url.searchParams.get('assetId'), 'asset-123');
  assert.equal(url.searchParams.get('action'), 'marketplace-edit');
});
