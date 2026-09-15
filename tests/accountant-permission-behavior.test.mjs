import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Execute the real permission helpers and mutation entry points. Extracting the
// declarations keeps unrelated database initializers out of these unit cases.
const source = readFileSync(new URL('../lib/accountant-workspace.ts', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('workspace.ts', source, ts.ScriptTarget.Latest, true);
const names = ['authorisedAsset', 'authorisedSharedDocumentAsset', 'updateAccountantFinance', 'saveAccountantCarryingValue', 'uploadAccountantDocument'];
const declarations = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(parsed)).join('\n');
assert.equal(parsed.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).length, names.length);
function permissions({ writable = false, exists = true, registerId = 'shared', revoked = false } = {}) {
  let reachedWrite = false;
  const module = { exports: {} };
  const compiled = ts.transpileModule(declarations + '\nexport { authorisedAsset, authorisedSharedDocumentAsset };', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('exports', 'loadAccess', 'getAssetRegisterItemById', 'getAssetRegisterForUser', 'getAccountProfile', compiled)(
    module.exports,
    async () => { if (revoked) throw Error('ACCOUNTANT_ACCESS_REMOVED'); return { allowDirectUpdates: writable, ownerUserId: 'owner', registerId: 'shared' }; },
    async (owner, id) => { assert.equal(owner, 'owner'); return exists ? { id, registerId } : null; },
    async (owner, id) => { assert.equal(owner, 'owner'); return { id }; },
    async () => { reachedWrite = true; throw Error('Unexpected mutation'); },
  );
  return { ...module.exports, reachedWrite: () => reachedWrite };
}
for (const operation of ['updateAccountantFinance', 'saveAccountantCarryingValue', 'uploadAccountantDocument']) {
  test(`${operation} rejects read-only access before loading or writing data`, async () => {
    const api = permissions();
    await assert.rejects(api[operation]({ accountantUserId: 'accountant', shareId: 'share', assetId: 'asset' }), /ACCOUNTANT_READ_ONLY/);
    assert.equal(api.reachedWrite(), false);
  });
}
test('document access rejects assets outside the shared register', async () => {
  const api = permissions({ writable: true, registerId: 'other' });
  await assert.rejects(api.authorisedSharedDocumentAsset('accountant', 'share', 'asset', true), /ACCOUNTANT_ASSET_NOT_FOUND/);
});
test('removed access and foreign-owner assets cannot reach mutation code', async () => {
  await assert.rejects(permissions({ revoked: true }).updateAccountantFinance({}), /ACCOUNTANT_ACCESS_REMOVED/);
  await assert.rejects(permissions({ writable: true, exists: false }).saveAccountantCarryingValue({}), /ACCOUNTANT_ASSET_NOT_FOUND/);
});
test('authorized shared-document reads preserve the owner and register boundary', async () => {
  const result = await permissions().authorisedSharedDocumentAsset('accountant', 'share', 'asset');
  assert.equal(result.access.ownerUserId, 'owner');
  assert.equal(result.asset.registerId, 'shared');
});
