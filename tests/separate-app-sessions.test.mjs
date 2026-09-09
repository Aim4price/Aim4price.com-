import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
async function load(path, deps = {}) {
  const text = await readFile(new URL('../' + path, import.meta.url), 'utf8');
  const code = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((id) => id in deps ? deps[id] : require(id), module, module.exports);
  return module.exports;
}

test('request routing selects isolated app contexts without trusting foreign referrers', async () => {
  const { requestAppRealm } = await load('lib/app-realm.ts');
  const origin = 'https://example.com';
  assert.equal(requestAppRealm(new URL(origin + '/dealer'), origin + '/middleman'), 'dealer');
  assert.equal(requestAppRealm(new URL(origin + '/middleman'), null), 'middleman');
  assert.equal(requestAppRealm(new URL(origin + '/api/dealer/login'), origin + '/middleman'), 'dealer');
  assert.equal(requestAppRealm(new URL(origin + '/api/ad-studio'), origin + '/middleman/ad-studio'), 'middleman');
  assert.equal(requestAppRealm(new URL(origin + '/api/ad-studio'), 'https://other.com/middleman'), null);
  assert.equal(requestAppRealm(new URL(origin + '/api/dealer/staff'), origin + '/account/dealer-app'), null);
});

test('Dealer and Middleman cookies and signed tokens cannot substitute for each other', async () => {
  let realm = 'dealer';
  const jar = new Map();
  const { isMiddlemanAccountSubtype } = await load('lib/middleman-account.ts');
  const sessions = await load('lib/dealer-app-session.ts', {
    'next/headers': { cookies: async () => ({ get: (name) => jar.has(name) ? { value: jar.get(name) } : undefined }) },
    './app-realm-server': { currentAppRealm: async () => realm },
    './middleman-account': { isMiddlemanAccountSubtype },
    './dealer-app': {
      getDealerStaffById: async (id) => ({ id, is_active: true, dealer_user_id: id, session_version: 1, staff_role: 'sales', display_name: id, username: id }),
      normalizeDealerStaffRole: (role) => role,
    },
    './account-profile': { getAccountProfile: async ({ id }) => ({ accountType: 'dealer', accountStatus: 'active', accountSubtype: id === 'middleman' ? 'equipment-middleman' : 'equipment-dealer' }) },
  });
  const token = (kind) => sessions.createDealerAppToken({ realm: kind, staffId: kind, dealerUserId: kind, displayName: kind, username: kind, version: 1, role: 'sales' });
  const dealer = token('dealer'), middleman = token('middleman');
  jar.set(sessions.DEALER_APP_COOKIE, dealer);
  jar.set(sessions.MIDDLEMAN_APP_COOKIE, middleman);
  assert.equal((await sessions.getDealerAppSession()).dealerUserId, 'dealer');
  realm = 'middleman';
  assert.equal((await sessions.getDealerAppSession()).dealerUserId, 'middleman');
  jar.delete(sessions.MIDDLEMAN_APP_COOKIE);
  assert.equal(await sessions.getDealerAppSession(), null);
  jar.set(sessions.MIDDLEMAN_APP_COOKIE, dealer);
  assert.equal(await sessions.getDealerAppSession(), null);
  realm = 'dealer';
  jar.set(sessions.DEALER_APP_COOKIE, middleman);
  assert.equal(await sessions.getDealerAppSession(), null);
});

test('logout clears only the selected app cookies', async () => {
  for (const realm of ['dealer', 'middleman']) {
    const cleared = [];
    const { POST } = await load('app/api/dealer/logout/route.ts', {
      'next/server': { NextResponse: { json: () => ({ cookies: { set: (...args) => cleared.push(args[0]) } }) } },
      '../../../../lib/app-realm-server': { currentAppRealm: async () => realm },
      '../../../../lib/middleman-account': {},
      '../../../../lib/dealer-app-session': { DEALER_APP_COOKIE: 'dealer', DEALER_APP_LEGACY_COOKIE: 'old-dealer', MIDDLEMAN_APP_COOKIE: 'middleman', dealerAppCookieOptions: () => ({}), dealerAppLegacyCookieOptions: () => ({}) },
    });
    await POST({ url: 'https://example.com/api/' + realm + '/logout' });
    assert.deepEqual(cleared, realm === 'dealer' ? ['dealer', 'old-dealer'] : ['middleman']);
  }
});

test('login rejects the other account subtype and writes only its own cookie', async () => {
  const { isMiddlemanAccountSubtype } = await load('lib/middleman-account.ts');
  for (const realm of ['dealer', 'middleman']) {
    for (const account of ['dealer', 'middleman']) {
      const written = [];
      const { POST } = await load('app/api/dealer/login/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200, cookies: { set: (...args) => written.push(args[0]) } }) } },
        '../../../../lib/app-realm-server': { currentAppRealm: async () => realm },
        '../../../../lib/middleman-account': { isMiddlemanAccountSubtype },
        '../../../../lib/auth-session': { getAnyServerSession: async () => null },
        '../../../../lib/account-profile': { getAccountProfile: async () => ({ accountType: 'dealer', accountStatus: 'active', accountSubtype: account === 'middleman' ? 'equipment-middleman' : 'equipment-dealer' }) },
        '../../../../lib/dealer-app': { findDealerStaffForLogin: async () => ({ id: '1', dealer_user_id: '1', is_active: true, password_hash: 'hash', session_version: 1, staff_role: 'sales' }), verifyDealerPassword: async () => true, normalizeDealerStaffRole: (role) => role, markDealerStaffLogin: async () => {} },
        '../../../../lib/dealer-app-session': { getDealerAppSession: async () => null, createDealerAppToken: () => 'signed', DEALER_APP_COOKIE: 'dealer', DEALER_APP_LEGACY_COOKIE: 'old-dealer', MIDDLEMAN_APP_COOKIE: 'middleman', dealerAppCookieOptions: () => ({}), dealerAppLegacyCookieOptions: () => ({}) },
      });
      const response = await POST({ url: 'https://example.com/api/' + realm + '/login', headers: new Headers(), json: async () => ({ username: 'sales@example', password: 'password' }) });
      assert.equal(response.status, realm === account ? 200 : 401);
      if (realm !== account) assert.deepEqual(written, []);
      else {
        assert.equal(response.body.redirectTo, '/' + realm);
        assert.equal(written[0], realm);
        assert(!written.includes(realm === 'dealer' ? 'middleman' : 'dealer'));
      }
    }
  }
});
