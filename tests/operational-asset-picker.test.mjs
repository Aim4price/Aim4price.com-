import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function load(path, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => dependencies[name], module, module.exports);
  return module.exports;
}
const { isOperationalAsset, operationalAssetSql } = load('lib/operational-asset.ts');
test('operational assets require both active lifecycle and active QR state', () => {
  assert.equal(isOperationalAsset({}), true);
  assert.equal(isOperationalAsset({ qrStatus: ' ACTIVE ', lifecycleState: 'active' }), true);
  for (const state of ['deleted', 'archived', 'disposed', 'transferred', 'retired']) {
    assert.equal(isOperationalAsset({ lifecycleState: state }), false);
    assert.equal(isOperationalAsset({ qrStatus: state }), false);
  }
});
test('live SQL excludes retained deleted/disposed assets and reacts to removal', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table assets(id int, qr_status text, lifecycle_state text);
      insert into assets values (1,'active','active'), (2,'active','disposed'), (3,'active','archived'), (4,'deleted','active'), (5,'retired','active'), (6,null,null);`);
    const query = `select id from assets a where ${operationalAssetSql('a')} order by id`;
    assert.deepEqual((await db.query(query)).rows.map(row => row.id), [1,6]);
    await db.exec(`update assets set lifecycle_state='disposed' where id=1`);
    assert.deepEqual((await db.query(query)).rows.map(row => row.id), [6]);
  } finally { await db.close(); }
});
test('fuel QR picker excludes removed, ineligible, excluded and unassigned assets', async () => {
  let allowed = ['1'];
  const { fuelScanSelectableAssets } = load('lib/fuel-scan-assets.ts', {
    './owner-app-access': { getOwnerAppAccess: async () => ({ ownerUserId: 'owner' }), ownerAppCanAccessAsset: (_owner, id) => allowed.includes(id) },
  });
  const assets = ['1','2','3','4','5'].map(id => ({ id, isActive: id !== '2', canReceiveFuel: id !== '3', workUseExcluded: id === '4' }));
  for (const accessMode of ['owner_session']) {
    const access = { ownerUserId: 'owner', accessMode, fieldManagerId: 'manager' };
    assert.deepEqual((await fuelScanSelectableAssets(access, assets)).map(a => a.id), ['1']);
    allowed = [];
    assert.deepEqual(await fuelScanSelectableAssets(access, assets), []);
    allowed = ['1'];
  }
  assert.deepEqual((await fuelScanSelectableAssets({ ownerUserId: 'owner', accessMode: 'scan_pin' }, assets)).map(a => a.id), ['1','5']);
});
test('new fuel writes map lifecycle before checking eligibility; QR reads and writes enforce scope', () => {
  const ledger = read('lib/fuel-ledger.ts');
  assert.equal((ledger.match(/as lifecycle_state/g) || []).length, 4);
  assert.match(ledger, /isActive: isOperationalAsset/);
  assert.match(ledger, /if \(!asset.isActive\) throw/);
  for (const file of ['app/api/fuel-scan/storage/[publicFuelStorageCode]/route.ts', 'app/api/fuel-scan/storage/[publicFuelStorageCode]/issue/route.ts']) assert.match(read(file), /(?:fuelScanSelectableAssets|projectManagerFuelScan)\(access,/);
});
