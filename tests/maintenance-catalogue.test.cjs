const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', code)(name => name in mocks ? mocks[name] : require(name), exports);
  return exports;
}
const seedModule = load('lib/maintenance-catalogue-seed.ts');
const seed = seedModule.maintenanceCatalogueSeed;
const shared = load('lib/maintenance-catalogue.ts', { './maintenance-catalogue-seed': seedModule });
const basic = key => ({ specsJson: { basic_catalogue_release: 'basic_ballpark_20260907_v1', basic_catalogue: { familyKey: key } } });
const get = asset => shared.resolveMaintenanceChecklist(asset);

test('all 713 Basic and 134 Advanced families resolve to populated explicit checklists', () => {
  shared.validateMaintenanceCatalogue(seed);
  assert.equal(seed.families.filter(f => f.source === 'basic').length, 713);
  assert.equal(seed.families.filter(f => f.source === 'advanced').length, 134);
  for (const f of seed.families) {
    const c = get({ maintenanceIdentity: { source: f.source, sector: f.sector, release: f.release, familyKey: f.familyKey, familyId: f.familyId } });
    assert.equal(c.matched, true, shared.familyAssignmentKey(f));
    assert.notEqual(c.profileKey, 'general'); assert.ok(c.items.length > 0);
  }
});
test('saved nested Basic identity takes priority over an unrelated Advanced tractor ID', () => {
  const c = get({ ...basic('plough'), equipmentFamilyId: 38, equipmentFamilyKey: 'tractors', sectorId: 1 });
  assert.equal(c.profileKey, 'plough'); assert.equal(c.family.source, 'basic');
  assert.ok(c.items.some(i => i.id === 'ploughshares'));
  assert.ok(!c.items.some(i => i.id === 'engine_oil'));
  assert.equal(get({ specsJson: { basic_family_key: 'plough', basic_catalogue_release: 'basic_ballpark_20260907_v1' } }).profileKey, 'plough');
  assert.equal(get({ equipmentFamilyId: 114 }).profileKey, 'plough');
  assert.equal(get({ equipmentFamilyId: 115 }).profileKey, 'chisel_plough');
});
test('tractor attachments, mounted/trailed sprayers and electric equipment stay distinct', () => {
  assert.ok(!get(basic('mounted_tractor_grader')).items.some(i => i.id === 'engine_oil'));
  assert.ok(get(basic('compact_tractor')).items.some(i => i.id === 'oil_filter'));
  assert.ok(get(basic('articulated_tractor')).items.some(i => i.id === 'articulation_joint'));
  assert.ok(get(basic('trailed_boom_sprayer')).items.some(i => i.id === 'drawbar'));
  assert.ok(!get(basic('mounted_boom_sprayer')).items.some(i => i.id === 'drawbar'));
  assert.ok(get(basic('self_propelled_sprayer')).items.some(i => i.id === 'engine_oil'));
  assert.ok(!get(basic('electric_counterbalance_forklift')).items.some(i => i.id === 'fuel_filters'));
  assert.ok(!get(basic('battery_energy_storage_unit')).items.some(i => i.id === 'oil_filter'));
});
test('unknown, wrong-sector and ambiguous identities never guess from an asset title', () => {
  assert.equal(get({ title: 'Tractor', kind: 'tractor' }).profileKey, 'general');
  assert.equal(get({ ...basic('not_in_catalogue'), equipmentFamilyId: 38 }).profileKey, 'general');
  assert.equal(get({ specsJson: { basic_catalogue_release: 'future_release', basic_catalogue: { familyKey: 'plough' } } }).profileKey, 'general');
  assert.equal(get({ equipmentFamilyKey: 'trailers' }).profileKey, 'general');
  assert.equal(get({ equipmentFamilyId: 38, sectorId: 4 }).profileKey, 'general');
  assert.equal(get(null).matched, false);
});
test('completion snapshots survive renaming and serialisation for offline sync', () => {
  const c = get(basic('compact_tractor'));
  const work = shared.buildMaintenanceWorkSnapshot(c, 'serviced', ['Oil filter']);
  const payload = JSON.parse(JSON.stringify([work]));
  const next = structuredClone(seed); next.profiles.find(p => p.key === c.profileKey).items.find(i => i.id === 'oil_filter').serviceLabel = 'New wording';
  shared.validateMaintenanceCatalogue(next);
  assert.deepEqual(shared.validateMaintenanceWork(payload), JSON.parse(JSON.stringify([work])));
  assert.equal(work.items[0].label, 'Oil filter'); assert.equal(work.items[0].action, 'serviced');
  assert.equal(shared.validateMaintenanceWork(undefined), null);
});
test('imports reject missing assignments, duplicate labels, broken profiles and oversized work', () => {
  const dropped = structuredClone(seed); dropped.families.pop(); assert.throws(() => shared.validateMaintenanceCatalogue(dropped), /Keep every/);
  const duplicate = structuredClone(seed); duplicate.profiles[0].items.push({ ...duplicate.profiles[0].items[0] }); assert.throws(() => shared.validateMaintenanceCatalogue(duplicate), /unique/);
  const broken = structuredClone(seed); broken.families[0].profileKey = 'missing'; assert.throws(() => shared.validateMaintenanceCatalogue(broken), /unknown checklist/);
  assert.throws(() => shared.validateMaintenanceWork(Array(13).fill({})), /Invalid/);
  assert.throws(() => shared.validateMaintenanceWork([{ version: 1, family: { source: 'admin' }, mode: 'serviced', profileKey: 'general', items: [] }]), /Invalid/);
});
test('Admin saves persist a complete catalogue and reject stale versions', async () => {
  const pg = new PGlite();
  // PGlite is single-connection. PostgreSQL's transaction advisory lock is tested
  // by the production query; this adapter skips only that unsupported primitive.
  const query = (sql, params) => sql.includes('pg_advisory_xact_lock') ? Promise.resolve({ rows: [] }) : pg.query(sql, params);
  const db = { query, connect: async () => ({ query, release() {} }) };
  const mod = load('lib/maintenance-catalogue-db.ts', { './db': { getDb: () => db }, './maintenance-catalogue-seed': seedModule, './maintenance-catalogue': shared });
  try {
    assert.deepEqual(await mod.getMaintenanceCatalogue(), seed);
    const next = structuredClone(seed); next.profiles[0].label = 'Edited tractors';
    const saved = await mod.saveMaintenanceCatalogue(next, 1, 'admin-user');
    assert.equal(saved.version, 2); assert.equal((await mod.getMaintenanceCatalogue()).profiles[0].label, 'Edited tractors');
    await assert.rejects(mod.saveMaintenanceCatalogue(seed, 1, 'stale-user'), /Catalogue changed/);
    const audit = await pg.query('select version, updated_by from maintenance_catalogue');
    assert.deepEqual(audit.rows, [{ version: 2, updated_by: 'admin-user' }]);
  } finally { await pg.close(); }
});

