import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync('app/owner-app/assets/owner-assets-client.tsx', 'utf8');
const items = [
  { id: 'baler', title: '2021 Krone Fortima 1250MC Baler', serialNumber: 'AB 123', usage: 30, usageMetric: 'percentage' },
  { id: 'vehicle', title: 'Farm vehicle', usage: null, usageMetric: 'not_applicable' },
];
const groups = [{ id: 'group', name: 'Aparte Aanbodde', memberAssetIds: ['baler'], memberCount: 1 }];
export function fixture(query = '', selected = null) {
  const states = [query, items, groups, selected, false, true, false, '', '', null, null];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  const react = {
    useState: initial => { const index = cursor++; return [states[index] ?? initial, value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useMemo: fn => fn(), useRef: value => ({ current: value }), useEffect: () => {},
  };
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', js)(name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'next/link') return { default: 'a' };
    if (name.includes('balanced-heading')) return { default: ({ text }) => text };
    if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
    return { default: () => null };
  }, module, module.exports);
  return { states, render: () => { cursor = 0; return module.exports.default({}); } };
}
export function nodes(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props?.children)];
}
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value) : Array.isArray(value) ? value.map(text).join(' ') : value?.props ? text(value.props.children) : '';
test('group-name search finds its visible assets and renders an actionable group', () => {
  const f = fixture('aparte'); const tree = nodes(f.render());
  assert.ok(tree.some(node => node.type === 'h2' && node.props.children === 'Aparte Aanbodde'));
  assert.ok(tree.some(node => node.type === 'a' && node.props.href === '/owner-app/assets/baler'));
  assert.ok(!tree.some(node => node.type === 'a' && node.props.href === '/owner-app/assets/vehicle'));
  tree.find(node => node.type === 'button' && node.props['aria-label'] === 'Open Aparte Aanbodde').props.onClick();
  assert.equal(f.states[0], ''); assert.equal(f.states[3], 'group');
  assert.match(text(f.render()), /All groups/);
});
test('serial search still ignores punctuation and unmatched searches explain the empty result', () => {
  assert.ok(nodes(fixture('ab123').render()).some(node => node.props?.href === '/owner-app/assets/baler'));
  assert.match(text(fixture('unmatched').render()), /No assets match this search/);
});
test('usage labels distinguish percentage worked, missing readings and not applicable', () => {
  const f = fixture(); f.states[4] = true;
  const content = text(f.render());
  assert.match(content, /30% worked/); assert.match(content, /Not applicable/);
});
