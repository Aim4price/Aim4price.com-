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
const shared = load('lib/asset-checklist.ts');
const catalogue = load('lib/maintenance-catalogue.ts', { './maintenance-catalogue-seed': load('lib/maintenance-catalogue-seed.ts') });
const report = load('lib/asset-checklist-report.ts', { './maintenance-catalogue': catalogue, './report-theme': load('lib/report-theme.ts') });
const A = '10000000-0000-4000-8000-000000000001';
const B = '10000000-0000-4000-8000-000000000002';
const item = { mode: 'checked', label: 'Check replacement belt', description: 'Inspect for cracks.' };

test('custom item validation rejects invalid types, blank labels, oversized text and control characters', () => {
  assert.deepEqual(shared.validateAssetChecklistItem({ ...item, label: '  Belt  ' }), { ...item, label: 'Belt' });
  for (const value of [null, {}, { ...item, mode: 'all' }, { ...item, label: '' }, { ...item, label: 'a'.repeat(161) }, { ...item, label: 'a\nb' }, { ...item, description: 'a'.repeat(501) }]) assert.throws(() => shared.validateAssetChecklistItem(value));
});

test('saved tasks appear only in their intended mode and survive completion snapshot validation', () => {
  const checklist = { ...catalogue.resolveMaintenanceChecklist(null), customItems: [
    { ...item, id: A }, { ...item, id: B, mode: 'repaired', label: 'Replace unique bracket' },
  ] };
  assert.ok(catalogue.checklistOptions(checklist, 'checked').some(i => i.label === item.label));
  assert.ok(!catalogue.checklistOptions(checklist, 'serviced').some(i => i.label === item.label));
  const snapshot = catalogue.buildMaintenanceWorkSnapshot(checklist, 'repaired', ['Replace unique bracket']);
  assert.equal(snapshot.items[0].id, `asset_custom_${B}`);
  assert.doesNotThrow(() => catalogue.validateMaintenanceWork([snapshot]));
  assert.ok(!catalogue.checklistOptions(catalogue.resolveMaintenanceChecklist(null), 'checked').some(i => i.label === item.label));
});

test('SQL persists items per user and asset, forbids foreign reads/writes/deletes and blocks ownership-transfer leakage', async () => {
  const pg = new PGlite();
  await pg.exec('create table asset_register_items (id uuid primary key, user_id text not null)');
  await pg.query('insert into asset_register_items values ($1, $2), ($3, $4)', [A, 'alice', B, 'bob']);
  const client = { query: (sql, params) => pg.query(sql, params), release() {} };
  const db = { ...client, connect: async () => client };
  const mod = load('lib/asset-checklist-db.ts', { './db': { getDb: () => db }, './database-schema-readiness': load('lib/database-schema-readiness.ts'), './asset-checklist': shared });
  try {
    const saved = await mod.addAssetChecklistItem('alice', A, item);
    assert.equal((await mod.listAssetChecklistItems('alice', A))[0].label, item.label);
    assert.equal((await mod.listAssetChecklistItems('bob', B)).length, 0);
    await assert.rejects(mod.listAssetChecklistItems('bob', A), /ASSET_NOT_FOUND/);
    await assert.rejects(mod.addAssetChecklistItem('bob', A, item), /ASSET_NOT_FOUND/);
    await assert.rejects(mod.removeAssetChecklistItem('bob', B, saved.id), /ITEM_NOT_FOUND/);
    await assert.rejects(mod.removeAssetChecklistItem('bob', A, saved.id), /ASSET_NOT_FOUND/);
    await assert.rejects(mod.listAssetChecklistItems('alice', 'invalid'), /ASSET_NOT_FOUND/);
    await pg.query('update asset_register_items set user_id = $1 where id = $2', ['bob', A]);
    assert.equal((await mod.listAssetChecklistItems('bob', A)).length, 0);
    await assert.rejects(mod.listAssetChecklistItems('alice', A), /ASSET_NOT_FOUND/);
    await pg.query('update asset_register_items set user_id = $1 where id = $2', ['alice', A]);
    await mod.removeAssetChecklistItem('alice', A, saved.id);
    assert.equal((await mod.listAssetChecklistItems('alice', A)).length, 0);
    for (let n = 0; n < 60; n++) await mod.addAssetChecklistItem('alice', A, { ...item, label: `Task ${n}` });
    await assert.rejects(mod.addAssetChecklistItem('alice', A, item), /60 custom items/);
    await pg.query('delete from asset_register_items where id = $1', [A]);
    assert.equal((await pg.query('select * from asset_checklist_items')).rows.length, 0);
  } finally { await pg.close(); }
});

test('printable HTML escapes all user content and has blank checkboxes, fault space and signatures', () => {
  const checklist = { ...catalogue.resolveMaintenanceChecklist(null), customItems: [{ ...item, id: A, label: '<script>alert(1)</script>', description: '<img src="https://bad.example">' }] };
  const html = report.buildAssetChecklistReportHtml({ title: '<b>Asset</b>', serialNumber: '<iframe>' }, checklist);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;b&gt;Asset&lt;/b&gt;'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('<span class="checkbox"></span>'));
  assert.ok(html.includes('Checked by / signature:'));
  assert.ok(html.includes('Additional work / faults / follow-up'));
  assert.ok(!html.includes('✓'));
});

