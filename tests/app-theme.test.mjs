import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import postcss from 'postcss';
import { lightThemeSource } from './helpers/light-theme-source.mjs';

const source = readFileSync(new URL('../lib/app-theme.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function runtime({ blocked = false, saved = {} } = {}) {
  const values = new Map(Object.entries(saved));
  const document = { documentElement: { dataset: {} } };
  const localStorage = {
    getItem(key) { if (blocked) throw new Error('Storage blocked'); return values.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw new Error('Storage blocked'); values.set(key, value); },
  };
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, document, localStorage, Event, window: new EventTarget() });
  vm.runInContext(output, context);
  return { api: module.exports, values, document, context };
}

test('only exact app roots and their descendants receive an app theme', () => {
  const { api } = runtime();
  for (const root of ['owner-app', 'dealer', 'middleman', 'field-manager']) {
    assert.equal(api.appThemeRoot('/' + root), root);
    assert.equal(api.appThemeRoot('/' + root + '/assets/123'), root);
    assert.equal(api.appThemeRoot('/' + root + '-other'), null);
  }
  for (const path of ['/', '/account/owner-app', '/marketplace']) assert.equal(api.appThemeRoot(path), null);
});

test('pre-paint theme works for direct links and defaults safely when storage is blocked', () => {
  for (const root of ['owner-app', 'dealer', 'middleman', 'field-manager']) {
    for (const blocked of [false, true]) {
      const state = runtime({ blocked, saved: { ['aim4price-app-theme:' + root]: 'dark' } });
      state.context.location = { pathname: '/' + root + '/assets' };
      vm.runInContext(state.api.APP_THEME_SCRIPT, state.context);
      assert.equal(state.document.documentElement.dataset.appTheme, blocked ? 'light' : 'dark');
    }
  }
});

test('each app remembers its own preference without changing the desktop background', () => {
  const { api, document, values } = runtime();
  document.documentElement.dataset.background = 'dark';
  api.setAppTheme('owner-app', 'dark');
  api.setAppTheme('dealer', 'light');
  api.applyAppTheme('owner-app');
  assert.equal(document.documentElement.dataset.appTheme, 'dark');
  assert.equal(values.get('aim4price-app-theme:owner-app'), 'dark');
  api.applyAppTheme('dealer');
  assert.equal(document.documentElement.dataset.appTheme, 'light');
  api.applyAppTheme(null);
  assert.equal(document.documentElement.dataset.appTheme, undefined);
  assert.equal(document.documentElement.dataset.background, 'dark');
});

test('storage failures retain the current-session choice and external resets clear it', () => {
  const { api, document } = runtime({ blocked: true });
  api.setAppTheme('field-manager', 'dark');
  api.applyAppTheme(null);
  api.applyAppTheme('field-manager');
  assert.equal(document.documentElement.dataset.appTheme, 'dark');
  api.clearAppThemeMemory('field-manager');
  api.applyAppTheme('field-manager');
  assert.equal(document.documentElement.dataset.appTheme, 'light');
});

test('offline entry uses the same pre-paint preference and caches its theme stylesheet', () => {
  const { api } = runtime();
  const html = readFileSync(new URL('../public/field-manager/offline.html', import.meta.url), 'utf8');
  const worker = readFileSync(new URL('../public/field-manager-sw.js', import.meta.url), 'utf8');
  const entry = readFileSync(new URL('../public/field-manager/offline.mjs', import.meta.url), 'utf8');
  const cache = worker.match(/const SHELL_CACHE = '([^']+)'/)[1];
  assert.ok(entry.includes(`cacheName: '${cache}'`), 'offline preparation must check the cache installed by the worker');
  assert.ok(html.includes(api.APP_THEME_SCRIPT));
  assert.ok(html.includes('href="/app-theme.css"'));
  assert.ok(worker.includes("'/app-theme.css'"));
});

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a, b) {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + .05) / (dark + .05);
}

test('dark text and status colours have readable contrast on their surfaces', () => {
  const css = postcss.parse(readFileSync(new URL('../public/app-theme.css', import.meta.url), 'utf8'));
  const colours = new Map();
  css.walkDecls(d => { if (/^--app-/.test(d.prop) && /^#[a-f\d]{6}$/i.test(d.value)) colours.set(d.prop.slice(6), d.value); });
  for (const surface of ['page', 'surface', 'surface-soft']) {
    for (const ink of ['text', 'muted', 'accent']) assert.ok(contrast(colours.get(ink), colours.get(surface)) >= 4.5, `${ink} on ${surface}`);
  }
  for (const status of ['danger', 'warning', 'info']) assert.ok(contrast(colours.get(status), colours.get(status + '-soft')) >= 4.5, status);
});

test('light-design source checks resolve nested fallbacks without changing other CSS variables', () => {
  assert.equal(lightThemeSource('color: var(--app-text, var(--owner-ink, #12352d));'), 'color: var(--owner-ink, #12352d);');
  assert.equal(lightThemeSource('background: var(--app-surface, rgba(255, 255, 255, .9));'), 'background: rgba(255, 255, 255, .9);');
});
