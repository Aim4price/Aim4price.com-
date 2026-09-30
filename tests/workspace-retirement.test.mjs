import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function load(path, deps = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  Function('require', 'module', 'exports', code)(id => id in deps ? deps[id] : require(id), module, module.exports);
  return module.exports;
}
const retirement = load('lib/retired-workspaces.ts');
test('signup supports the four core account choices and excludes assistance identities', () => {
  for (const type of ['owner', 'dealer', 'business', 'middleman']) assert.equal(retirement.isSupportedSignupAccountType(type), true);
  for (const type of ['insurance', 'finance', 'accounting', 'accountant', 'licensing', 'broker']) assert.equal(retirement.isSupportedSignupAccountType(type), false);
  for (const email of ['insurance', 'finance', 'Accounting', 'licensing', 'dealers']) assert.equal(retirement.isRetiredAssistanceAccount({ email: email + '@aim4price.com' }), false);
  assert.equal(retirement.isRetiredAssistanceAccount({ id: 'aim4price-assistance-insurance' }), true);
  assert.equal(retirement.isRetiredAssistanceAccount({ id: 'real-business', email: 'insurance@example.com' }), false);
});
test('legacy roles map to normal Business service categories only', () => {
  for (const [role, subtype, expected] of [['insurance','broker','insurance-services'],['finance','bank','finance-services'],['finance','accountant','accounting-services'],['accountant','','accounting-services'],['accounting','','accounting-services'],['licensing','','licensing-services']]) assert.equal(retirement.retiredBusinessSubtype(role, subtype), expected);
  for (const role of ['owner','dealer','middleman','business']) assert.equal(retirement.retiredBusinessSubtype(role, 'middleman'), null);
});
test('retired share URLs never fall through to an unrelated owner register', async () => {
  let allowed = true;
  const api = load('lib/owner-workspace-access.ts', {
    './auth-session': { getServerSession: async () => ({ user: { id: 'owner-1', name: 'Owner', email: 'owner@example.com' } }) },
    './asset-register-account-access': { getAssetRegisterAccountAccess: async () => allowed ? {} : null },
  });
  for (const query of ['accountantShareId=old-share', 'accountantRegisterId=old-register', 'accountantShareId=']) {
    const result = await api.resolveOwnerWorkspaceContext(new Request('https://example.com/api/fuel?' + query));
    assert.equal(result.ok, false); assert.equal(result.response.status, 410);
  }
  const ordinary = await api.resolveOwnerWorkspaceContext(new Request('https://example.com/api/fuel'));
  assert.equal(ordinary.context.ownerUserId, 'owner-1'); assert.equal(ordinary.context.actorUserId, 'owner-1');
  allowed = false;
  assert.equal((await api.resolveOwnerWorkspaceContext(new Request('https://example.com/api/fuel'))).response.status, 403);
});
test('specialist pages and mutation APIs are removed while core pages remain', () => {
  for (const path of ['app/accountant','app/shared-registers','app/api/accountant','app/api/licensing','app/api/insurance-workspaces','app/api/insurance-shares','app/api/insurance-reports','app/admin/assistance-network','lib/assistance-network.ts']) assert.equal(existsSync(new URL('../'+path, import.meta.url)), false, path);
  for (const path of ['app/asset-register','app/dealer','app/business','lib/middleman-account.ts']) assert.equal(existsSync(new URL('../'+path, import.meta.url)), true, path);
});
test('migration is repeatable, preserves records and disables only retired billing and assistance sessions', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text); CREATE TABLE "session"(id text PRIMARY KEY,"userId" text);
      CREATE TABLE account_profiles(user_id text PRIMARY KEY,account_type text NOT NULL,account_subtype text,account_status text,partner_directory_enabled boolean,discovery_participation_enabled boolean,updated_at timestamptz DEFAULT now());
      CREATE TABLE aim4price_assistance_accounts(id text,enabled boolean,updated_at timestamptz); CREATE TABLE aim4price_assistance_locations(id text,enabled boolean,updated_at timestamptz);
      CREATE TABLE aim4price_billing_plans(account_type text,enabled boolean,version int,updated_at timestamptz);
      CREATE TABLE aim4price_billing_agreements(user_id text,enabled boolean,version int,updated_at timestamptz);
      CREATE TABLE retained_history(kind text,payload jsonb);
      INSERT INTO retained_history VALUES ('asset','{"id":"asset"}'),('invoice','{"paid":100}'),('share','{"owner":"owner"}');
      INSERT INTO aim4price_assistance_accounts VALUES('insurance',true,now()); INSERT INTO aim4price_assistance_locations VALUES('area',true,now());
      INSERT INTO aim4price_billing_plans SELECT role,true,1,now() FROM unnest(ARRAY['owner','dealer','finance','insurance','licensing']) role;`);
    await pg.exec(read('database/migrations/119-business-account-services.sql'));
    const records = [['owner','owner','farmer'],['dealer','dealer','machinery-dealer'],['middleman','dealer','equipment-middleman'],['business','business','maintenance-services'],['insurer','insurance','short-term-insurer'],['bank','finance','bank'],['accountant','finance','accountant'],['licenser','licensing','licence-renewal-expert'],['aim4price-assistance-insurance','insurance','short-term-insurer'],['email-only-internal','dealer','machinery-dealer']];
    for (const [id, role, subtype] of records) {
      await pg.query('INSERT INTO "user" VALUES($1,$2)',[id,id==='email-only-internal'?'Accounting@aim4price.com':id+'@example.com']);
      await pg.query('INSERT INTO "session" VALUES($1,$1)',[id]);
      await pg.query("INSERT INTO account_profiles VALUES($1,$2,$3,'active',true,true,now())",[id,role,subtype]);
      await pg.query('INSERT INTO aim4price_billing_agreements VALUES($1,true,1,now())',[id]);
    }
    const before = (await pg.query('SELECT * FROM retained_history')).rows;
    const migration = read('database/migrations/120-retire-specialist-workspaces.sql');
    await pg.exec(migration); await pg.exec(migration);
    const profiles = Object.fromEntries((await pg.query('SELECT * FROM account_profiles')).rows.map(r=>[r.user_id,r]));
    for (const [id,role,subtype] of records.slice(0,4)) { assert.equal(profiles[id].account_type,role); assert.equal(profiles[id].account_subtype,subtype); assert.equal(profiles[id].account_status,'active'); }
    for (const [id,expected] of [['insurer','insurance-services'],['bank','finance-services'],['accountant','accounting-services'],['licenser','licensing-services']]) { assert.equal(profiles[id].account_type,'business'); assert.equal(profiles[id].account_subtype,expected); assert.equal(profiles[id].account_status,'active'); }
    for (const id of ['aim4price-assistance-insurance']) { assert.equal(profiles[id].account_status,'suspended'); assert.equal(profiles[id].partner_directory_enabled,false); assert.equal(profiles[id].discovery_participation_enabled,false); assert.equal((await pg.query('SELECT * FROM "session" WHERE "userId"=$1',[id])).rows.length,0); }
    assert.equal((await pg.query('SELECT * FROM "session"')).rows.length,9);
    assert.equal(profiles['email-only-internal'].account_status,'active');
    const agreements = Object.fromEntries((await pg.query('SELECT * FROM aim4price_billing_agreements')).rows.map(r=>[r.user_id,r]));
    for (const [id] of records.slice(0,4)) assert.equal(agreements[id].enabled,true);
    for (const [id] of records.slice(4,-1)) { assert.equal(agreements[id].enabled,false); assert.equal(agreements[id].version,2); }
    assert.equal(agreements['email-only-internal'].enabled,true);
    await pg.exec("INSERT INTO retired_specialist_accounts(user_id,previous_account_type) VALUES ('email-only-internal','dealer')");
    await pg.exec(read('database/migrations/121-release-retired-email-addresses.sql'));
    await pg.exec(read('database/migrations/121-release-retired-email-addresses.sql'));
    assert.equal((await pg.query("SELECT * FROM retired_specialist_accounts WHERE user_id='email-only-internal'")).rows.length,0);
    assert.equal((await pg.query('SELECT * FROM retired_specialist_accounts')).rows.length,5);

    assert.deepEqual((await pg.query('SELECT * FROM retained_history')).rows,before);
    assert.equal((await pg.query('SELECT * FROM retired_specialist_accounts')).rows.length,5);
    assert.equal((await pg.query('SELECT * FROM aim4price_assistance_accounts WHERE enabled')).rows.length,0);
    assert.equal((await pg.query('SELECT * FROM aim4price_assistance_locations WHERE enabled')).rows.length,0);
    assert.deepEqual((await pg.query('SELECT account_type FROM aim4price_billing_plans WHERE enabled ORDER BY account_type')).rows.map(r=>r.account_type),['dealer','owner']);
  } finally { await pg.close(); }
});

test('retired roles are rejected but former assistance emails can sign in and register core accounts', async () => {
  let authCalls = 0, billingCalls = 0;
  const route = load('app/api/auth/[...all]/route.ts', {
    '../../../../lib/retired-workspaces': retirement,
    '../../../../lib/billing': { BillingError: class extends Error {}, validateSignupBilling: async () => { billingCalls++; } },
    '../../../../lib/auth': { auth: {} },
    'better-auth/next-js': { toNextJsHandler: () => ({ POST: async () => { authCalls++; return Response.json({ok:true}); } }) },
    '../../../../lib/signup-workspace-context': { withSignupWorkspaceInput: async (_, fn) => fn() },
  });
  for (const role of ['insurance','finance','accounting','licensing']) {
    const res = await route.POST(new Request('https://example.com/api/auth/sign-up/email', {method:'POST',body:JSON.stringify({email:'normal@example.com',accountType:role})}));
    assert.equal(res.status,400);
  }
  const res = await route.POST(new Request('https://example.com/api/auth/sign-in/email', {method:'POST',body:JSON.stringify({email:'Accounting@aim4price.com'})}));
  assert.equal(res.status,200); assert.equal(authCalls,1); assert.equal(billingCalls,0);
  for (const email of ['insurance', 'finance', 'Accounting', 'licensing', 'dealers']) {
    for (const accountType of ['owner', 'dealer', 'business', 'middleman']) {
      const response = await route.POST(new Request('https://example.com/api/auth/sign-up/email', {method:'POST',body:JSON.stringify({email:email+'@aim4price.com',accountType,businessName:'Example',acceptedTerms:true})}));
      assert.equal(response.status,200, `${email}: ${accountType}`);
    }
  }
  assert.equal(authCalls,21); assert.equal(billingCalls,15);
});
