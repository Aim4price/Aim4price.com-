import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
function load(path, requireMock = () => { throw new Error('Unexpected import'); }) {
  const output = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', output)(requireMock, mod, mod.exports);
  return mod.exports;
}
const { fieldManagerNavigationSection: section } = load('app/field-manager/field-manager-navigation.ts');
test('Field Manager browsing destinations use the expected tab', () => {
  for (const [path, expected] of [
    ['/field-manager', 'home'], ['/field-manager/', 'home'], ['/field-manager/overview', 'home'],
    ['/field-manager/notifications', 'home'], ['/field-manager/assets', 'assets'],
    ['/field-manager/work', 'work'], ['/field-manager/diesel', 'work'], ['/field-manager/report-problem', 'work'], ['/field-manager/more', 'more'],
  ]) assert.equal(section(path), expected, path);
});
test('capture, scheduling, storage, login and other apps never show the bottom bar', () => {
  for (const path of ['/field-manager/login', '/field-manager/assets/abc', '/field-manager/assets/abc/maintenance', '/field-manager/diesel/storage', '/field-manager/diesel/tank-123', '/field-manager/diesel/petrol-station', '/field-manager/offline.html', '/owner-app', '/dealer', '/scan/abc']) assert.equal(section(path), null, path);
});
test('bottom navigation requires a Field Manager session and stays inside its app', () => {
  for (const authenticated of [false, true]) {
    const jsx = (type, props) => ({ type, props });
    const Component = load('app/field-manager/field-manager-bottom-nav.tsx', name => {
      if (name === 'react') return { useEffect() {}, useState: () => [authenticated, () => {}] };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === 'next/navigation') return { usePathname: () => '/field-manager/work' };
      if (name === './field-manager-navigation') return { fieldManagerNavigationSection: section };
      if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }), __esModule: true };
      return { default: name, __esModule: true };
    }).default;
    const result = Component();
    if (!authenticated) { assert.equal(result, null); continue; }
    const links = result.props.children[1].props.children;
    assert.equal(links.length, 4);
    assert.ok(links.every(link => link.props.href.startsWith('/field-manager')));
    assert.equal(links.find(link => link.props['aria-current'] === 'page').props.href, '/field-manager/work');
  }
});
