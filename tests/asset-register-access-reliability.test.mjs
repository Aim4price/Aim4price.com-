import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function compile(path) {
  return ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
}
const retry = {};
new Function('exports', 'setTimeout', compile('lib/database-read-retry.ts'))(retry, resolve => resolve());
const routeCode = compile('app/api/asset-register/route.ts');
function harness({ signedIn = true, allowed = true, failure = null, failCount = 0 } = {}) {
  const calls = [];
  let reads = 0;
  const register = { id: 'owned-register', userId: 'owner-a', businessName: 'Owned', createdAtIso: '2026-01-01', updatedAtIso: '2026-01-01' };
  function scoped(userId) { assert.equal(userId, 'owner-a'); }
  const dependencies = {
    ...retry,
    NextResponse: { json: (body, options = {}) => ({ status: options.status ?? 200, body }) },
    getServerSession: async () => signedIn ? { user: { id: 'owner-a' } } : null,
    getAssetRegisterAccountAccess: async () => allowed ? { accountType: 'owner' } : null,
    getAssetRegisterForUser: async (userId, id) => {
      scoped(userId); calls.push(['register', id]);
      if (++reads <= failCount) throw failure;
      return id === register.id ? register : null;
    },
    getSelectedAssetRegister: async userId => { scoped(userId); return register; },
    listAssetRegisters: async userId => { scoped(userId); calls.push(['registers']); return [register]; },
    listAssetRegisterItems: async (userId, id) => { scoped(userId); assert.equal(id, register.id); calls.push(['items', id]); return [{ id: 'owned-asset', registerId: id, value: 100 }]; },
    attachOpenAssetAlerts: async (userId, items) => { scoped(userId); return items; },
    listAssetGroups: async userId => { scoped(userId); return []; },
    projectAssetGroupsToAssets: () => [],
    registerValueForAssets: () => 100,
  };
  const exports = {};
  new Function('exports', 'require', 'console', routeCode)(exports, () => dependencies, { error() {} });
  return { get: path => exports.GET({ url: `https://www.aim4price.com/api/asset-register${path}` }), calls, reads: () => reads };
}

test('unsigned requests cannot read any register', async () => {
  const h = harness({ signedIn: false });
  assert.equal((await h.get('?scope=combined')).status, 401);
  assert.deepEqual(h.calls, []);
});
test('inactive or unauthorised account requests stop before data access', async () => {
  const h = harness({ allowed: false });
  assert.equal((await h.get('?registerId=owned-register')).status, 403);
  assert.deepEqual(h.calls, []);
});
test('foreign and missing register IDs do not fall back or expose assets', async () => {
  for (const id of ['foreign-register', 'deleted-register', "x' OR 1=1 --"]) {
    const h = harness();
    assert.equal((await h.get(`?registerId=${encodeURIComponent(id)}&userId=owner-b`)).status, 404);
    assert.deepEqual(h.calls, [['register', id]]);
  }
});
test('combined scope obtains registers and assets only for the authenticated account', async () => {
  const h = harness();
  const response = await h.get('?scope=combined&userId=owner-b&registerIds=foreign-register');
  assert.equal(response.status, 200);
  assert.equal(response.body.register.userId, 'owner-a');
  assert.deepEqual(response.body.items.map(item => item.id), ['owned-asset']);
  assert.equal(response.body.summary.count, 1);
});
test('owned register and selected-register API callers retain their scope', async () => {
  for (const query of ['?registerId=owned-register', '']) {
    const response = await harness().get(query);
    assert.equal(response.status, 200);
    assert.equal(response.body.register.id, 'owned-register');
  }
});
test('transient aborted reads recover with the original authenticated scope', async () => {
  for (const code of ['40P01', '40001']) {
    const h = harness({ failure: { code }, failCount: 2 });
    assert.equal((await h.get('?registerId=owned-register')).status, 200);
    assert.equal(h.reads(), 3);
  }
});
test('retry exhaustion is bounded and does not expose database diagnostics', async () => {
  const h = harness({ failure: { code: '40P01', message: 'secret SQL', detail: 'transaction 123' }, failCount: 10 });
  const response = await h.get('?registerId=owned-register');
  assert.equal(response.status, 503);
  assert.equal(h.reads(), 3);
  assert.doesNotMatch(JSON.stringify(response.body), /secret|transaction|40P01/);
});
test('nontransient failures are not retried and return a safe error', async () => {
  const h = harness({ failure: new Error('private schema details'), failCount: 10 });
  const response = await h.get('?registerId=owned-register');
  assert.equal(response.status, 500);
  assert.equal(h.reads(), 1);
  assert.doesNotMatch(JSON.stringify(response.body), /private schema/);
});

