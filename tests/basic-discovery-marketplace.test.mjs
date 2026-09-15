import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const nativeRequire = createRequire(import.meta.url);
function load(name, db, extra = '') {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8') + extra;
  const exports = {};
  const require = dependency => {
    if (dependency.startsWith('node:')) return nativeRequire(dependency);
    if (dependency === './marketplace') return { calculateMarketplaceDealRating: () => ({ rating: 'fair', percentDiff: 0 }) };
    if (dependency === './db') return { getDb: () => db };
    if (['./basic-asset-catalogue', './basic-usage-profiles'].includes(dependency)) return load(dependency.slice(2), db);
    return new Proxy({}, { get: () => () => undefined });
  };
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInThisContext(`(function(require,exports){${code}\n})`)(require, exports);
  return exports;
}
const identity = (sector, key, basis = 'reading') => ({
  basic_catalogue_release: 'basic_ballpark_20260907_v1',
  basic_catalogue: { familyKey: key, familyLabel: 'PRIVATE CUSTOM LABEL' },
  basic_usage_profile: { sectorKey: sector },
  basic_usage_basis: basis,
});

test('every reviewed Basic family resolves consistently in JavaScript and PostgreSQL without exposing saved labels', async () => {
  const db = new PGlite();
  try {
    const helper = load('basic-asset-catalogue', db);
    const { BASIC_USAGE_FAMILIES } = load('basic-usage-profiles', db);
    await db.exec('create table fixtures (specs jsonb, label text, metric text)');
    for (const [sector, key, label, metric] of BASIC_USAGE_FAMILIES) {
      const specs = identity(sector, key);
      assert.equal(helper.basicAssetFamily(specs).label, label);
      assert.equal(helper.basicAssetUsage(specs), metric);
      assert.equal(helper.basicAssetUsage({ ...specs, basic_usage_basis: 'percent' }), 'percent');
      await db.query('insert into fixtures values ($1,$2,$3)', [JSON.stringify(specs), label, metric]);
    }
    const result = await db.query(`select count(*)::int as failures from fixtures where
      ${helper.basicAssetFamilySql('specs', 'label')} is distinct from label or
      ${helper.basicAssetUsageSql('specs')} is distinct from metric`);
    assert.equal(result.rows[0].failures, 0);
    for (const specs of [{}, identity('fake', 'compact_tractor'), { ...identity('agricultural', 'compact_tractor'), basic_catalogue_release: 'fake' }]) {
      assert.equal(helper.basicAssetFamily(specs), null);
      const result = await db.query(`select ${helper.basicAssetFamilySql('$1::jsonb', 'label')} as label`, [JSON.stringify(specs)]);
      assert.equal(result.rows[0].label, null);
    }
  } finally { await db.close(); }
});

