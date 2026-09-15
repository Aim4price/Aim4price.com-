import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('function readRegisterIdFromLocation()'), source.indexOf('function buildAssetGroupsApiUrl('));
const javascript = ts.transpileModule(helpers, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function resolveLocation(path) {
  return vm.runInNewContext(`${javascript}\nbuildAssetRegisterApiUrl(readRegisterIdFromLocation());`, {
    URLSearchParams, COMBINED_REGISTER_ID: '__combined__', window: { location: new URL(path, 'https://www.aim4price.com') },
  });
}

test('clean owner address and old combined links request all registers', () => {
  for (const path of ['/asset-register', '/asset-register?scope=combined', '/asset-register?editUmbrella=group-1']) {
    assert.equal(resolveLocation(path), '/api/asset-register?scope=combined');
  }
});

test('explicit registers and other workspaces preserve their scope', () => {
  assert.equal(resolveLocation('/asset-register?registerId=register-1'), '/api/asset-register?registerId=register-1');
  assert.equal(resolveLocation('/asset-register?dealerView=dealer&registerId=dealer-1'), '/api/asset-register?registerId=dealer-1');
  assert.equal(resolveLocation('/accountant/registers/share-1'), '/api/asset-register');
  assert.equal(resolveLocation('/owner/asset-register'), '/api/asset-register');
});

test('legacy address cleanup preserves deep links, hash and history without navigation', () => {
  const start = source.indexOf('    const url = new URL(window.location.href);', source.indexOf('// Keep old bookmarks'));
  const cleanup = source.slice(start, source.indexOf('    async function loadAccountProfile()', start));
  let replaced;
  vm.runInNewContext(cleanup, {
    URL, dealerRegisterMode: undefined, isAccountantWorkspace: false,
    window: { location: { href: 'https://www.aim4price.com/asset-register?scope=combined&registerId=old&editUmbrella=group-1#assets' },
      history: { state: { retained: true }, replaceState: (...args) => { replaced = args; } } },
  });
  assert.deepEqual(replaced, [{ retained: true }, '', '/asset-register?editUmbrella=group-1#assets']);
});
