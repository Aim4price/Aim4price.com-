import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function loadAssetIdSelectionHelpers() {
  const source = await readFile(
    new URL('../app/api/asset-register/export/route.ts', import.meta.url),
    'utf8',
  );
  const start = source.indexOf('const MAX_ASSET_EXPORT_IDS');
  const end = source.indexOf('function requestedAssetsNotFound');

  assert.ok(start >= 0 && end > start, 'asset ID selection helpers should stay available for focused tests');

  const helperSource = `${source.slice(start, end)}
module.exports = {
  MAX_ASSET_EXPORT_IDS,
  parseRequestedAssetIds,
  selectAuthorizedAssetIds,
};`;
  const output = ts.transpileModule(helperSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function('module', 'exports', 'URLSearchParams', output)(
    loadedModule,
    loadedModule.exports,
    URLSearchParams,
  );
  return loadedModule.exports;
}

test('assetIds is optional, ordered, and deduplicated across repeated query parameters', async () => {
  const { parseRequestedAssetIds } = await loadAssetIdSelectionHelpers();

  assert.deepEqual(parseRequestedAssetIds(new URLSearchParams('format=pdf')), {
    requested: false,
    ids: [],
    error: null,
  });
  assert.deepEqual(
    parseRequestedAssetIds(new URLSearchParams([
      ['assetIds', 'asset-1,asset-2'],
      ['assetIds', 'asset-2,asset_3'],
    ])),
    {
      requested: true,
      ids: ['asset-1', 'asset-2', 'asset_3'],
      error: null,
    },
  );
});

test('assetIds rejects empty, unsafe, overlong, and oversized selections', async () => {
  const { MAX_ASSET_EXPORT_IDS, parseRequestedAssetIds } = await loadAssetIdSelectionHelpers();

  assert.equal(parseRequestedAssetIds(new URLSearchParams('assetIds=')).error, 'invalid');
  assert.equal(parseRequestedAssetIds(new URLSearchParams('assetIds=asset%2Fsecret')).error, 'invalid');
  assert.equal(parseRequestedAssetIds(new URLSearchParams(`assetIds=${'a'.repeat(129)}`)).error, 'invalid');

  const maximumIds = Array.from({ length: MAX_ASSET_EXPORT_IDS }, (_, index) => `asset-${index + 1}`);
  assert.equal(
    parseRequestedAssetIds(new URLSearchParams({ assetIds: maximumIds.join(',') })).error,
    null,
  );
  assert.equal(
    parseRequestedAssetIds(new URLSearchParams({ assetIds: [...maximumIds, 'one-too-many'].join(',') })).error,
    'too_many',
  );
});

test('requested IDs can only narrow the authorized asset set', async () => {
  const { parseRequestedAssetIds, selectAuthorizedAssetIds } = await loadAssetIdSelectionHelpers();
  const authorized = [{ id: 'asset-1' }, { id: 'asset-2' }, { id: 'asset-3' }];

  const absentSelection = parseRequestedAssetIds(new URLSearchParams());
  assert.deepEqual([...selectAuthorizedAssetIds(authorized, absentSelection)], ['asset-1', 'asset-2', 'asset-3']);

  const validSelection = parseRequestedAssetIds(new URLSearchParams({ assetIds: 'asset-3,asset-1' }));
  assert.deepEqual([...selectAuthorizedAssetIds(authorized, validSelection)], ['asset-3', 'asset-1']);

  const mixedSelection = parseRequestedAssetIds(new URLSearchParams({ assetIds: 'asset-1,other-owner-asset' }));
  assert.equal(selectAuthorizedAssetIds(authorized, mixedSelection), null);
});

test('the route applies assetIds only after register and umbrella authorization scopes', async () => {
  const source = await readFile(
    new URL('../app/api/asset-register/export/route.ts', import.meta.url),
    'utf8',
  );

  const scopedBundlesIndex = source.indexOf('const scopedRawBundles = requestedGroup');
  const scopedSelectionIndex = source.indexOf('scopedRawBundles.flatMap((bundle) => bundle.items)');
  const scopedItemsIndex = source.indexOf('const scopedRawItems = requestedGroup');
  const itemSelectionIndex = source.indexOf('selectAuthorizedAssetIds(scopedRawItems, assetIdSelection)');

  assert.ok(scopedBundlesIndex >= 0 && scopedSelectionIndex > scopedBundlesIndex);
  assert.ok(scopedItemsIndex >= 0 && itemSelectionIndex > scopedItemsIndex);
  assert.match(source, /items: bundle\.items\.filter\(\(item\) => selectedAssetIds\.has\(item\.id\)\)/);
  assert.match(source, /scopedRawItems\.filter\(\(item\) => selectedAssetIds\.has\(item\.id\)\)/);
  assert.match(source, /if \(!selectedAssetIds\) \{\s*return requestedAssetsNotFound\(\);\s*\}/);
  assert.match(source, /\{ ok: false, error: 'One or more requested assets could not be found\.' \}/);
  assert.doesNotMatch(source, /requestedAssetsNotFound\([^)]/);
});