test('public Discovery lists Basic assets across sectors, filters by family, and preserves privacy and lifecycle rules', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table account_profiles (user_id text, account_type text, account_status text, discovery_participation_enabled boolean, province text);
      create table asset_register_items (id uuid, user_id text, specs_json jsonb, equipment_family_id int, equipment_model_id int, brand_id int,
        selected_method text, kind text, lifecycle_state text, title text, year_model int, hours numeric, life_worked_percent numeric, condition text, updated_at timestamp, created_at timestamp);
      create table equipment_families (id int, family_label text, usage_metric_type text);
      create table equipment_models (id int, brand_id int, model_name text, display_name text);
      create table brands (id int, name text);
      create table asset_discovery_enquiries (asset_register_item_id uuid, status text, request_again_at timestamp);
      insert into account_profiles values ('owner', 'owner', 'active', true, 'Western Cape');
    `);
    const families = load('basic-usage-profiles', db).BASIC_USAGE_FAMILIES;
    const samples = ['agricultural', 'construction', 'industrial', 'motor'].map(sector => families.find(row => row[0] === sector));
    for (const [index, [sector, key]] of samples.entries()) {
      const specs = identity(sector, key, index === 1 ? 'percent' : 'reading');
      await db.query(`insert into asset_register_items (id,user_id,specs_json,selected_method,kind,lifecycle_state,title,year_model,hours,life_worked_percent,condition)
        values ($1,'owner',$2,'aim4price','equipment','active','PRIVATE OWNER TITLE',2020,1200,25,'good')`,
        [`00000000-0000-0000-0000-00000000000${index + 1}`, JSON.stringify(specs)]);
    }
    await db.exec(`alter table asset_register_items add column valuation_run_id uuid, add column brand_name text, add column model_name text, add column typed_model_name text;
      alter table asset_discovery_enquiries add column requester_user_id text;`);
    const discovery = load('asset-discovery', db, '\nexports.baseAssetWhere = baseAssetWhere;');
    const signedInWhere = discovery.baseAssetWhere({ viewerUserId: 'viewer', viewerAccountType: 'dealer' });
    const signedIn = await db.query(`select asset.id from asset_register_items asset
      join account_profiles owner on owner.user_id = asset.user_id
      left join equipment_families family on family.id = asset.equipment_family_id
      left join equipment_models model on model.id = asset.equipment_model_id
      left join brands brand on brand.id = model.brand_id ${signedInWhere.whereClause}`, signedInWhere.params);
    assert.equal(signedIn.rows.length, 4);
    const result = await discovery.listPublicAssetDiscoveryAssets({});
    assert.equal(result.assets.length, 4);
    assert.equal(result.typeOptions.length, 4);
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
    assert.ok(result.assets.some(asset => asset.usage.includes('25%')));
    for (const [, , label] of samples) {
      const filtered = await discovery.listPublicAssetDiscoveryAssets({ type: label });
      assert.equal(filtered.assets.length, 1);
      assert.equal(filtered.assets[0].type, label);
    }
    await db.exec("update asset_register_items set lifecycle_state = 'archived' where id = '00000000-0000-0000-0000-000000000001'");
    assert.equal((await discovery.listPublicAssetDiscoveryAssets({})).assets.length, 3);
    await db.exec('update account_profiles set discovery_participation_enabled = false');
    assert.equal((await discovery.listPublicAssetDiscoveryAssets({})).assets.length, 0);
  } finally { await db.close(); }
});

test('Marketplace uses Basic usage before legacy percentage and vehicle defaults', () => {
  const { listingUsageUnit, buildMarketplaceListing } = load('marketplace-db', null, '\nexports.listingUsageUnit = listingUsageUnit; exports.buildMarketplaceListing = buildMarketplaceListing;');
  const tractor = identity('agricultural', 'compact_tractor');
  for (const listingSnapshot of [false, true]) {
    const listing = buildMarketplaceListing({ id: 'asset', title: 'Tractor', specs_json: tractor, hours: 1200, equipment_family_label: 'Equipment' }, { exposeContact: false, listingSnapshot });
    assert.equal(listing.familyLabel, 'Compact Tractor');
    assert.equal(listing.familyKey, 'compact_tractor');
    assert.equal(listing.usageUnit, 'hours');
  }
  assert.equal(listingUsageUnit({ equipment_family_valuation_mode: 'percent_used' }, tractor, 25, 1200), 'hours');
  assert.equal(listingUsageUnit({}, { ...tractor, basic_usage_basis: 'percent' }, 25, 0), 'percent');
  const motor = load('basic-usage-profiles').BASIC_USAGE_FAMILIES.find(row => row[0] === 'motor' && row[3] === 'km');
  assert.equal(listingUsageUnit({}, identity(motor[0], motor[1]), null, 1200), 'km');
});

test('recent adverts resolve Basic snapshots and live fallbacks with public-safe family and usage filters', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table marketplace_listings (id uuid, user_id text, asset_register_item_id uuid, status text, title text, description text,
        asking_price_ex_vat numeric, province text, area text, seller_name text, seller_company text, primary_image_url text, image_urls jsonb,
        published_at timestamp, created_at timestamp, updated_at timestamp, sector_id int, equipment_family_id int, brand_id int,
        equipment_model_id int, brand_name_snapshot text, model_name_raw text, specs_json jsonb);
      create table marketplace_listing_outcomes (marketplace_listing_id uuid, outcome_reason text);
      create table asset_register_items (id uuid, user_id text, title text, marketplace_notes text, marketplace_price_ex_vat numeric,
        marketplace_province text, marketplace_area text, marketplace_seller_name text, marketplace_seller_company text, photo_urls jsonb,
        updated_at timestamp, created_at timestamp, sector_id int, equipment_family_id int, brand_id int, equipment_model_id int,
        typed_model_name text, specs_json jsonb, year_model int, hours numeric, life_worked_percent numeric, condition text,
        marketplace_status text, lifecycle_state text);
      create table account_profiles (user_id text, business_name text, marketplace_seller_name text, display_name text,
        account_type text, account_subtype text, account_status text);
      create table equipment_families (id int, family_label text, usage_metric_type text, sector_id int);
      create table sectors (id int, sector_label text);
      create table equipment_models (id int, model_name text, brand_id int);
      create table brands (id int, name text);
      insert into account_profiles values ('owner','PRIVATE BUSINESS',null,null,'owner',null,'active');
    `);
    const specs = { ...identity('agricultural', 'compact_tractor', 'percent'), usageAmount: 20, usageUnit: 'percent' };
    await db.query(`insert into asset_register_items (id,user_id,title,specs_json,hours,life_worked_percent,marketplace_status,lifecycle_state,updated_at)
      values ('00000000-0000-0000-0000-000000000001','owner','PRIVATE TITLE',$1,1200,35,'live','active',now())`, [JSON.stringify(specs)]);
    const recent = load('recent-marketplace-adverts', db);
    let result = await recent.listRecentMarketplaceAdverts({});
    assert.equal(result.adverts.length, 1);
    assert.equal(result.adverts[0].type, 'Compact Tractor');
    assert.equal(result.adverts[0].usage, '35% worked');
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
    await db.query(`insert into marketplace_listings (id,user_id,asset_register_item_id,status,title,published_at,specs_json)
      values ('00000000-0000-0000-0000-000000000002','owner','00000000-0000-0000-0000-000000000001','live','PRIVATE TITLE',now(),$1)`, [JSON.stringify(specs)]);
    result = await recent.listRecentMarketplaceAdverts({ type: 'Compact Tractor' });
    assert.equal(result.adverts.length, 1);
    assert.equal(result.adverts[0].usage, '20% worked');
    assert.equal(result.typeOptions[0].label, 'Compact Tractor');
    const signedIn = await recent.listRecentMarketplaceAdverts({ viewerUserId: 'viewer', identityVisible: true });
    assert.equal(signedIn.adverts[0].type, 'Compact Tractor');
    assert.equal(signedIn.adverts[0].usage, '20% worked');
    await db.exec("update asset_register_items set lifecycle_state = 'disposed'");
    assert.equal((await recent.listRecentMarketplaceAdverts({})).adverts.length, 0);
  } finally { await db.close(); }
});
