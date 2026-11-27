const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

test('schedule edits enforce ownership and asset scope, preserve shared proportions and reject stale drafts', async () => {
  const db = new PGlite();
  const assetA = '00000000-0000-4000-8000-000000000001';
  const assetB = '00000000-0000-4000-8000-000000000002';
  const cost = '00000000-0000-4000-8000-000000000003';
  let owner = 'owner', allowed = [assetA, assetB];
  class AccessError extends Error {
    constructor(message, status) { super(message); this.status=status; }
  }
  const query = (sql, args) => db.query(sql, args);
  const deps = {
    'next/server':require('next/server'),
    '../../../../lib/trusted-request-origin':{isTrustedRequestOrigin:origin=>origin==='https://example.test'},
    '../../../../lib/db':{getDb:()=>({connect:async()=>({query,release(){}})})},
    '../../../../lib/owner-app-access':{getOwnerAppAccess:async()=>({ownerUserId:owner}),ownerAppCan:()=>true,ownerAppCanAccessAsset:(_,id)=>allowed.includes(id)},
    '../../../../lib/desktop-workspace':{getDesktopScope:async()=>null},
    '../../../../lib/team-access-policy':{TeamAccessError:AccessError},
  };
  const api = {};
  const source = ts.transpile(readFileSync('app/api/recurring-commitments/[commitmentId]/route.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
  new Function('exports','require',source)(api,key=>deps[key]);
  const update = async (amount, paused, previousAmount, previousPaused) => api.PATCH(new Request('https://example.test/api/recurring-commitments/'+cost, {
    method:'PATCH', headers:{origin:'https://example.test'}, body:JSON.stringify({amount,paused,previousAmount,previousPaused}),
  }),{params:{commitmentId:cost}});
  const remove = () => api.DELETE(new Request('https://example.test/api/recurring-commitments/'+cost, {
    method:'DELETE', headers:{origin:'https://example.test'}, body:JSON.stringify({previousAmount:200,previousPaused:false}),
  }),{params:{commitmentId:cost}});
  try {
    await db.exec(`create table asset_recurring_commitments(id uuid primary key, owner_user_id text, amount numeric, status text, updated_at timestamptz, updated_by_user_id text,
      constraint asset_recurring_commitments_status_check check(status in ('active','ended','cancelled')));
      create table asset_recurring_commitment_assets(recurring_commitment_id uuid, owner_user_id text,asset_register_item_id uuid,annual_allocation numeric);`);
    const migration = readFileSync('database/migrations/165-recurring-cost-controls.sql','utf8');
    await db.exec(migration); await db.exec(migration);
    await query("insert into asset_recurring_commitments values ($1,'owner',100,'active')",[cost]);
    await query("insert into asset_recurring_commitment_assets values ($1,'owner',$2,300),($1,'owner',$3,900)",[cost,assetA,assetB]);
    owner = 'unrelated'; assert.equal((await update(200,true,100,false)).status,404);
    owner = 'owner'; allowed=[assetA]; assert.equal((await update(200,true,100,false)).status,404);
    allowed.push(assetB); assert.equal((await update(200,true,100,false)).status,200);
    assert.equal((await update(300,false,100,false)).status,409);
    assert.equal((await update(200,false,200,true)).status,200);
    const record = (await query('select amount,status from asset_recurring_commitments')).rows[0];
    assert.equal(Number(record.amount),200); assert.equal(record.status,'active');
    const split = await query('select annual_allocation from asset_recurring_commitment_assets order by asset_register_item_id');
    assert.deepEqual(split.rows.map(row=>Number(row.annual_allocation)),[600,1800]);
    allowed=[assetA]; assert.equal((await remove()).status,404);
    allowed.push(assetB); assert.equal((await remove()).status,200);
    assert.equal((await query('select status from asset_recurring_commitments')).rows[0].status,'cancelled');
    assert.equal((await update(200,false,200,false)).status,404);
  } finally { await db.close(); }
});
