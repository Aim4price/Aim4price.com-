import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const code = ts.transpileModule(readFileSync('app/owner-app/owner-app-nav.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
function load() {
  const calls = [];
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const deps = {
    'react': { useState: value => [value, () => {}] },
    'next/navigation': { useRouter: () => ({ back: () => calls.push('back'), replace: path => calls.push(path) }) },
    'react/jsx-runtime': { jsx, jsxs: jsx },
  };
  new Function('require', 'exports', code)(name => deps[name] ?? { __esModule: true, default: name.endsWith('.css') ? {} : name }, exports);
  return { Nav: exports.default, calls };
}
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
test('all header variants keep Back and Home, including home and account tools', () => {
  const { Nav } = load();
  for (const props of [{}, { showBack: false }, { showBack: false, showSignOut: true }, { backHref: '/owner-app/assets', backLabel: 'My Assets' }]) {
    const elements = nodes(Nav(props));
    assert.equal(elements.filter(n => n.props?.['aria-label'] === 'Back').length, 1);
    assert.equal(elements.find(n => n.props?.['aria-label'] === 'Manager App home').props.href, '/owner-app');
    if (props.backHref) assert.equal(elements.find(n => n.props?.['aria-label'] === 'Back').props.href, props.backHref);
  }
});
test('Back preserves form callbacks and disabled states', () => {
  const { Nav, calls } = load();
  let steps = 0;
  for (const disabled of [true, false]) {
    const back = nodes(Nav({ backHref: '/owner-app/assets', backAction: () => steps++, backDisabled: disabled })).find(n => n.props?.['aria-label'] === 'Back');
    assert.equal(back.type, 'button');
    assert.equal(back.props.disabled, disabled);
    back.props.onClick();
  }
  assert.equal(steps, 1);
  assert.deepEqual(calls, []);
});
test('default Back uses history with a Home fallback for a fresh tab', () => {
  const { Nav, calls } = load();
  const previousWindow = globalThis.window;
  try {
    for (const length of [1, 2]) {
      globalThis.window = { history: { length } };
      nodes(Nav({})).find(n => n.props?.['aria-label'] === 'Back').props.onClick();
    }
    assert.deepEqual(calls, ['/owner-app', 'back']);
  } finally { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
});
