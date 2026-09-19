import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import ts from 'typescript';
const require = createRequire(import.meta.url);
async function load(path, deps = {}) {
  const source = await readFile(new URL('../' + path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((id) => id in deps ? deps[id] : require(id), module, module.exports);
  return module.exports;
}
const policy = await load('lib/app-session-policy.ts');
const secret = 'persistent-session-test-secret';
process.env.BETTER_AUTH_SECRET = secret;
process.env.FIELD_MANAGER_COOKIE_SECRET = secret;
function signed(payload) {
  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return raw + '.' + createHmac('sha256', secret).update(raw).digest('base64url');
}
const decode = token => JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());

for (const kind of ['owner', 'dealer', 'middleman', 'field']) {
  test(`${kind}: persistent sign-in survives time passing but respects revocation and legacy expiry`, async () => {
    let active = true, version = 1, status = 'active', role = 'sales', exists = true;
    const jar = new Map();
    const profile = { getAccountProfile: async () => ({ accountType: ['owner', 'field'].includes(kind) ? 'owner' : 'dealer', accountStatus: status, accountSubtype: kind }) };
    const deps = {
      './app-session-policy': policy,
      './account-profile': profile,
      './app-realm-server': { currentAppRealm: async () => kind },
      'next/headers': { cookies: async () => ({ get: name => jar.has(name) ? { value: jar.get(name) } : undefined }) },
    };
    let token, cookie, get;
    if (kind === 'owner') {
      const api = await load('lib/owner-app-session.ts', { ...deps, './owner-app': { getOwnerAppUserById: async () => exists ? { id: 'user', parent_owner_user_id: 'account', is_active: active, session_version: version, display_name: 'User', username: 'user@account' } : null } });
      token = api.createOwnerAppToken({ ownerAppUserId: 'user', parentOwnerUserId: 'account', version: 1 });
      cookie = api.OWNER_APP_COOKIE; get = api.getOwnerAppSession;
    } else if (kind === 'field') {
      const manager = () => ({ id: 'user', ownerUserId: 'account', username: 'user@account', displayName: 'User', isActive: active, sessionVersion: version });
      const api = await load('lib/field-manager-session.ts', { ...deps, './scan-assets': { normalizePublicAssetCode: x => x }, './field-manager': { getFieldManagerById: async () => exists ? manager() : null } });
      const response = { cookies: { set: value => { cookie = value.name; token = value.value; assert.equal(value.maxAge, policy.APP_SESSION_COOKIE_MAX_AGE); assert.equal(value.httpOnly, true); } } };
      api.applyFieldManagerSessionCookie(response, manager(), 'existing-session');
      assert.equal(decode(token).sessionId, 'existing-session');
      get = () => api.getActiveFieldManagerSessionFromRequest({ cookies: { get: name => jar.has(name) ? { value: jar.get(name) } : undefined } });
    } else {
      const api = await load('lib/dealer-app-session.ts', { ...deps,
        './middleman-account': { isMiddlemanAccountSubtype: x => x === 'middleman' },
        './dealer-app': { getDealerStaffById: async () => exists ? { id: 'user', dealer_user_id: 'account', is_active: active, session_version: version, staff_role: role, display_name: 'User', username: 'user@account' } : null, normalizeDealerStaffRole: x => x },
      });
      token = api.createDealerAppToken({ realm: kind, staffId: 'user', dealerUserId: 'account', displayName: 'User', username: 'user@account', role: 'sales', version: 1 });
      cookie = kind === 'dealer' ? api.DEALER_APP_COOKIE : api.MIDDLEMAN_APP_COOKIE; get = api.getDealerAppSession;
    }
    jar.set(cookie, token);
    assert.ok(await get());
    const now = Date.now;
    try {
      Date.now = () => now() + 800 * 24 * 60 * 60 * 1000;
      assert.ok(await get(), 'new token does not time out');
      active = false; assert.equal(await get(), null); active = true;
      version = 2; assert.equal(await get(), null); version = 1;
      status = 'suspended'; assert.equal(await get(), null); status = 'active';
      exists = false; assert.equal(await get(), null); exists = true;
      if (kind === 'dealer' || kind === 'middleman') { role = 'parts'; assert.equal(await get(), null); role = 'sales'; }
      jar.delete(cookie); assert.equal(await get(), null, 'logout removes access');
      const legacy = decode(token); delete legacy.persistent;
      jar.set(cookie, signed(legacy)); assert.equal(await get(), null, 'expired legacy session is not revived');
      jar.set(cookie, token.slice(0, -1) + '!'); assert.equal(await get(), null, 'invalid signature rejected');
    } finally { Date.now = now; }
    const legacy = decode(token); delete legacy.persistent;
    jar.set(cookie, signed(legacy)); assert.ok(await get(), 'unexpired legacy session can still renew');
  });
}

test('session renewal endpoints refuse foreign origins and revoked sessions', async () => {
  for (const app of ['owner-app', 'field-manager', 'dealer']) {
    let trusted = false;
    const cookies = [];
    const route = await load(`app/api/${app}/session/route.ts`, {
      'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200, cookies: { set: (...args) => cookies.push(args) } }) } },
      '../../../../lib/notification-request-origin': { isTrustedNotificationRequest: () => trusted },
      '../../../../lib/owner-app-access': {},
      '../../../../lib/owner-app-session': { getOwnerAppSession: async () => null },
      '../../../../lib/field-manager-session': { requireActiveFieldManagerSession: async () => ({ ok: false, status: 401, error: 'Sign in' }) },
      '../../../../lib/dealer-app-session': { getDealerAppSession: async () => null },
      '../../../../lib/app-realm-server': { currentAppRealm: async () => 'dealer' },
      '../../../../lib/middleman-account': {}, '../../../../lib/account-profile': {}, '../../../../lib/auth-session': {},
    });
    assert.equal((await route.POST({})).status, 403);
    trusted = true;
    assert.equal((await route.POST({})).status, 401);
    assert.deepEqual(cookies, []);
  }
});

test('cookie keeper renews on mount and return, without signing out on network failure', async () => {
  let cleanup, timer;
  const handlers = new Map(), calls = [];
  const previous = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch };
  const listeners = { addEventListener: (event, handler) => handlers.set(event, handler), removeEventListener: event => handlers.delete(event) };
  globalThis.window = { ...listeners, setInterval: fn => { timer = fn; return 1; }, clearInterval: () => {} };
  globalThis.document = { ...listeners, visibilityState: 'visible' };
  globalThis.fetch = async (...args) => { calls.push(args); throw new Error('offline'); };
  const now = Date.now;
  let time = now();
  Date.now = () => time;
  try {
    const { default: Keeper } = await load('app/app-session-keeper.tsx', { react: { useEffect: fn => { cleanup = fn(); } } });
    Keeper({ appRoot: '/owner-app' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls[0][0], '/api/owner-app/session');
    assert.equal(calls[0][1].method, 'POST');
    time += 6 * 60 * 60 * 1000;
    handlers.get('visibilitychange')();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 2);
    time += 6 * 60 * 60 * 1000;
    globalThis.document.visibilityState = 'hidden'; timer();
    assert.equal(calls.length, 2);
    cleanup(); assert.equal(handlers.size, 0);
  } finally { Date.now = now; Object.assign(globalThis, previous); }
});
