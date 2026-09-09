import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
async function load(path, deps = {}) {
  const output = ts.transpileModule(await read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(id => id in deps ? deps[id] : require(id), module, module.exports);
  return module.exports;
}

test('every browser API request carries its current app context even without a referrer', async () => {
  const { APP_REQUEST_CONTEXT_SCRIPT } = await load('lib/app-request-context.ts');
  const requests = [];
  const window = { location: new URL('https://www.aim4price.com/middleman/marketplace'), fetch: async (...args) => { requests.push(args); return { ok: true }; } };
  vm.runInNewContext(APP_REQUEST_CONTEXT_SCRIPT, { window, URL, Request, Headers });
  for (const [path, realm] of [['/middleman/marketplace', 'middleman'], ['/dealer/marketplace', 'dealer'], ['/owner-app/assets', 'owner'], ['/field-manager/assets', 'field'], ['/marketplace', 'website']]) {
    window.location = new URL('https://www.aim4price.com' + path);
    await window.fetch('/api/marketplace', { referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' } });
    const [, options] = requests.at(-1);
    assert.equal(options.headers.get('x-aim4price-client-realm'), realm);
    assert.equal(options.headers.get('Accept'), 'application/json');
    assert.equal(options.cache, 'no-store');
  }
  await window.fetch(new Request('https://www.aim4price.com/api/marketplace', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }));
  assert.equal(requests.at(-1)[1].headers.get('Content-Type'), 'application/json');
  const externalOptions = { headers: { Test: 'preserved' } };
  await window.fetch('https://external.example/api/data', externalOptions);
  assert.equal(requests.at(-1)[1], externalOptions);
  assert.match(await read('app/layout.tsx'), /<script dangerouslySetInnerHTML=\{\{ __html: APP_REQUEST_CONTEXT_SCRIPT \}\} \/>/);
});

test('middleware strips sibling, website and support cookies and replaces forged internal context', async () => {
  const realmModule = await load('lib/app-realm.ts');
  const cookieModule = await load('lib/app-cookie-isolation.ts');
  const { middleware } = await load('middleware.ts', {
    'next/server': { NextResponse: { next: options => ({ request: options.request, headers: new Headers() }) } },
    './lib/app-realm': realmModule,
    './lib/app-cookie-isolation': cookieModule,
  });
  const cookies = 'better-auth.session_token=website; __Secure-better-auth.session_token=website; aim4price_admin_support_user_id=admin; aim4price_dealer_app_v2=dealer; aim4price_middleman_app_v1=middleman; aim4price_owner_app=owner; aim4price_field_manager=field';
  for (const [realm, ownCookie] of Object.entries({dealer:'aim4price_dealer_app_v2=dealer', middleman:'aim4price_middleman_app_v1=middleman', owner:'aim4price_owner_app=owner', field:'aim4price_field_manager=field'})) {
    const result = middleware({ nextUrl: new URL('https://internal.example/api/marketplace'), headers: new Headers({ cookie: cookies, 'x-aim4price-client-realm': realm, 'x-aim4price-app-realm': 'dealer' }) });
    assert.equal(result.request.headers.get('x-aim4price-app-realm'), realm);
    assert.equal(result.request.headers.get('cookie'), ownCookie);
    assert.match(result.headers.get('Cache-Control'), /private, no-store/);
  }
  assert.equal(realmModule.requestAppRealm(new URL('https://example.com/api/dealer/login'), null, 'middleman'), 'dealer');
  assert.equal(realmModule.requestAppRealm(new URL('https://example.com/api/owner-app/users'), null, 'website'), null);
  const result = middleware({ nextUrl: new URL('https://example.com/api/marketplace'), headers: new Headers({ 'x-aim4price-app-realm': 'middleman' }) });
  assert.equal(result.request.headers.get('x-aim4price-app-realm'), null);
  const ambiguous = middleware({ nextUrl: new URL('https://example.com/api/marketplace'), headers: new Headers({ cookie: cookies }) });
  assert.equal(ambiguous.request.headers.get('cookie'), '');
  const website = middleware({ nextUrl: new URL('https://example.com/api/marketplace'), headers: new Headers({ cookie: cookies, 'x-aim4price-client-realm': 'website' }) });
  assert.equal(website.request.headers.get('cookie'), cookies);
});

test('shared authentication and Marketplace use only the selected app account', async () => {
  let realm = null;
  let active = true;
  let version = 1;
  let staffRole = 'sales';
  const jar = new Map();
  const { isMiddlemanAccountSubtype } = await load('lib/middleman-account.ts');
  const getProfile = async ({ id }) => ({ accountType: id === 'owner' ? 'owner' : 'dealer', accountStatus: 'active', accountSubtype: id === 'middleman' ? 'equipment-middleman' : 'equipment-dealer' });
  const nextHeaders = { cookies: async () => ({ get: name => jar.has(name) ? { value: jar.get(name) } : undefined }), headers: async () => new Headers() };
  const context = { currentAppRealm: async () => realm };
  const dealer = await load('lib/dealer-app-session.ts', {
    'next/headers': nextHeaders, './app-realm-server': context, './middleman-account': { isMiddlemanAccountSubtype }, './account-profile': { getAccountProfile: getProfile },
    './dealer-app': { normalizeDealerStaffRole: value => value, getDealerStaffById: async id => ({ is_active: active, dealer_user_id: id, session_version: version, staff_role: staffRole, display_name: id, username: id }) },
  });
  const owner = await load('lib/owner-app-session.ts', {
    'next/headers': nextHeaders, './app-realm-server': context, './account-profile': { getAccountProfile: getProfile },
    './owner-app': { getOwnerAppUserById: async () => ({ id: 'owner', parent_owner_user_id: 'owner', is_active: active, session_version: version, display_name: 'Owner', username: 'owner' }) },
  });
  for (const kind of ['dealer', 'middleman']) jar.set(kind === 'dealer' ? dealer.DEALER_APP_COOKIE : dealer.MIDDLEMAN_APP_COOKIE, dealer.createDealerAppToken({ realm: kind, staffId: kind, dealerUserId: kind, displayName: kind, username: kind, role: 'sales', version: 1 }));
  jar.set(owner.OWNER_APP_COOKIE, owner.createOwnerAppToken({ ownerAppUserId: 'owner', parentOwnerUserId: 'owner', version: 1 }));
  let website = { user: { id: 'website', email: 'website@example.com' } };
  const auth = await load('lib/auth-session.ts', {
    './app-realm-server': context, 'next/headers': nextHeaders,
    './account-constants': { isAim4priceAdminEmail: () => false },
    './account-profile': { isAccountActive: async () => true, markAccountLastActive: async () => false },
    './admin-usage-events': { recordAdminUsageEventSafely: async () => {} },
    './auth': { auth: { api: { getSession: async () => website } } }, './db': { getDb: () => { throw Error('Unexpected database call'); } },
    './dealer-app-session': dealer, './owner-app-session': owner,
  });
  let viewer;
  let publisher;
  const route = await load('app/api/marketplace/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '../../../lib/auth-session': auth, '../../../lib/account-profile': { getAccountProfile: getProfile },
    '../../../lib/dealer-app-access': await load('lib/dealer-app-access.ts'),
    '../../../lib/marketplace-db': { listPublishedMarketplaceAssetListings: async options => { viewer = options.viewerUserId; return []; }, publishAssetRegisterItemToMarketplace: async input => { publisher = input.userId; return {}; } },
    '../../../lib/asset-register-uploads': { MAX_ASSET_REGISTER_PHOTOS: 10 }, '../../../lib/middleman-account': { isMiddlemanAccountSubtype },
  });
  for (realm of ['dealer', 'middleman', 'owner']) {
    assert.equal((await auth.getServerSession({ allowDealerApp: true, allowOwnerApp: true })).user.id, realm);
    assert.equal(await auth.getAnyServerSession(), null);
    assert.equal((await route.GET()).status, 200);
    assert.equal(viewer, realm);
    assert.equal((await route.POST({ json: async () => ({ assetId: 'asset', userId: 'forged-user' }) })).status, 200);
    assert.equal(publisher, realm);
  }
  realm = 'field';
  assert.equal(await auth.getServerSession({ allowDealerApp: true, allowOwnerApp: true }), null);
  realm = null;
  assert.equal((await auth.getServerSession({ allowDealerApp: true, allowOwnerApp: true })).user.id, 'website');
  website = null;
  assert.equal(await auth.getServerSession({ allowDealerApp: true, allowOwnerApp: true }), null);
  website = { user: { id: 'website' } };
  realm = 'middleman';
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 31 * 24 * 60 * 60 * 1000;
    assert.equal(await auth.getServerSession({ allowDealerApp: true }), null);
  } finally { Date.now = realNow; }
  version = 2;
  assert.equal(await auth.getServerSession({ allowDealerApp: true }), null);
  version = 1;
  active = false;
  assert.equal(await auth.getServerSession({ allowDealerApp: true }), null);
  active = true;
  staffRole = 'parts';
  jar.set(dealer.MIDDLEMAN_APP_COOKIE, dealer.createDealerAppToken({ realm: 'middleman', staffId: 'middleman', dealerUserId: 'middleman', displayName: 'Parts', username: 'parts', role: 'parts', version: 1 }));
  assert.equal((await route.POST({ json: async () => ({ assetId: 'asset' }) })).status, 403);
  jar.delete(dealer.MIDDLEMAN_APP_COOKIE);
  assert.equal(await auth.getServerSession({ allowDealerApp: true, allowOwnerApp: true }), null);
  await route.GET();
  assert.equal(viewer, null);
  assert.equal((await route.POST({ json: async () => ({ assetId: 'asset' }) })).status, 401);
});

test('production cannot issue Owner or Field Manager tokens with development secrets', async () => {
  const owner = await load('lib/owner-app-session.ts', { 'next/headers': {}, './app-realm-server': {}, './account-profile': {}, './owner-app': {} });
  const field = await load('lib/field-manager-session.ts', { './field-manager': {}, './scan-assets': {} });
  const keys = ['NODE_ENV', 'BETTER_AUTH_SECRET', 'OWNER_APP_SECRET', 'FIELD_MANAGER_COOKIE_SECRET', 'SCAN_COOKIE_SECRET'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    process.env.NODE_ENV = 'production';
    assert.throws(() => owner.createOwnerAppToken({ ownerAppUserId: 'owner', parentOwnerUserId: 'owner', version: 1 }), /secret is not configured/);
    assert.throws(() => field.applyFieldManagerSessionCookie({ cookies: { set() {} } }, { id: 'field', ownerUserId: 'owner', username: 'field', displayName: 'Field', sessionVersion: 1 }), /secret is not configured/);
  } finally {
    for (const key of keys) saved[key] === undefined ? delete process.env[key] : process.env[key] = saved[key];
  }
});