test('Admin catalogue writes require admin identity, same origin and a valid import', async () => {
  const { NextRequest } = require('next/server');
  let user = null, writes = 0;
  const route = load('app/api/admin/maintenance-catalogue/route.ts', {
    '../../../../lib/auth-session': { getAnyServerSession: async () => user ? { user } : null },
    '../../../../lib/account-constants': { isAim4priceAdminEmail: email => email === 'admin@example.invalid' },
    '../../../../lib/maintenance-catalogue-db': { getMaintenanceCatalogue: async () => seed, saveMaintenanceCatalogue: async input => { shared.validateMaintenanceCatalogue(input); writes++; return input; } },
  });
  const request = (origin = 'https://www.aim4price.com', catalogue = seed) => new NextRequest('https://www.aim4price.com/api/admin/maintenance-catalogue', { method: 'PUT', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ catalogue, expectedVersion: 1 }) });
  assert.equal((await route.GET()).status, 403); assert.equal((await route.PUT(request())).status, 403);
  user = { id: 'owner', email: 'owner@example.invalid' }; assert.equal((await route.PUT(request())).status, 403);
  user = { id: 'admin', email: 'admin@example.invalid' }; assert.equal((await route.PUT(request('https://attacker.example'))).status, 403);
  assert.equal((await route.PUT(request('https://www.aim4price.com', {}))).status, 400); assert.equal(writes, 0);
  assert.equal((await route.PUT(request())).status, 200); assert.equal(writes, 1);
});

