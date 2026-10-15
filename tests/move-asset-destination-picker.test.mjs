import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../components/asset-register/MoveAssetDestinationPicker.tsx', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function('module', 'exports', 'require', output)(module, module.exports, (name) => name.endsWith('.css') ? { default: {} } : require(name));
const Picker = module.exports.default;
const noop = () => {};
const defaults = { assetName: 'Tractor', sourceName: 'Farm', destination: 'register', onDestinationChange: noop, options: [{ value: 'r2', label: 'Workshop', description: '4 assets' }], targetId: '', onSelect: noop, canUseUmbrellas: true, loading: false, loadError: '', error: '', busy: false, managementHref: '/asset-registers', onRetry: noop, onClose: noop, onMove: noop };
const render = (props = {}) => renderToStaticMarkup(React.createElement(Picker, { ...defaults, ...props }));

test('shows destinations directly and requires a valid selection before moving', () => {
  const html = render();
  assert.match(html, /Workshop/);
  assert.match(html, /Current asset register: Farm/);
  assert.doesNotMatch(html, /<select|combobox/);
  assert.match(html, /disabled="">Move to register/);
  assert.match(render({ targetId: 'removed' }), /disabled="">Move to register/);
  assert.doesNotMatch(render({ targetId: 'r2' }), /disabled="">Move to register/);
});

test('explains umbrella scope and respects umbrella permissions', () => {
  const html = render({ destination: 'umbrella', targetId: 'r2' });
  assert.match(html, /Selected umbrella/);
  assert.match(html, /asset stays in its current register/);
  assert.match(html, /becomes a combined umbrella/);
  assert.doesNotMatch(render({ canUseUmbrellas: false }), /<strong>Umbrella<\/strong>/);
});

test('loading, failures and pending moves cannot be submitted', () => {
  assert.match(render({ loading: true, targetId: 'r2' }), /disabled="">Move to register/);
  const failed = render({ loadError: 'Unavailable', targetId: 'r2' });
  assert.match(failed, /Try again/);
  assert.match(failed, /disabled="">Move to register/);
  assert.match(render({ busy: true, targetId: 'r2' }), /disabled="">Moving/);
  assert.match(render({ options: [] }), /Create an asset register/);
});