test('actual ownership SQL rejects another account and counts only active assets', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(`create table asset_registers (
    id text primary key, user_id text, business_name text, email text, phone text,
    address_line_1 text, logo_urls jsonb, show_logos_on_register boolean,
    is_primary boolean, is_selected boolean, created_at timestamptz, updated_at timestamptz
  );
  create table asset_register_items (id text, user_id text, register_id text, lifecycle_state text);
  insert into asset_registers (id, user_id) values ('register-a', 'owner-a'), ('register-b', 'owner-b');
  insert into asset_register_items values
    ('a-active', 'owner-a', 'register-a', 'active'), ('a-deleted', 'owner-a', 'register-a', 'deleted'),
    ('b-active', 'owner-b', 'register-b', 'active');`);
  const source = readFileSync(new URL('../lib/asset-registers.ts', import.meta.url), 'utf8');
  const fn = source.slice(source.indexOf('export async function getAssetRegisterForUser('), source.indexOf('export async function getSelectedAssetRegister('));
  const compiled = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('exports', 'getDb', 'getOrCreatePrimaryAssetRegister', 'buildAssetRegisterTotalsSql', 'mapAssetRegisterRow', compiled)(
    exports, () => db, async () => {}, async () => ({ totalValueSql: '0 as total_value', totalReplacementPriceSql: '0 as total_replacement_price' }), row => row,
  );
  try {
    assert.equal(await exports.getAssetRegisterForUser('owner-a', 'register-b'), null);
    assert.equal(await exports.getAssetRegisterForUser('owner-b', 'register-a'), null);
    assert.equal(await exports.getAssetRegisterForUser('owner-a', "' OR 1=1 --"), null);
    const owned = await exports.getAssetRegisterForUser('owner-a', 'register-a');
    assert.equal(owned.asset_count, 1);
    assert.equal(owned.user_id, 'owner-a');
  } finally { await db.close(); }
});

test('an older overview response cannot replace the latest register data', async () => {
  const source = readFileSync(new URL('../app/asset-register/asset-register-overview.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('  const loadOverview = useCallback(');
  const end = source.indexOf('\n  useEffect(() => {', start);
  const compiled = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const pending = [];
  let assets;
  const request = { current: null };
  const load = new Function('useCallback', 'overviewRequest', 'AbortController', 'setLoading', 'setError', 'setAssets', 'setGroups', 'buildAssetRegisterApiUrl', 'registerIdFromLocation', 'window', 'fetch', `${compiled}; return loadOverview;`)(
    fn => fn, request, AbortController, () => {}, () => {}, value => { assets = value; }, () => {}, () => '/api/asset-register?scope=combined', () => '__combined__', { location: {} },
    () => new Promise(resolve => pending.push(resolve)),
  );
  const first = load();
  const firstController = request.current;
  const second = load();
  assert.equal(firstController.signal.aborted, true);
  pending[1]({ ok: true, json: async () => ({ ok: true, items: ['latest'], groups: [] }) });
  await second;
  pending[0]({ ok: true, json: async () => ({ ok: true, items: ['stale'], groups: [] }) });
  await first;
  assert.deepEqual(assets, ['latest']);
});
