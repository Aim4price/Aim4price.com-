import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

function load(file, dependencies = {}) {
  const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

test('existing schema without umbrella flags runs the runtime upgrade before group reads', async () => {
  const db = new PGlite();
  const readiness = load('../lib/database-schema-readiness.ts');
  try {
    await db.exec(`
      create table asset_registers (id text, user_id text, business_name text, email text, phone text,
        address_line_1 text, logo_urls jsonb, show_logos_on_register boolean, is_primary boolean,
        is_selected boolean, created_at timestamptz, updated_at timestamptz);
      create table asset_register_items (id text, user_id text, register_id text, lifecycle_state text,
        license_renewal_alert_noted_for_date date, license_renewal_alert_noted_at timestamptz);
      create table asset_groups (id text, user_id text, register_id text not null, name text,
        value_mode text, created_at timestamptz, updated_at timestamptz);
      create table asset_group_members (group_id text, asset_id text, role text, relationship text,
        counts_toward_total boolean, sort_order integer, created_at timestamptz);
      insert into asset_groups (id, register_id, name) values ('umbrella', 'register', 'Farm equipment');
    `);
    let upgrades = 0;
    let probes = 0;
    const makeRuntime = () => load('../lib/asset-registers.ts', {
      './database-schema-readiness': readiness,
      './db': { getDb: () => ({ query: async (sql, args) => {
        // Run the actual readiness probe and umbrella upgrade against PostgreSQL.
        // Unrelated legacy setup statements are outside this regression's scope.
        if (sql.includes('with register_schema as')) { probes++; return db.query(sql, args); }
        if (/alter table if exists public\.asset_groups\s/.test(sql)) {
          upgrades++;
          return db.query(sql, args);
        }
        return { rows: [] };
      } }) },
    });
    await assert.rejects(db.query('select asset_group.is_flagged from asset_groups asset_group'), { code:'42703' });
    const runtime = makeRuntime();
    await runtime.ensureAssetRegisterTables();
    assert.equal(upgrades, 1, 'missing column must prevent the schema-ready early return');
    assert.deepEqual((await db.query('select name, is_flagged from asset_groups')).rows,
      [{ name:'Farm equipment', is_flagged:false }]);
    await db.exec("update asset_groups set is_flagged = true where id = 'umbrella'");
    await runtime.ensureAssetRegisterTables();
    assert.equal(probes, 1, 'successful setup is cached within the process');
    await makeRuntime().ensureAssetRegisterTables();
    assert.equal(probes, 2);
    assert.equal(upgrades, 1, 'a fresh process recognises the upgraded schema');
    assert.equal((await db.query('select is_flagged from asset_groups')).rows[0].is_flagged, true,
      'subsequent setup preserves saved flags');
  } finally { await db.close(); }
});