test('checklist and PDF routes reject unauthenticated callers and never accept a client owner id', async () => {
  const { NextRequest, NextResponse } = require('next/server');
  let accessed = false;
  const mocks = {
    'next/server': { NextRequest, NextResponse },
    '../../../../lib/auth-session': { getServerSession: async () => null },
    '../../../../lib/asset-checklist-db': { listAssetChecklistItems: () => { accessed = true; } },
  };
  const route = load('app/api/maintenance/checklist/route.ts', mocks);
  for (const method of ['GET', 'POST', 'DELETE']) {
    const response = await route[method](new NextRequest(`https://test/api/maintenance/checklist?assetId=${A}&userId=alice`));
    assert.equal(response.status, 401);
  }
  assert.equal(accessed, false);
  const authenticated = load('app/api/maintenance/checklist/route.ts', { ...mocks,
    '../../../../lib/auth-session': { getServerSession: async () => ({ user: { id: 'bob' } }) },
    '../../../../lib/asset-checklist-db': { listAssetChecklistItems: async user => { assert.equal(user, 'bob'); return []; } },
  });
  const response = await authenticated.GET(new NextRequest(`https://test/api/maintenance/checklist?assetId=${A}&userId=alice`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  for (const method of ['POST', 'DELETE']) {
    const blocked = await authenticated[method](new NextRequest(`https://test/api/maintenance/checklist?assetId=${A}`, { method, headers: { origin: 'https://other.example' } }));
    assert.equal(blocked.status, 403);
  }
  const pdf = load('app/api/maintenance/checklist/pdf/route.ts', {
    'next/server': { NextRequest, NextResponse },
    '../../../../../lib/auth-session': { getServerSession: async () => null },
    '../../../../../lib/asset-checklist-db': {}, '../../../../../lib/asset-register-db': {},
    '../../../../../lib/maintenance-catalogue-db': {}, '../../../../../lib/maintenance-catalogue': {},
    '../../../../../lib/asset-checklist-report': {}, '../../../../../lib/report-pdf': {},
  });
  assert.equal((await pdf.GET(new NextRequest('https://test/api/maintenance/checklist/pdf'))).status, 401);
});

test('PDF includes only selected items and keeps the same item ID separate across sections', () => {
  const checklist = { ...catalogue.resolveMaintenanceChecklist(null), customItems: [{ ...item, id: A }, { ...item, id: B, mode: 'repaired', label: 'Replace bracket' }] };
  const selected = [`checked:asset_custom_${A}`, `repaired:asset_custom_${B}`];
  const html = report.buildAssetChecklistReportHtml({ title: 'Tractor' }, checklist, selected);
  assert.ok(html.includes(item.label));
  assert.ok(html.includes('Replace bracket'));
  assert.ok(!html.includes('Visible damage and loose parts'));
  assert.ok(!html.includes('<h2>Service items</h2>'));
  const empty = report.buildAssetChecklistReportHtml({ title: 'Tractor' }, checklist, []);
  assert.ok(!empty.includes('<span class="checkbox"></span>'));
  const modeChecklist = { ...checklist, items: [{ id: 'hydraulic_hose', label: 'Hose', checkLabel: 'Inspect hose', serviceLabel: 'Replace hose', description: '' }] };
  const oneMode = report.buildAssetChecklistReportHtml({ title: 'Tractor' }, modeChecklist, ['checked:hydraulic_hose']);
  assert.ok(oneMode.includes('Inspect hose'));
  assert.ok(!oneMode.includes('Replace hose'));
});

test('PDF endpoint validates selected IDs against the owned asset and rejects empty selections', async () => {
  const { NextRequest, NextResponse } = require('next/server');
  let rendered = '';
  const api = load('app/api/maintenance/checklist/pdf/route.ts', {
    'next/server': { NextRequest, NextResponse },
    '../../../../../lib/auth-session': { getServerSession: async () => ({ user: { id: 'alice' } }) },
    '../../../../../lib/asset-checklist-db': { listAssetChecklistItems: async (owner, assetId) => { assert.equal(owner, 'alice'); if(assetId !== A) throw Error('ASSET_NOT_FOUND'); return [{ ...item, id: A }]; } },
    '../../../../../lib/asset-register-db': { getAssetRegisterItemById: async () => ({ title: 'Tractor' }) },
    '../../../../../lib/maintenance-catalogue-db': { getMaintenanceCatalogue: async () => undefined },
    '../../../../../lib/maintenance-catalogue': catalogue,
    '../../../../../lib/asset-checklist-report': report,
    '../../../../../lib/report-pdf': { renderReportHtmlToPdf: async html => { rendered = html; return Buffer.from('%PDF-fixture'); } },
  });
  for (const query of ['', '&item=checked:foreign-item']) {
    assert.equal((await api.GET(new NextRequest(`https://test/api/maintenance/checklist/pdf?assetId=${A}${query}`))).status, 400);
  }
  assert.equal(rendered, '');
  const result = await api.GET(new NextRequest(`https://test/api/maintenance/checklist/pdf?assetId=${A}&item=checked:asset_custom_${A}&item=checked:foreign-item`));
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('Content-Type'), 'application/pdf');
  assert.ok(rendered.includes(item.label));
  assert.ok(!rendered.includes('Visible damage and loose parts'));
  assert.equal((await api.GET(new NextRequest(`https://test/api/maintenance/checklist/pdf?assetId=${B}&item=checked:asset_custom_${A}`))).status, 404);
});
