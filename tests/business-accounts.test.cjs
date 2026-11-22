const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
function load(path, mocks) { const exports = {}; new Function('require', 'exports', ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : require(n), exports); return exports; }
async function setup() { const pg = new PGlite(); await pg.exec(`CREATE TABLE account_profiles(user_id text PRIMARY KEY,account_type text,account_status text,business_name text,phone text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());CREATE TABLE "user"(id text PRIMARY KEY,email text,"emailVerified" boolean);INSERT INTO account_profiles VALUES('business','business','active','Workshop','123',now(),now()),('owner','owner','active','Owner','',now(),now());INSERT INTO "user" VALUES('business','workshop@example.com',false),('owner','owner@example.com',true);`); const query = (sql, p) => p ? pg.query(sql, p) : pg.exec(sql).then(r => r.at(-1)); const db = { query, connect: async () => ({ query, release() { } }) }; const profile = { sanitizeLogoUrl: value => value || '', getAccountProfile: async (u) => { const r = (await pg.query('SELECT * FROM account_profiles WHERE user_id=$1', [u.id])).rows[0]; return { accountType: r.account_type, accountStatus: r.account_status, businessName: r.business_name, phone: r.phone }; } }; const mod = load('lib/business-accounts.ts', { './business-service-options':load('lib/business-service-options.ts',{}), './asset-share-links': {liveShareOwnershipSql:()=> 'true'}, './db': { getDb: () => db }, './account-profile': profile, './business-workspaces': {businessWorkspaceSummary:async()=>({suspended:false})} }); return { pg, mod }; }
test('manual verification requires verified email, is audited, and cannot approve owners', async () => { const { pg, mod } = await setup(); try {
    assert.equal(await mod.canBusinessContribute({ id: 'business', email: 'workshop@example.com', emailVerified: false }), false);
    await assert.rejects(mod.verifyBusinessAccount('admin', { userId: 'business', verified: true, note: 'Checked business' }), /verified email/);
    await pg.query('UPDATE "user" SET "emailVerified"=true WHERE id=$1', ['business']);
    await assert.rejects(mod.verifyBusinessAccount('admin', { userId: 'owner', verified: true, note: 'No' }));
    await assert.rejects(mod.verifyBusinessAccount('admin', { userId: 'business', verified: true, note: '' }), /review note/);
    await mod.verifyBusinessAccount('admin', { userId: 'business', verified: true, note: 'Confirmed contact and business evidence' });
    assert.equal(await mod.canBusinessContribute({ id: 'business', email: 'workshop@example.com', emailVerified: true }), true);
    assert.equal(await mod.canBusinessContribute({ id: 'business', email: 'different@example.com', emailVerified: true }), false);
    assert.equal((await pg.query('SELECT count(*)::int n FROM business_account_review_events')).rows[0].n, 1);
    await mod.verifyBusinessAccount('admin', { userId: 'business', verified: false, note: 'Needs another review' });
    assert.equal(await mod.canBusinessContribute({ id: 'business', email: 'workshop@example.com', emailVerified: true }), false);
}
finally {
    await pg.close();
} });
test('changed identity clears verification; payload cannot self-approve or change role', async () => { const { pg, mod } = await setup(); try {
    await pg.query('UPDATE "user" SET "emailVerified"=true');
    await mod.verifyBusinessAccount('admin', { userId: 'business', verified: true, note: 'Checked' });
    await mod.saveBusinessDetails('business', { businessName: 'New Workshop', phone: '456', website: 'https://example.com', evidence: 'Local workshop', verified: true, accountType: 'owner' });
    assert.equal(await mod.canBusinessContribute({ id: 'business', email: 'workshop@example.com', emailVerified: true }), false);
    const r = (await pg.query("SELECT account_type,business_name FROM account_profiles WHERE user_id='business'")).rows[0];
    assert.equal(r.account_type, 'business');
    assert.equal(r.business_name, 'New Workshop');
    await assert.rejects(mod.saveBusinessDetails('owner', { businessName: 'No' }));
    await assert.rejects(mod.saveBusinessDetails('business', { businessName: 'Test', website: 'javascript:alert(1)' }));
    await pg.query("UPDATE account_profiles SET account_status='suspended' WHERE user_id='business'");
    await assert.rejects(mod.saveBusinessDetails('business', { businessName: 'Test' }));
    await assert.rejects(mod.verifyBusinessAccount('admin', { userId: 'business', verified: true, note: 'Checked' }));
}
finally {
    await pg.close();
} });
test('role migration preserves existing roles and the new business role on repeated setup', async () => { const pg = new PGlite(); try {
    await pg.exec(`CREATE FUNCTION pg_advisory_xact_lock(integer) RETURNS void LANGUAGE SQL AS 'SELECT'; CREATE TABLE account_profiles(account_type text,account_subtype text);INSERT INTO account_profiles VALUES('business','contributor'),('owner','farmer'),('dealer','machinery-dealer'),('licensing','licence-renewal-expert');`);
    const source = fs.readFileSync('lib/account-profile.ts', 'utf8');
    const block = source.slice(source.indexOf('async function ensureAccountRoleSchema'), source.indexOf('async function ensureAccountProfileColumnsOnce'));
    const sql = block.match(/await db.query\(`([\s\S]*?)`\)/)[1];
    await pg.exec(sql);
    await pg.exec(sql);
    assert.deepEqual((await pg.query('SELECT account_type FROM account_profiles ORDER BY account_type')).rows.map(r => r.account_type), ['business', 'dealer', 'licensing', 'owner']);
    for(const subtype of ['finance-services','insurance-services','licensing-services','accounting-services','maintenance-services'])await pg.query('INSERT INTO account_profiles VALUES($1,$2)',['business',subtype]);
    const before=(await pg.query('SELECT * FROM account_profiles ORDER BY account_type,account_subtype')).rows;
    await pg.exec(fs.readFileSync('database/migrations/119-business-account-services.sql','utf8'));
    await pg.exec(sql);
    assert.deepEqual((await pg.query('SELECT * FROM account_profiles ORDER BY account_type,account_subtype')).rows,before,'Service types survive migration and repeated schema setup');
    await assert.rejects(pg.exec("INSERT INTO account_profiles VALUES('business','farmer')"));
}
finally {
    await pg.close();
} });
test('free business signup never reads a billing plan or creates a charge', async () => { const shared = load('lib/billing-shared.ts', {}); const billing = load('lib/billing.ts', { './hosting-pricing':load('lib/hosting-pricing.ts',{}), './db': { getDb: () => { throw Error('Billing must not be consulted'); } }, './billing-schema': {}, './billing-shared': shared, './billing-report': {}, './admin-work-tracker': {} }); assert.equal(await billing.validateSignupBilling({ accountType: 'business', billingAccepted: true, billingPlanVersion: 999 }), null); });
test('active business accounts do not pass the paid API session gate', async () => { let role = 'business'; const profile = load('lib/account-profile.ts', { './sharing-foundation': {sharingPlan:async()=>role==='business'?'free':'desktop'}, './account-entitlements': load('lib/account-entitlements.ts', {}), './retired-workspaces': load('lib/retired-workspaces.ts', {}), './db': { getDb: () => ({ query: async (sql) => ({ rows: sql.trim().toLowerCase().startsWith('select') ? [{ user_id: 'b', account_type: role, account_subtype: role === 'business' ? 'contributor' : 'farmer', account_status: 'active' }] : [] }) }) }, './account-constants': load('lib/account-constants.ts', {}), './asset-registers': {}, './database-schema-readiness': { isDatabaseSchemaReady: async () => true }, './middleman-account': { isMiddlemanAccountSubtype: () => false } }); assert.equal(await profile.isAccountActive({ id: 'b', email: 'b@example.com' }), false); role = 'owner'; assert.equal(await profile.isAccountActive({ id: 'b', email: 'b@example.com' }), true); });
test('Admin verification endpoints reject non-admin reads and foreign-origin writes', async () => {
    let session = null, writes = 0, reads = 0, schemaCalls = 0;
    const route = load('app/api/admin/business-accounts/route.ts', {
        'next/server': require('next/server'),
        '../../../../lib/auth-session': { getAnyServerSession: async () => session },
        '../../../../lib/account-constants': { isAim4priceAdminEmail: e => e === 'admin@example.com' },
        '../../../../lib/account-profile': { ensureAccountProfileColumns: async () => schemaCalls++ },
        '../../../../lib/business-accounts': {
            verifyBusinessAccount: async () => writes++,
            listBusinessAccounts: async () => { reads++; return [{ user_id: 'b', email: 'private@example.com' }]; },
        },
        '../../../../lib/business-network-api': {
            requireBusinessOrigin: r => { if (r.headers.get('origin') !== 'https://aim4price.com') throw Error('Origin'); },
            businessBody: r => r.json(),
            businessJson: (d, s = 200) => Response.json(d, { status: s, headers: { 'Cache-Control': 'private, no-store, max-age=0' } }),
            businessError: () => Response.json({}, { status: 400 }),
        },
    });
    const request = origin => new Request('https://aim4price.com/api/admin/business-accounts', { method: 'PATCH', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'b', verified: true, note: 'Checked' }) });
    assert.equal((await route.GET()).status, 403);
    session = { user: { id: 'actor', email: 'other@example.com' } };
    assert.equal((await route.GET()).status, 403);
    assert.equal((await route.PATCH(request('https://aim4price.com'))).status, 403);
    assert.equal(reads, 0);
    assert.equal(schemaCalls, 0);
    session.user.email = 'admin@example.com';
    const response = await route.GET();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).accounts[0].user_id, 'b');
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(reads, 1);
    assert.equal(schemaCalls, 1);
    assert.equal((await route.PATCH(request('https://evil.example'))).status, 400);
    assert.equal(writes, 0);
    assert.equal((await route.PATCH(request('https://aim4price.com'))).status, 200);
    assert.equal(writes, 1);
});

