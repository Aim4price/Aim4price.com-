const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

test('bulk register read uses one query and excludes foreign owners, unselected registers and removed assets', async () => {
  const db = new PGlite();
  try {
    const a = '00000000-0000-0000-0000-000000000001';
    const b = '00000000-0000-0000-0000-000000000002';
    const c = '00000000-0000-0000-0000-000000000003';
    await db.exec('CREATE TABLE asset_register_items(id text, user_id text, register_id uuid, lifecycle_state text, created_at timestamptz)');
    for (const [id, owner, register, state] of [['a','owner',a,'active'],['b','owner',b,'active'],['foreign','other',a,'active'],['unselected','owner',c,'active'],['removed','owner',a,'removed']]) {
      await db.query('INSERT INTO asset_register_items VALUES ($1,$2,$3,$4,now())',[id,owner,register,state]);
    }
    const source = ts.createSourceFile('source.ts', fs.readFileSync('lib/asset-register-db.ts','utf8'), ts.ScriptTarget.Latest, true);
    const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'listAssetRegisterItemsForRegisters');
    assert(fn);
    const code = ts.transpileModule(fn.getText(source), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const exports = {}; let queries = 0;
    new Function('exports','getDb','getAssetRegisterSchema','resolveColumn','buildSelectList','mapAssetRegisterRow', code)(
      exports, () => ({query: async (...args) => { queries++; return db.query(...args); }}),
      async () => ({columnNames:new Set(['lifecycle_state','created_at'])}),
      (_schema, ...names) => names.includes('created_at') ? 'created_at' : null,
      () => '*', row => row,
    );
    assert.deepEqual((await exports.listAssetRegisterItemsForRegisters('owner',[a,b])).map(r=>r.id).sort(), ['a','b']);
    assert.equal(queries,1);
    assert.deepEqual(await exports.listAssetRegisterItemsForRegisters('owner',[]),[]);
    assert.equal(queries,1,'empty scope must not query all assets');
  } finally { await db.close(); }
});
