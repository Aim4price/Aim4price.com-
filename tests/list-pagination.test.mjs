import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../components/ListPagination.tsx', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', output)((id) => {
  if (id.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) });
  if (id === 'next/link') return ({ children, ...props }) => React.createElement('a', props, children);
  return require(id);
}, module, module.exports);
const Pagination = module.exports.default;
const render = (props) => renderToStaticMarkup(React.createElement(Pagination, { label: 'Test pages', page: 1, pageCount: 4, onPageChange() {}, ...props }));

test('short lists show every page with accessible chevrons and active page', () => {
  const html = render();
  for (const page of [1, 2, 3, 4]) assert.match(html, new RegExp(`aria-label="Page ${page}"`));
  assert.doesNotMatch(html, /…/);
  assert.match(html, /aria-label="Previous page"[^>]*disabled/);
  assert.match(html, /aria-label="Page 1" aria-current="page"/);
  assert.match(html, /aria-label="Next page"/);
});
test('large lists retain first, current neighbours and last without excessive controls', () => {
  const html = render({ page: 50, pageCount: 100 });
  assert.equal((html.match(/aria-label="Page \d+"/g) || []).length, 5);
  for (const page of [1, 49, 50, 51, 100]) assert.match(html, new RegExp(`aria-label="Page ${page}"`));
});
test('size selector supports standard and server-supported sizes', () => {
  const standard = render({ pageSize: 6, onPageSizeChange() {} });
  assert.match(standard, /Show per page/);
  assert.match(standard, /Show all per page/);
  const discovery = render({ pageSize: 25, pageSizeOptions: [10, 25, 50], onPageSizeChange() {} });
  assert.match(discovery, /aria-label="Show 25 per page" aria-pressed="true"/);
  assert.doesNotMatch(discovery, /Show all per page/);
});
test('single-page and empty lists display a valid page without navigation', () => {
  const html = render({ page: 0, pageCount: 0 });
  assert.match(html, /Page 1 of 1/);
  assert.doesNotMatch(html, /Next page|Previous page/);
});
test('server lists preserve hrefs while unavailable and loading controls cannot navigate', () => {
  const html = render({ pageHrefPrefix: '/billing?page=' });
  assert.match(html, /href="\/billing\?page=2"/);
  assert.doesNotMatch(html, /href="\/billing\?page=0"/);
  const loading = render({ disabled: true, pageHrefPrefix: '/billing?page=' });
  assert.doesNotMatch(loading, /href=/);
  assert.equal((loading.match(/disabled=""/g) || []).length, 6);
});