test('Dealer contact edits preserve account type and cannot self-approve',async()=>{const {pg,mod}=await setup();try{
 await pg.query("INSERT INTO account_profiles(user_id,account_type,account_status,business_name,phone) VALUES('dealer','dealer','active','Dealer','')");
 await mod.saveBusinessDetails('dealer',{businessName:'Dealer Workshop',phone:'0821234567',website:'',accountType:'owner',verified:true});
 const row=(await pg.query("SELECT account_type,phone FROM account_profiles WHERE user_id='dealer'")).rows[0];assert.equal(row.account_type,'dealer');assert.equal(row.phone,'0821234567');
 assert.equal((await pg.query("SELECT verified_at FROM business_account_reviews WHERE user_id='dealer'")).rows[0].verified_at,null);
 await pg.query("UPDATE account_profiles SET account_status='suspended' WHERE user_id='dealer'");await assert.rejects(mod.saveBusinessDetails('dealer',{businessName:'Changed',phone:'123'}),/unavailable/);
}finally{await pg.close();}});

test('only activated Paid Business owners gain desktop access on migration; free, pending and suspended accounts stay restricted',async()=>{
 const pg=new PGlite();
 try {
  await pg.exec(`create table "user"(id text primary key,email text);
    create table account_profiles(user_id text primary key, account_type text,account_subtype text,account_status text,updated_at timestamptz);
    create table sharing_account_access(user_id text primary key,plan text,updated_at timestamptz);
    create table business_workspaces(owner_user_id text primary key,paid_since timestamptz,upgrade_requested_at timestamptz);
    insert into business_workspaces values ('b',now(),null),('f',null,now()),('s',now(),null),('g',now(),null);
    insert into account_profiles values ('b','business','insurance-services','active',null),
      ('f','business','contributor','active',null),('s','business','maintenance-services','suspended',null),('d','dealer','motor-dealer','active',null);
    insert into sharing_account_access values ('b','free',null),('s','free',null),('f','free',null);
    create table guest_businesses(email text,suspended boolean);
    insert into account_profiles values ('g','business','contributor','active',null);
    insert into "user" values ('g','guest@test');insert into guest_businesses values('guest@test',true);`);
  const migration=fs.readFileSync('database/migrations/164-business-desktop.sql','utf8');
  await pg.exec('begin;'+migration+'commit;');
  await pg.exec('begin;'+migration+'commit;');
  assert.deepEqual((await pg.query("select user_id,account_type from account_profiles order by user_id")).rows.map(r=>[r.user_id,r.account_type]),[['b','dealer'],['d','dealer'],['f','business'],['g','business'],['s','business']]);
  assert.equal((await pg.query("select account_subtype from account_profiles where user_id='b'")).rows[0].account_subtype,'insurance-services');
  assert.equal((await pg.query("select plan from sharing_account_access where user_id='b'")).rows[0].plan,'desktop');
  assert.equal((await pg.query("select plan from sharing_account_access where user_id='f'")).rows[0].plan,'free');
 } finally {await pg.close();}
});