test('actual maintenance SQL saves snapshots, preserves them on retry and leaves recurring work empty', async () => {
  const pg = new PGlite();
  const owner = 'owner-one'; const assetId = '11111111-1111-4111-8111-111111111111';
  const query = (sql, params) => /create extension if not exists pgcrypto/.test(sql) ? Promise.resolve({ rows: [] }) : pg.query(sql, params);
  const db = { query, connect: async () => ({ query, release() {} }) };
  await pg.exec(`create table asset_register_items(id uuid primary key,user_id text,title text,kind text,hours numeric,specs_json jsonb,equipment_family_id bigint,sector_id bigint);
    create table equipment_families(id bigint primary key,family_key text,family_label text,sector_id bigint);
    create table valuation_runs(id bigint primary key,equipment_family_id bigint,specs_json jsonb);
    create table equipment_models(id bigint primary key,equipment_family_id bigint);
    create table field_managers(id uuid primary key,display_name text);
    create table asset_scan_events(id uuid primary key,created_at timestamptz);
    insert into equipment_families values(38,'tractors','Tractors',1);
    insert into asset_register_items values('${assetId}','${owner}','Test tractor','tractor',100,'{}',38,1);`);
  const asset = { id: assetId, title: 'Test tractor', userId: owner, kind: 'tractor', hours: 100, equipmentFamilyId: 38, sectorId: 1, specsJson: {} };
  const mod = load('lib/asset-maintenance.ts', {
    './db': { getDb: () => db }, './maintenance-catalogue': shared,
    './asset-register-db': { getAssetRegisterItemById: async (user, id) => user === owner && id === assetId ? asset : null },
    './asset-registers': {}, './asset-usage': { resolveAssetUsage: () => ({ metric: 'hours', reading: 100 }) },
    './field-manager': { ensureFieldManagerTables: async () => {} }, './scan-assets': {},
    './database-schema-readiness': { isDatabaseSchemaReady: async f => { try { await f(); return true; } catch { return false; } } },
  });
  try {
    const work = JSON.parse(JSON.stringify([shared.buildMaintenanceWorkSnapshot(get({equipmentFamilyId:38}), 'checked', ['Oil filter'])]));
    const input = { assetId, maintenanceType: 'checkup', sourceScanEventId: '22222222-2222-4222-8222-222222222222', completedNotes: 'Checked\nChecked items: Oil filter', completedBy: 'Tester', maintenanceWork: work };
    const first = await mod.recordStandaloneAssetMaintenanceCompletion(owner, input);
    assert.deepEqual(first.maintenanceWork, work);
    const retry = await mod.recordStandaloneAssetMaintenanceCompletion(owner, { ...input, maintenanceWork: [] });
    assert.equal(retry.id, first.id); assert.deepEqual(retry.maintenanceWork, work);
    await assert.rejects(mod.recordStandaloneAssetMaintenanceCompletion('other-owner', input), /ASSET_NOT_FOUND/);
    const scheduledId = '33333333-3333-4333-8333-333333333333';
    await pg.query(`insert into asset_maintenance_records(id,user_id,asset_register_item_id,maintenance_type,trigger_type,status,title,due_date,recurring_enabled,recurring_interval_value,recurring_interval_unit) values($1,$2,$3,'checkup','date','upcoming','Check',current_date,true,1,'months')`, [scheduledId, owner, assetId]);
    const result = await mod.completeAssetMaintenanceRecord(owner, scheduledId, { completedNotes: input.completedNotes, completedBy: 'Tester', maintenanceWork: work });
    assert.deepEqual(result.completed.maintenanceWork, work); assert.ok(result.nextRecord); assert.equal(result.nextRecord.maintenanceWork, null);
    const again = await mod.completeAssetMaintenanceRecord(owner, scheduledId, { maintenanceWork: [] });
    assert.deepEqual(again.completed.maintenanceWork, work);
    assert.equal((await pg.query('select count(*)::int as n from asset_maintenance_records where generated_from_maintenance_id=$1', [scheduledId])).rows[0].n, 1);
  } finally { await pg.close(); }
});

