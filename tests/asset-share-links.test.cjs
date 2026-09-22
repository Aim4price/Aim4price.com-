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
const A = '10000000-0000-4000-8000-000000000001';
const B = '10000000-0000-4000-8000-000000000002';
const snapshot = load('lib/asset-share-snapshot.ts', {
  './asset-usage': load('lib/asset-usage.ts'),
  './tractor-logic': { conditionLabel: key => key === 'good' ? 'Good' : key },
});
const asset = { id: A, userId: 'alice', title: 'Tractor', serialNumber: 'ABC123', kind: 'tractor', yearModel: 2020, hours: 300, condition: 'good', value: 123456, replacementPriceExVat: 200000, photos: ['/api/asset-register/uploads/abc-123', 'javascript:alert(1)'], note: 'PRIVATE', financeNote: 'PRIVATE', documents: [{ name: 'PRIVATE' }], lastKnownLat: 22 };
test('snapshot includes only public fields, opt-in photos and correct usage', () => {
  const saved = snapshot.assetShareSnapshot(asset, false);
  assert.equal(saved.usage, '300 hours');
  assert.equal(saved.condition, 'Good');
  assert.deepEqual(saved.photoUrls, []);
  assert.ok(!JSON.stringify(saved).includes('PRIVATE'));
  for (const key of ['id', 'userId', 'documents', 'note', 'lastKnownLat', 'financeNote']) assert.ok(!(key in saved));
  assert.deepEqual(snapshot.assetShareSnapshot(asset, true).photoUrls, ['/api/asset-register/uploads/abc-123']);
  for (const ids of [null, [], ['not-id'], Array(101).fill(A)]) assert.throws(() => snapshot.parseShareAssetIds(ids));
});
test('SQL persists and reuses snapshots, enforces owner scope, revocation and asset lifecycle', async () => {
  const pg = new PGlite();
  await pg.exec('CREATE TABLE asset_register_items(id uuid PRIMARY KEY, user_id text NOT NULL)');
  await pg.query('INSERT INTO asset_register_items VALUES($1,$2),($3,$4)', [A, 'alice', B, 'bob']);
  let title = 'Original tractor';
  const db = { query: (sql, params) => params ? pg.query(sql, params) : pg.exec(sql) };
  const mod = load('lib/asset-share-links.ts', {
    './db': { getDb: () => db }, './asset-share-snapshot': snapshot,
    './asset-register-db': { getAssetRegisterItemsByRefs: async refs => {
      const rows = (await pg.query('SELECT * FROM asset_register_items')).rows;
      return rows.filter(row => refs.some(ref => ref.userId === row.user_id && ref.assetId === row.id)).map(row => ({ ...asset, id: row.id, userId: row.user_id, title }));
    } },
  });
  try {
    await assert.rejects(mod.createAssetShareLink('alice', [B], false), /FORBIDDEN/);
    const first = await mod.createAssetShareLink('alice', [A], false);
    assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
    title = 'Changed tractor';
    assert.equal((await mod.createAssetShareLink('alice', [A], false)).token, first.token);
    assert.equal((await mod.readPublicAssetShare(first.token)).assets[0].title, 'Original tractor');
    assert.equal(await mod.findAssetShareLink('bob', [A], false), null);
    await mod.revokeAssetShareLink('bob', first.token);
    assert.ok(await mod.readPublicAssetShare(first.token));
    await mod.revokeAssetShareLink('alice', first.token);
    assert.equal(await mod.readPublicAssetShare(first.token), null);
    const second = await mod.createAssetShareLink('alice', [A], false);
    assert.notEqual(second.token, first.token);
    assert.equal((await mod.readPublicAssetShare(second.token)).assets[0].title, 'Changed tractor');
    await pg.query('UPDATE asset_register_items SET user_id=$1 WHERE id=$2', ['bob', A]);
    assert.equal(await mod.readPublicAssetShare(second.token), null);
    const third = await mod.createAssetShareLink('bob', [A], true);
    await pg.query('DELETE FROM asset_register_items WHERE id=$1', [A]);
    assert.equal(await mod.readPublicAssetShare(third.token), null);
    assert.equal(await mod.readPublicAssetShare('bad-token'), null);
  } finally { await pg.close(); }
});
test('API rejects missing sessions and bad origins and ignores client ownership', async () => {
  const { NextRequest, NextResponse } = require('next/server');
  let signedIn = false;
  let accessed = false;
  const route = load('app/api/asset-share-links/route.ts', {
    'next/server': { NextRequest, NextResponse },
    '../../../lib/auth-session': { getServerSession: async () => signedIn ? { user: { id: 'alice' } } : null },
    '../../../lib/asset-register-account-access': { getAssetRegisterAccountAccess: async () => ({ accountType: 'owner' }) },
    '../../../lib/asset-share-snapshot': snapshot,
    '../../../lib/trusted-request-origin': { isTrustedRequestOrigin: origin => origin === 'https://www.aim4price.com' },
    '../../../lib/asset-share-links': {
      createAssetShareLink: async (userId, ids) => { accessed = true; assert.equal(userId, 'alice'); assert.deepEqual(ids, [A]); return { token: 'token' }; },
      findAssetShareLink: async userId => { assert.equal(userId, 'alice'); return null; },
      revokeAssetShareLink: async userId => { assert.equal(userId, 'alice'); },
    },
  });
  const req = (method, origin = 'https://www.aim4price.com', body = { assetIds: [A], userId: 'bob' }) => new NextRequest(`https://www.aim4price.com/api/asset-share-links?assetId=${A}`, { method, headers: { origin, 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) });
  for (const method of ['GET', 'POST', 'DELETE']) assert.equal((await route[method](req(method))).status, 401);
  signedIn = true;
  assert.equal((await route.POST(req('POST', 'https://evil.example'))).status, 403);
  assert.equal(accessed, false);
  assert.equal((await route.POST(req('POST'))).status, 200);
  assert.equal((await route.POST(req('POST', undefined, { assetIds: [] }))).status, 400);
  assert.equal((await route.GET(req('GET'))).status, 200);
});
test('link appears in email and WhatsApp copy only when selected', () => {
  const mod = load('lib/asset-external-share.ts');
  const saved = snapshot.assetShareSnapshot(asset, false);
  assert.doesNotMatch(mod.buildExternalAssetShareCopy('Tractor', [saved]).body, /asset-share/);
  const copy = mod.buildExternalAssetShareCopy('Tractor', [saved], { shareUrl: 'https://www.aim4price.com/asset-share/example' });
  assert.match(decodeURIComponent(mod.buildEmailShareUrl(copy)), /View asset details:\nhttps:\/\/www.aim4price.com\/asset-share\/example/);
  assert.match(decodeURIComponent(mod.buildWhatsAppShareUrl(copy)), /asset-share\/example/);
});
