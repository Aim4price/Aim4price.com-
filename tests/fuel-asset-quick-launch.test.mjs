import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [fuelPage, fuelClient, internalReturnPath] = await Promise.all([
  read('app/fuel/page.tsx'),
  read('app/fuel/fuel-client.tsx'),
  read('lib/internal-return-path.ts'),
]);

function loadInternalReturnPathHelpers() {
  const output = ts.transpileModule(internalReturnPath, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function('module', 'exports', output)(loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

test('Fuel page accepts an asset quick-add contract and rejects external return targets', () => {
  assert.match(fuelPage, /assetId\?: string \| string\[\]/);
  assert.match(fuelPage, /add\?: string \| string\[\]/);
  assert.match(fuelPage, /action\?: string \| string\[\]/);
  assert.match(fuelPage, /returnTo\?: string \| string\[\]/);
  assert.match(fuelPage, /import \{ normalizeInternalReturnPath, readSingleSearchParam \} from "\.\.\/\.\.\/lib\/internal-return-path"/);
  assert.match(fuelPage, /readSingleSearchParam\(searchParams\?\.add\) === '1'/);
  assert.match(fuelPage, /readSingleSearchParam\(searchParams\?\.action\)\.toLowerCase\(\) === 'add'/);
  assert.match(fuelPage, /normalizeInternalReturnPath\(searchParams\?\.returnTo\)/);
  assert.match(fuelPage, /initialAssetId=\{initialAssetId\}/);
  assert.match(fuelPage, /initialOpenAdd=\{initialOpenAdd\}/);
  assert.match(fuelPage, /initialReturnTo=\{initialReturnTo\}/);

  const { normalizeInternalReturnPath, readSingleSearchParam } = loadInternalReturnPathHelpers();
  assert.equal(readSingleSearchParam([' asset-1 ', 'ignored']), 'asset-1');
  assert.equal(normalizeInternalReturnPath('/asset-register?assetId=asset-1#asset-card-asset-1'), '/asset-register?assetId=asset-1#asset-card-asset-1');
  assert.equal(normalizeInternalReturnPath('https://example.com/asset-register'), '');
  assert.equal(normalizeInternalReturnPath('//example.com/asset-register'), '');
  assert.equal(normalizeInternalReturnPath('/\\example.com/asset-register'), '');
});

test('Fuel quick launch waits for ledger assets and validates the requested asset', () => {
  assert.match(fuelClient, /initialQuickLaunchHandledRef = useRef\(false\)/);
  assert.match(fuelClient, /if \(!initialOpenAdd \|\| initialQuickLaunchHandledRef\.current \|\| isLoading \|\| !hasLoadedLedger\) return/);
  assert.match(fuelClient, /assets\.find\(\(asset\) => asset\.id === requestedAssetId\)/);
  assert.match(fuelClient, /if \(!requestedAsset\.canReceiveFuel\)/);
  assert.match(fuelClient, /is not configured to receive fuel/);
  assert.match(fuelClient, /setFuelSlipDraft\(\{ \.\.\.emptyFuelSlipDraft, targetKey: `asset:\$\{requestedAsset\.id\}` \}\)/);
  assert.match(fuelClient, /setFuelSlipFlow\('source-choice'\)/);
});

test('Fuel quick launch preserves capture choice while bypassing target selection', () => {
  const start = fuelClient.slice(
    fuelClient.indexOf("function startFuelSlipFlow"),
    fuelClient.indexOf("function handleFuelSlipTargetChange"),
  );

  assert.match(start, /const lockedTargetKey = quickLaunchAssetId \? `asset:\$\{quickLaunchAssetId\}` : ''/);
  assert.match(start, /mode,/);
  assert.match(start, /targetKey: lockedTargetKey/);
  assert.match(start, /quickLaunchAssetId[\s\S]*?'manual-form' : 'upload'/);
  assert.match(start, /'target-manual' : 'target-automatic'/);
  assert.match(fuelClient, /setFuelSlipFlow\(quickLaunchAssetId \? 'source-choice' : 'target-manual'\)/);
  assert.match(fuelClient, /handleFuelSlipUploadBack[\s\S]*?quickLaunchAssetId \? 'source-choice' : 'target-automatic'/);
});

test('Quick-launch close and save return only to the same-origin return target', () => {
  const returnHandler = fuelClient.slice(
    fuelClient.indexOf('function returnFromQuickLaunch'),
    fuelClient.indexOf('function closeModal'),
  );

  assert.match(returnHandler, /new URL\(initialReturnTo, window\.location\.origin\)/);
  assert.match(returnHandler, /target\.origin !== window\.location\.origin/);
  assert.match(returnHandler, /window\.location\.assign\(`/);
  assert.match(fuelClient, /if \(shouldReturnToAsset\) returnFromQuickLaunch\(\)/);
  assert.match(fuelClient, /setNotice\(\{ tone: 'success', message: data\.message \|\| 'Fuel Slip saved to Fuel Ledger\.' \}\);[\s\S]*?if \(returnFromQuickLaunch\(\)\) return;/);
});

test('Fuel quick-launch source remains valid TypeScript and TSX', () => {
  for (const [fileName, source] of [['page.tsx', fuelPage], ['fuel-client.tsx', fuelClient]]) {
    const result = ts.transpileModule(source, {
      fileName,
      reportDiagnostics: true,
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    });

    const errors = (result.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
    assert.equal(errors.length, 0, `${fileName}: ${errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n')}`);
  }
});
