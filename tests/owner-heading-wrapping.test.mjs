import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../app/owner-app/balanced-heading.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', code)(require, mod, mod.exports);
const Heading = mod.exports.default;

test('headings retain all words and let the available width determine wrapping', () => {
  for (const text of ['Photos and saved documents', 'Saved asset details and values', 'A long asset name with several words', 'Details', '']) {
    assert.equal(renderToStaticMarkup(Heading({ text })), text);
  }
  assert.equal(renderToStaticMarkup(Heading({ text: '  Photos   and\n documents  ' })), 'Photos and documents');
});

test('year-led asset names keep the year and brand together without forcing a new line', () => {
  assert.equal(renderToStaticMarkup(Heading({ text: '2015 New Holland T6050 Plus' })), '2015\u00a0New Holland T6050 Plus');
});
