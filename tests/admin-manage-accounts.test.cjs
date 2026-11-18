const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const load = require('./helpers/load-ts.cjs');

test('manual creation and workspace changes preserve the login, status and client history', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`CREATE TABLE "user"(id text PRIMARY KEY, name text, email text UNIQUE,
      "emailVerified" boolean, "createdAt" timestamptz, "updatedAt" timestamptz);
      CREATE TABLE account_profiles(user_id text PRIMARY KEY REFERENCES "user", display_name text,
      account_type text, account_subtype text, account_status text, introduced_by_option text,
      discovery_participation_enabled boolean, partner_directory_enabled boolean, updated_at timestamptz);
      CREATE TABLE saved_assets(id text PRIMARY KEY, user_id text REFERENCES "user");`);
    const db = {
      query: async (sql, params) => {
        const result = params ? await pg.query(sql,params) : (await pg.exec(sql)).at(-1);
        return {...result,rowCount:result.rows.length || result.affectedRows};
      },
      connect: async () => db,
      release: () => {},
    };
    const access = {ok:true,actor:{userId:'admin'}};
    const fakeDb = {getDb:()=>db,withDatabaseClient:(_db,fn)=>fn()};
    const prefix = '../../../../../lib/';
    const route = load('app/api/admin/users/manage/route.ts',{
      './db':fakeDb, [prefix+'db']:fakeDb, './guest-lead-schema':{},
      [prefix+'admin-api-access']:{requireAdminApiAccess:async()=>access,adminApiError:(error,status=400)=>Response.json({error},{status})},
      [prefix+'account-profile']:{ensureAccountProfileColumns:async()=>{}},
      [prefix+'admin-users']:{listAdminUsers:async(id)=>(await db.query('SELECT * FROM account_profiles WHERE user_id=$1',[id])).rows},
    });
    const post = (body,origin='https://www.aim4price.com') => route.POST(new Request('https://www.aim4price.com/api/admin/users/manage',{
      method:'POST', headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body),
    }));
    const create = {action:'create',name:'Test client',email:'CLIENT@example.com',type:'business',subtype:'finance-services',status:'suspended'};
    assert.equal((await post(create,'https://example.com')).status,403);
    assert.equal((await post({...create,subtype:'farmer'})).status,400);
    const response = await post(create);
    assert.equal(response.status,201);
    const {user:{user_id:id}} = await response.json();
    assert.equal((await post(create)).status,409);
    await db.query('INSERT INTO saved_assets VALUES($1,$2)',['tractor',id]);
    let previousType = 'business', previousSubtype = 'finance-services';
    for (const [type,subtype,stored] of [['middleman','equipment-middleman','dealer'],['owner','farmer','owner'],['dealer','auctioneer','dealer'],['business','contributor','business']]) {
      const change = {action:'change_type',userId:id,type,subtype,previousType,previousSubtype};
      const changed = await post(change);
      assert.equal(changed.status,200);
      const {user} = await changed.json();
      assert.equal(user.account_status,'suspended');
      assert.equal(user.account_type,stored);
      assert.equal(user.account_subtype,subtype);
      assert.equal((await post(change)).status,409);
      previousType=stored;
      previousSubtype=subtype;
    }
    assert.equal((await db.query('SELECT * FROM saved_assets')).rows[0].user_id,id);
    assert.equal((await db.query('SELECT plan FROM sharing_account_access')).rows[0].plan,'free');
    assert.equal((await db.query('SELECT * FROM business_workspaces')).rows.length,1);
    assert.equal((await db.query('SELECT * FROM sharing_admin_events')).rows.length,5);
    assert.equal((await post({...create,email:'aim4price@gmail.com'})).status,409);
  } finally { await pg.close(); }
});
