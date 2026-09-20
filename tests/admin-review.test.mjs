import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(path, dependencies) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  Function('require', 'module', 'exports', code)(name => {
    if (!(name in dependencies)) throw new Error(`Missing test dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
const nextServer = { NextResponse: { json: (body, init) => Response.json(body, init), next: () => new Response(null) } };
const origins = load('lib/trusted-request-origin.ts', {});
const middleware = load('middleware.ts', {
  'next/server': nextServer,
  './lib/trusted-request-origin': origins,
  './lib/app-realm': { requestAppRealm: () => null, appRealmForPath: () => null },
  './lib/app-cookie-isolation': { isolateAppCookies: cookie => cookie, hasAppCookies: () => false },
}).middleware;

test('admin mutations reject missing/untrusted origins and accept configured public origins behind a proxy', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    for (const path of ['users', 'valuations', 'marketplace', 'sold-assets', 'work-tracker', 'maintenance-catalogue', 'capture-requests/example', 'lifecycle-calculator/export']) {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        for (const origin of [null, 'null', 'https://evil.test', 'https://aim4price.com.evil.test']) {
          const response = middleware({ method, nextUrl: new URL(`http://internal:3000/api/admin/${path}`), headers: new Headers(origin ? { origin } : {}) });
          assert.equal(response.status, 403, `${method} ${path} origin=${origin}`);
        }
        for (const origin of ['https://aim4price.com', 'https://www.aim4price.com']) {
          const response = middleware({ method, nextUrl: new URL(`http://internal:3000/api/admin/${path}`), headers: new Headers({ origin }) });
          assert.equal(response.status, 200);
          assert.match(response.headers.get('cache-control'), /private, no-store/);
        }
      }
    }
    assert.equal(middleware({ method: 'GET', nextUrl: new URL('http://internal:3000/api/admin/users'), headers: new Headers() }).status, 200);
    assert.equal(middleware({ method: 'POST', nextUrl: new URL('http://internal:3000/api/unrelated'), headers: new Headers() }).status, 200);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
  }
});

const session = { user: { id: 'admin', email: 'admin@example.test' } };
let writes = 0;
const shared = {
  'next/server': nextServer,
  '../../../../lib/auth-session': { getAnyServerSession: async () => session },
  '../../../../lib/account-constants': { isAim4priceAdminEmail: () => true },
  '../../../../lib/admin-api-access': { requireAdminApiAccess: async () => ({ ok: true, actor: { userId: 'admin', displayName: 'Admin' } }) },
};
const users = load('app/api/admin/users/route.ts', { ...shared,
  '../../../../lib/admin-users': { setAdminUserAccountStatus: async () => { writes++; }, listAdminUsers: async () => [] },
  '../../../../lib/admin-account-notifications': {}, '../../../../lib/auth': {}, '../../../../lib/email': {},
});
const tracker = load('app/api/admin/work-tracker/route.ts', { ...shared,
  '../../../../lib/admin-work-tracker': {}, '../../../../lib/admin-work-tracker-shared': {},
});
const marketplace = load('app/api/admin/marketplace/route.ts', { ...shared, '../../../../lib/admin-marketplace': {} });
const outcomes = load('app/api/admin/sold-assets/route.ts', { ...shared, '../../../../lib/asset-transfers': {} });

test('admin action endpoints reject null, array and scalar JSON without reaching mutations', async () => {
  for (const handler of [users.POST, tracker.POST, tracker.PATCH, tracker.DELETE, marketplace.DELETE, outcomes.POST]) {
    for (const body of [null, [], 'invalid', 4, false]) {
      const result = await handler({ json: async () => body });
      assert.equal(result.status, 400);
      assert.equal((await result.json()).error, 'Invalid request body.');
    }
  }
});

test('invalid account status cannot silently move an account to pending payment', async () => {
  writes = 0;
  for (const status of ['nonsense', '', 'ACTIVE', null]) {
    const result = await users.POST({ json: async () => ({ userId: 'owner', status }) });
    assert.equal(result.status, 400);
  }
  assert.equal(writes, 0);
  assert.equal((await users.POST({ json: async () => ({ userId: 'owner', action: 'activate' }) })).status, 200);
  assert.equal(writes, 1);
});

test('dashboard day/month/year boundaries use South African time even when PostgreSQL runs in UTC', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec("set timezone = 'UTC'");
    const source = readFileSync(new URL('../lib/admin-dashboard.ts', import.meta.url), 'utf8');
    const boundaries = [...new Set(source.match(/\(date_trunc\('(day|month|year)', now\(\) at time zone 'Africa\/Johannesburg'\) at time zone 'Africa\/Johannesburg'\)/g))];
    assert.equal(boundaries.length, 3);
    assert.doesNotMatch(source, /date_trunc\('(day|month|year)', now\(\)\)/);
    for (const boundary of boundaries) {
      // 00:30 on New Year's Day in South Africa, still 31 December in UTC.
      const sql = boundary.replace('now()', "timestamptz '2026-12-31T22:30:00Z'");
      const { rows } = await db.query(`select ${sql} as start`);
      assert.equal(rows[0].start.toISOString(), '2026-12-31T22:00:00.000Z');
    }
  } finally { await db.close(); }
});
