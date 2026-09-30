import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

for (const [file, script, attribute, path] of [
  ['background-preference', 'BACKGROUND_PREFERENCE_SCRIPT', 'background', '/auth'],
  ['app-theme', 'APP_THEME_SCRIPT', 'appTheme', '/dealer/login'],
]) {
  test(`${file} defaults dark before paint and respects an explicit light choice`, () => {
    const source = readFileSync(new URL(`../lib/${file}.ts`, import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    for (const saved of [null, 'dark', 'light', 'invalid', 'blocked']) {
      const module = { exports: {} };
      const document = { documentElement: { dataset: {} } };
      const context = vm.createContext({ module, exports: module.exports, document, location: { pathname: path },
        localStorage: { getItem() { if (saved === 'blocked') throw Error('blocked'); return saved; } } });
      vm.runInContext(code, context);
      vm.runInContext(module.exports[script], context);
      assert.equal(document.documentElement.dataset[attribute], saved === 'light' ? 'light' : 'dark');
      if (module.exports.readAppTheme) assert.equal(module.exports.readAppTheme('dealer'), saved === 'light' ? 'light' : 'dark');
    }
  });
}
