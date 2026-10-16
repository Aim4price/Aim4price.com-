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
const defaults = { assetName: 'Tractor', assetDetails: 'Year model: 2020 · Usage: 500 hours · Condition: Good', sourceName: 'Farm', destination: 'register', onDestinationChange: noop, options: [{ value: 'r2', label: 'Workshop', description: '4 assets' }], targetId: '', onSelect: noop, canUseUmbrellas: true, loading: false, loadError: '', error: '', busy: false, managementHref: '/asset-registers', onRetry: noop, onClose: noop, onMove: noop };
const render = (props = {}) => renderToStaticMarkup(React.createElement(Picker, { ...defaults, ...props }));

test('starts with asset details and two choices, without destination lists or search', () => {
  const html = render();
  assert.doesNotMatch(html, /Move this asset to/);
  assert.match(html, /aria-labelledby="move-asset-name"/);
  assert.match(html, /Tractor/);
  assert.match(html, /Year Model: 2020 • Usage: 500 hours • Condition: Good/);
  assert.match(html, /500 hours/);
  assert.match(html, /Condition: Good/);
  assert.match(html, /<strong>Asset Register<\/strong>/);
  assert.match(html, /<strong>Umbrella<\/strong>/);
  assert.doesNotMatch(html, /Workshop|type="search"|Move to register|Select a destination/);
});

test('entry respects umbrella permissions', () => {
  const html = render({ canUseUmbrellas: false });
  assert.match(html, /<strong>Asset Register<\/strong>/);
  assert.doesNotMatch(html, /<strong>Umbrella<\/strong>/);
});

test('entry never exposes a move action even when a previous target is supplied', () => {
  assert.doesNotMatch(render({ targetId: 'r2' }), /Move to register|Selected asset register/);
});