test('the Business details wizard saves all three steps together and preserves review evidence and tier', async () => {
    const {pg,mod} = await setup();
    try {
        await pg.exec('ALTER TABLE account_profiles ADD display_name text, ADD marketplace_seller_name text, ADD marketplace_phone text, ADD marketplace_location text, ADD marketplace_email text, ADD province text, ADD town_city text, ADD address_line_1 text, ADD address_line_2 text, ADD logo_url text, ADD website_url text');
        await mod.saveBusinessDetails('business',{businessName:'Workshop',phone:'123',website:'',evidence:'Existing review evidence'});
        await mod.saveBusinessDetails('business',{editProfile:true,marketplaceSellerName:'Workshop Sales',displayName:'Alex',businessName:'Workshop',marketplaceEmail:'INFO@example.com',phone:'123',province:'Western Cape',townCity:'George',addressLine1:'1 Main Road',addressLine2:'Unit 2',website:'https://example.com',logoUrl:'/logos/workshop.png'});
        const {rows:[record]} = await pg.query("SELECT p.*,r.evidence FROM account_profiles p JOIN business_account_reviews r USING(user_id) WHERE p.user_id='business'");
        assert.equal(record.marketplace_seller_name,'Workshop Sales');
        assert.deepEqual([record.display_name,record.marketplace_email,record.province,record.town_city,record.address_line_1,record.address_line_2,record.website_url,record.logo_url,record.evidence,record.account_type],['Alex','info@example.com','Western Cape','George','1 Main Road','Unit 2','https://example.com','/logos/workshop.png','Existing review evidence','business']);
    } finally { await pg.close(); }
});
