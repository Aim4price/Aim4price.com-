const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

function load(name, mocks) {
  const exports = {};
  const code = ts.transpileModule(readFileSync('lib/' + name + '.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'exports', code)(key => mocks[key] ?? require(key), exports);
  return exports;
}

test('Get Value options support creation, reclassification, archival, restoration and version checks', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create table sectors(id serial primary key, sector_key text, sector_label text, is_active boolean default true);
      insert into sectors(sector_key,sector_label) values ('agricultural','Agricultural'),('industrial','Industrial');
      create table equipment_families(id serial primary key,sector_id int, family_key text,family_label text,
        is_propelled boolean,usage_metric_type text,valuation_mode text,catalog_mode text,sort_order int,is_active boolean);
      insert into equipment_families(sector_id,family_key,family_label,is_active) values(1,'trailers','Trailers',true);`);
    const db = { async query(sql, values) {
      const result = await pg.query(sql, values);
      return { rows: result.rows, rowCount: result.affectedRows };
    }, async connect() { return {...db,release() {}}; } };
    const mocks = {
      './db': {getDb: () => db, withDatabaseClient: (_, work) => work()},
      './equipment-types': load('equipment-types', {}),
      './basic-catalogue': {basicCatalogueEnabled: () => true, listBasicCatalogueFamilies: async () => [
        {sectorKey:'agricultural',familyKey:'tractor',familyLabel:'Compact tractor',isActive:true,basicCatalogue:{familyLabel:'Compact tractor'}},
      ]},
    };
    mocks['./equipment-catalog'] = load('equipment-catalog', mocks);
    const { listAssetOptions, listValuationOptions, saveAssetOption } = load('asset-options-db', mocks);
    const initial = await listAssetOptions();
    assert.equal(initial.length, 2);
    const tractor = initial.find(row => row.mode === 'basic');
    await saveAssetOption({...tractor, label:'Small tractor', sector:'industrial'});
    const moved = await listValuationOptions('basic','industrial',true);
    assert.equal(moved[0].familyLabel, 'Small tractor');
    assert.equal(moved[0].sectorKey, 'agricultural');
    const created = await saveAssetOption({id:'',label:'Farm cart',sector:'agricultural',mode:'both',archived:false,version:0});
    for (const mode of ['basic','advanced']) assert.ok((await listValuationOptions(mode,'agricultural',true)).some(row => row.optionId === created.id));
    await assert.rejects(saveAssetOption({...created,id:'',version:0}), /already exists/);
    const archived = await saveAssetOption({...created,archived:true});
    await assert.rejects(saveAssetOption(created), /changed/);
    assert.equal((await listValuationOptions('basic','agricultural',true)).length, 0);
    assert.equal((await db.query('select count(*) from equipment_families')).rows[0].count, 2);
    await saveAssetOption({...archived,archived:false});
    assert.equal((await listValuationOptions('basic','agricultural',true))[0].optionId, created.id);
  } finally { await pg.close(); }
});