test('scan insertion and history queries retain checklist snapshots without changing old notes', async () => {
  const pg = new PGlite();
  const assetId = '11111111-1111-4111-8111-111111111111';
  const work = JSON.parse(JSON.stringify([shared.buildMaintenanceWorkSnapshot(get(basic('plough')), 'checked', ['Ploughshares'])]));
  await pg.exec(`create table asset_scan_events(id uuid primary key default gen_random_uuid(),asset_id uuid,actor_type text,operator_name text,hours numeric,fuel_percent integer,condition text,note text,maintenance_work jsonb,photo_urls jsonb,latitude double precision,longitude double precision,location_text text,client_event_id text,client_captured_at timestamptz,synced_at timestamptz,gps_accuracy_meters double precision,field_manager_id uuid,field_manager_display_name text,field_manager_session_id text,asset_usage_reading numeric,asset_usage_metric text,source_type text,source_label text,created_at timestamptz,maintenance_noted_at timestamptz);`);
  try {
    const source = fs.readFileSync('lib/scan-assets.ts','utf8');
    const insert = source.slice(source.indexOf('const insertedEvent =')).match(/`([\s\S]*?)`/)[1];
    const result = await pg.query(insert, [assetId,'owner_session','Tester',null,null,null,'Checked\nChecked items: Ploughshares','[]',-25.7,28.2,'GPS','event-one',null,10,null,null,null,null,'percentage','asset_qr_scan','QR Scan',JSON.stringify(work)]);
    assert.deepEqual(result.rows[0].maintenance_work,work);
    const scan = load('lib/scan-assets.ts', {
      './db': { getDb: () => pg }, './maintenance-catalogue': shared,
      './asset-display-title': {}, './asset-owner-resolver': {}, './asset-register-uploads': {MAX_ASSET_REGISTER_PHOTOS:12},
      './asset-usage': {}, './fuel-ledger': {ensureFuelLedgerTables:async()=>{}}, './account-profile': {}, './asset-depreciation-timeline': {}, './usage-readings': {toFiniteNumberOrNull:v=>v==null?null:Number(v)},
    });
    const history = await scan.listCompletedMaintenanceScanEventsForAssets([assetId]);
    assert.equal(history.length,1);assert.deepEqual(history[0].maintenanceWork,work);assert.match(history[0].sourceNote,/Ploughshares/);
    const latest = await scan.attachLatestMaintenanceStatusToAssets([{id:assetId}]);
    assert.deepEqual(latest[0].latestMaintenanceStatus.maintenanceWork,work);
  } finally { await pg.close(); }
});

test('specialist family choices exclude unrelated components in both catalogues', () => {
  const ids = asset => get(asset).items.map(i => i.id);
  for (const asset of [basic('mounted_tractor_tree_shaker'), {equipmentFamilyId: 51}]) {
    assert.ok(ids(asset).includes('clamp_pads'));
    assert.ok(!ids(asset).includes('cutting_and_picking_parts'));
  }
  for (const asset of [basic('disc_harrow'), {equipmentFamilyId: 118}]) {
    assert.ok(ids(asset).includes('discs'));
    assert.ok(!ids(asset).includes('points_and_tines'));
  }
  assert.ok(ids(basic('refrigerated_truck')).includes('refrigeration_unit'));
  assert.ok(!ids(basic('vehicle_diagnostic_scanner')).includes('lenses_and_optics'));
  assert.ok(ids(basic('vehicle_diagnostic_scanner')).includes('diagnostic_cable'));
  assert.ok(!ids(basic('golf_cart')).includes('cabin_filter'));
  assert.ok(!ids(basic('mobile_scaffold_tower')).includes('emergency_lowering'));
  assert.ok(ids(basic('two_post_vehicle_lift')).includes('safety_locks'));
  assert.ok(!ids(basic('air_receiver')).includes('drive_mechanism'));
  assert.ok(!ids(basic('plastic_mulch_layer')).includes('seed_meters'));
});
