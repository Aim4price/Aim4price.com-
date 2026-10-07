const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aim4price-ai-'));
for (const file of [
  'account-constants',
  'ai-connection/security',
  'ai-connection/store',
  'ai-connection/data',
  'ai-connection/extended-data',
  'asset-usage',
  'ai-connection/rate-limit',
  'ai-connection/mcp',
  'external-share-permissions',
]) {
  const destination = path.join(tmp, file + '.js');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(
    destination,
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, '../lib', file + '.ts'), 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
  );
}
const security = require(path.join(tmp, 'ai-connection/security.js'));
const store = require(path.join(tmp, 'ai-connection/store.js'));
const { handleMcp } = require(path.join(tmp, 'ai-connection/mcp.js'));
const { parseReadArgs } = require(path.join(tmp, 'ai-connection/data.js'));
const { sharedEnquiryReturnTo } = require(
  path.join(tmp, 'external-share-permissions.js'),
);
const config = {
  origin: 'https://aim4price.com',
  resource: 'https://aim4price.com/api/ai/mcp',
  clientId: 'pilot',
  clientSecret: 's'.repeat(40),
  signingSecret: 'h'.repeat(40),
  redirectUris: ['https://chatgpt.com/callback'],
  allowedUserIds: [
    'owner-a',
    'owner-b',
    'admin',
    'dealer',
    'free',
    'suspended',
  ],
};
let db, pool, access, refresh;
const assetA = '11111111-1111-4111-8111-111111111111',
  assetB = '22222222-2222-4222-8222-222222222222';
function authParams(overrides = {}) {
  return new URLSearchParams({
    client_id: 'pilot',
    redirect_uri: config.redirectUris[0],
    response_type: 'code',
    code_challenge_method: 'S256',
    code_challenge: security.pkce('v'.repeat(43)),
    state: 'random-client-state',
    resource: config.resource,
    scope: 'aim4price:read',
    ...overrides,
  });
}
async function createGrant(user = 'owner-a') {
  const a = security.authorizationRequest(authParams(), config);
  const proof = security.consentProof(
    a,
    user,
    'session',
    config.signingSecret,
    Date.now() + Math.random() * 1000,
  );
  const code = await store.issueCode(pool, user, a, proof, config);
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: a.redirectUri,
    code_verifier: 'v'.repeat(43),
    resource: config.resource,
  });
  return {
    tokens: await store.exchangeToken(pool, form, config),
    form,
    proof,
    a,
  };
}
async function rpc(method, params = {}, token = access, headers = {}) {
  return handleMcp(
    new Request(config.resource, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...headers,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
    pool,
    config,
  );
}
async function call(name, args = {}) {
  const response = await rpc('tools/call', { name, arguments: args });
  assert.equal(response.status, 200);
  return (await response.json()).result;
}
before(async () => {
  db = new PGlite();
  pool = {
    query: (sql, values) => db.query(sql, values),
    connect: async () => ({
      query: (sql, values) => db.query(sql, values),
      release() {},
    }),
  };
  await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,name text,email text);
 CREATE TABLE account_profiles(user_id text PRIMARY KEY,account_type text,account_status text,business_name text);
 CREATE TABLE sharing_account_access(user_id text PRIMARY KEY,plan text);
 CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text,title text,brand_name text,model_name text,selected_value_ex_vat numeric,serial_number text,updated_at timestamptz);
 CREATE TABLE asset_invoices(id uuid PRIMARY KEY,user_id text,asset_register_item_id uuid,invoice_date date,supplier_name text,invoice_number text,total_inc_vat numeric,vat_amount numeric,source text,created_by_dealer_user_id text,owner_storage_status text);
 CREATE TABLE asset_invoice_blocks(id uuid PRIMARY KEY,invoice_id uuid,block_type text,total_inc_vat numeric);
 CREATE TABLE fuel_slips(id uuid PRIMARY KEY,user_id text,record_status text,asset_register_item_id uuid,target_type text,document_date date,supplier_name text,fuel_type text,litres numeric,price_per_litre numeric,total_amount numeric,vat_included boolean,hour_meter_reading numeric,odometer_reading numeric,review_required boolean);
 CREATE TABLE fuel_storage_events(id uuid PRIMARY KEY,user_id text,event_type text,source_type text,fuel_slip_id uuid,asset_register_item_id text,storage_id uuid,litres numeric,issue_at timestamptz,created_at timestamptz);`);
  await db.exec(
    fs.readFileSync(
      path.join(
        __dirname,
        '../database/migrations/135-read-only-ai-connections.sql',
      ),
      'utf8',
    ),
  );
  for (const id of config.allowedUserIds) {
    await db.query('INSERT INTO "user" VALUES($1,$2,$3)', [
      id,
      id,
      id === 'admin' ? 'aim4price@gmail.com' : id + '@example.com',
    ]);
    await db.query('INSERT INTO account_profiles VALUES($1,$2,$3,$4)', [
      id,
      id === 'dealer' ? 'dealer' : 'owner',
      id === 'suspended' ? 'suspended' : 'active',
      id,
    ]);
  }
  await db.query("INSERT INTO sharing_account_access VALUES('free','free')");
  await db.query(
    'INSERT INTO asset_register_items VALUES($1,$2,$3,$4,$5,$6,$7,now()),($8,$9,$10,$11,$12,$13,$14,now())',
    [
      assetA,
      'owner-a',
      'Tractor A',
      'John Deere',
      '5100',
      500000,
      'SERIAL-A',
      assetB,
      'owner-b',
      'Private B',
      'Other',
      'SECRET',
      999999,
      'SECRET-B',
    ],
  );
  await db.exec(`INSERT INTO asset_invoices VALUES
 ('10000000-0000-4000-8000-000000000001','owner-a','${assetA}','2026-09-01','A','1',115,15,'manual',null,'owner'),
 ('10000000-0000-4000-8000-000000000002','owner-a','${assetA}','2026-09-02','A','2',230,30,'fuel_slip',null,'owner'),
 ('10000000-0000-4000-8000-000000000003','owner-a','${assetA}','2026-09-03','Unapproved','3',9000,0,'manual','dealer','pending'),
 ('10000000-0000-4000-8000-000000000004','owner-b','${assetB}','2026-09-01','SECRET','4',999999,0,'manual',null,'owner');
 INSERT INTO asset_invoice_blocks VALUES('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','maintenance',115);
 INSERT INTO fuel_slips VALUES
 ('40000000-0000-4000-8000-000000000001','owner-a','active','${assetA}','asset','2026-09-02','A','diesel',10,23,230,true,120,null,false),
 ('40000000-0000-4000-8000-000000000002','owner-b','active','${assetB}','asset','2026-09-02','SECRET','diesel',1000,23,23000,true,null,null,false),
 ('40000000-0000-4000-8000-000000000003','owner-a','voided','${assetA}','asset','2026-09-02','A','diesel',500,23,11500,true,null,null,false),
 ('40000000-0000-4000-8000-000000000004','owner-a','active','${assetA}','asset',null,'A','diesel',5,23,115,true,null,null,false);
 INSERT INTO fuel_storage_events VALUES
 ('50000000-0000-4000-8000-000000000001','owner-a','asset_issue','manual',null,'${assetA}',null,12,'2026-08-31 23:00Z',now()),
 ('50000000-0000-4000-8000-000000000002','owner-a','asset_issue','fuel_slip','40000000-0000-4000-8000-000000000001','${assetA}',null,10,'2026-09-02 12:00Z',now()),
 ('50000000-0000-4000-8000-000000000003','owner-b','asset_issue','manual',null,'${assetB}',null,1000,'2026-09-02 12:00Z',now());`);

  await db.exec(`
    ALTER TABLE asset_register_items ADD COLUMN hours numeric;
    ALTER TABLE asset_register_items ADD COLUMN kind text;
    ALTER TABLE asset_register_items ADD COLUMN specs_json jsonb;
    UPDATE asset_register_items SET hours=120,kind='tractor';
    CREATE TABLE asset_cost_budgets(id uuid PRIMARY KEY,user_id text,asset_register_item_id uuid,period text,amount numeric,warning_percent integer,include_fuel_slip_costs boolean,revision integer,updated_at timestamptz);
    INSERT INTO asset_cost_budgets VALUES
    ('60000000-0000-4000-8000-000000000001','owner-a',null,'monthly',300,80,true,1,now()),
    ('60000000-0000-4000-8000-000000000002','owner-a','${assetA}','annual',200,50,false,1,now()),
    ('60000000-0000-4000-8000-000000000003','owner-b','${assetB}','monthly',99999,80,true,1,now()),
    ('60000000-0000-4000-8000-000000000004','owner-a','${assetB}','monthly',99999,80,true,1,now());
    CREATE TABLE asset_maintenance_records(id uuid PRIMARY KEY,user_id text,asset_register_item_id uuid,maintenance_type text,trigger_type text,status text,title text,notes text,assigned_name text,due_date date,due_usage numeric,usage_metric text,alert_before_value numeric,alert_before_unit text,recurring_enabled boolean,recurring_interval_value numeric,recurring_interval_unit text,completed_at timestamptz,completed_usage numeric,completed_notes text,completed_by text,source_scan_event_id uuid,updated_at timestamptz);
    INSERT INTO asset_maintenance_records(id,user_id,asset_register_item_id,maintenance_type,trigger_type,status,title,due_date,due_usage,usage_metric) VALUES
    ('70000000-0000-4000-8000-000000000001','owner-a','${assetA}','service','date','upcoming','Overdue service','2000-01-01',null,null),
    ('70000000-0000-4000-8000-000000000002','owner-a','${assetA}','service','usage','upcoming','Usage due',null,120,'hours'),
    ('70000000-0000-4000-8000-000000000003','owner-a','${assetA}','service','date','done','Completed work','2000-01-01',null,null),
    ('70000000-0000-4000-8000-000000000004','owner-b','${assetB}','service','date','upcoming','SECRET','2000-01-01',null,null),
    ('70000000-0000-4000-8000-000000000005','owner-a','${assetB}','service','date','upcoming','CORRUPT FOREIGN LINK','2000-01-01',null,null);
    CREATE TABLE asset_scan_events(id uuid PRIMARY KEY,asset_id uuid,created_at timestamptz,note text,operator_name text,issue_noted_at timestamptz,hours numeric,asset_usage_reading numeric,asset_usage_metric text,photo_urls jsonb);
    INSERT INTO asset_scan_events(id,asset_id,created_at,note,operator_name,issue_noted_at,photo_urls) VALUES
    ('80000000-0000-4000-8000-000000000001','${assetA}','2026-08-31 23:00Z','Serviced: oil changed','Mechanic',null,'["secret-photo-url"]'),
    ('80000000-0000-4000-8000-000000000002','${assetA}','2026-09-02 12:00Z','Notes/Problems: oil leak','Operator',null,'[]'),
    ('80000000-0000-4000-8000-000000000003','${assetA}','2026-09-03 12:00Z','Notes / Problems: tyre puncture','Operator',now(),'[]'),
    ('80000000-0000-4000-8000-000000000004','${assetB}','2026-09-02 12:00Z','Serviced: SECRET','SECRET',null,'[]'),
    ('80000000-0000-4000-8000-000000000005','${assetB}','2026-09-02 12:00Z','Notes/Problems: SECRET','SECRET',null,'[]');
  `);
  const grant = await createGrant();
  access = grant.tokens.access_token;
  refresh = grant.tokens.refresh_token;
});
after(async () => {
  await db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});
test('pilot disabled by default and incomplete configuration fails closed', () => {
  assert.throws(() => security.connectionConfig({}), /not enabled/);
  assert.throws(
    () =>
      security.connectionConfig({
        AIM4PRICE_AI_ENABLED: 'true',
        AIM4PRICE_AI_ORIGIN: 'http://localhost',
      }),
    /HTTPS/,
  );
});
test('OAuth exact redirect, resource, PKCE and read scope validation', () => {
  for (const overrides of [
    { redirect_uri: 'https://evil.example/callback' },
    { redirect_uri: config.redirectUris[0] + '?extra=1' },
    { scope: 'aim4price:write' },
    { resource: 'https://evil.example' },
    { code_challenge_method: 'plain' },
    { response_type: 'token' },
  ])
    assert.throws(() =>
      security.authorizationRequest(authParams(overrides), config),
    );
  const params = authParams();
  params.append('client_id', 'other');
  assert.throws(() => security.authorizationRequest(params, config));
});
test('consent proof binds account and session, rejects tampering and expiry', () => {
  const a = security.authorizationRequest(authParams(), config);
  const proof = security.consentProof(
    a,
    'owner-a',
    'session',
    config.signingSecret,
    1000,
  );
  assert.deepEqual(
    security.verifyConsent(proof, 'owner-a', 'session', config, 2000),
    a,
  );
  for (const [p, u, s, t] of [
    [proof + 'x', 'owner-a', 'session', 2000],
    [proof, 'owner-b', 'session', 2000],
    [proof, 'owner-a', 'other', 2000],
    [proof, 'owner-a', 'session', 700000],
  ])
    assert.throws(() => security.verifyConsent(p, u, s, config, t));
  assert.throws(() =>
    security.requireSameOrigin(
      new Request(config.origin, {
        headers: { Origin: 'https://evil.example' },
      }),
      config,
    ),
  );
});
test('OAuth client credentials are verified; mixed authentication rejected', () => {
  store.authenticateClient(
    new URLSearchParams({
      client_id: 'pilot',
      client_secret: config.clientSecret,
    }),
    null,
    config,
  );
  store.authenticateClient(
    new URLSearchParams(),
    `Basic ${Buffer.from('pilot:' + config.clientSecret).toString('base64')}`,
    config,
  );
  assert.throws(() =>
    store.authenticateClient(
      new URLSearchParams({ client_id: 'pilot', client_secret: 'wrong' }),
      null,
      config,
    ),
  );
  assert.throws(() =>
    store.authenticateClient(
      new URLSearchParams({ client_id: 'pilot' }),
      'Basic abc',
      config,
    ),
  );
});
test('tokens stored only as hashes; code and consent replay fail', async () => {
  const grant = await createGrant();
  await assert.rejects(
    store.exchangeToken(pool, grant.form, config),
    /invalid or expired/,
  );
  await assert.rejects(
    store.issueCode(pool, 'owner-a', grant.a, grant.proof, config),
  );
  const rows = (await db.query('SELECT * FROM ai_connections')).rows;
  assert.ok(!JSON.stringify(rows).includes(grant.tokens.access_token));
  assert.ok(!JSON.stringify(rows).includes(grant.tokens.refresh_token));
});
test('wrong verifier cannot redeem a code', async () => {
  const a = security.authorizationRequest(authParams(), config);
  const proof = security.consentProof(
    a,
    'owner-a',
    'wrong-verifier',
    config.signingSecret,
  );
  const code = await store.issueCode(pool, 'owner-a', a, proof, config);
  await assert.rejects(
    store.exchangeToken(
      pool,
      new URLSearchParams({
        grant_type: 'authorization_code',
        resource: config.resource,
        code,
        code_verifier: 'x'.repeat(43),
        redirect_uri: a.redirectUri,
      }),
      config,
    ),
    /invalid or expired/,
  );
});
test('read-only PostgreSQL transaction rejects business writes', async () => {
  await assert.rejects(
    store.readOnly(pool, (client) =>
      client.query("UPDATE asset_register_items SET title='changed'"),
    ),
    /read-only/i,
  );
  assert.equal(
    (
      await db.query('SELECT title FROM asset_register_items WHERE id=$1', [
        assetA,
      ])
    ).rows[0].title,
    'Tractor A',
  );
});
test('all tools are read only and initialization works', async () => {
  const init = await rpc('initialize', { protocolVersion: '2025-11-25' });
  assert.equal((await init.json()).result.protocolVersion, '2025-11-25');
  const list = await rpc('tools/list');
  const tools = (await list.json()).result.tools;
  assert.equal(tools.length, 9);
  assert.ok(
    tools.every(
      (t) =>
        t.annotations.readOnlyHint &&
        !t.annotations.destructiveHint &&
        t.inputSchema.additionalProperties === false,
    ),
  );
});
test('unauthenticated, invalid and cross-origin calls fail', async () => {
  assert.equal((await rpc('tools/list', {}, null)).status, 401);
  assert.equal((await rpc('tools/list', {}, 'x'.repeat(43))).status, 401);
  assert.equal(
    (await rpc('tools/list', {}, access, { Origin: 'https://evil.example' }))
      .status,
    403,
  );
});
test('account-bound tools reject owner override, unknown writes and arbitrary SQL', async () => {
  for (const [name, args] of [
    ['list_assets', { userId: 'owner-b' }],
    ['list_assets', { accountId: 'owner-b' }],
    ['add_fuel', { litres: 10 }],
    ['query', { sql: 'DELETE FROM asset_register_items' }],
  ])
    assert.equal((await call(name, args)).isError, true);
  assert.equal(
    (
      await handleMcp(
        new Request(config.resource, { method: 'DELETE' }),
        pool,
        config,
      )
    ).status,
    405,
  );
});
test('only own assets are returned; foreign IDs are indistinguishable from missing IDs', async () => {
  const own = (await call('list_assets')).structuredContent;
  assert.equal(own.records.length, 1);
  assert.equal(own.records[0].id, assetA);
  assert.equal(own.records[0].saved_value_ex_vat, '500000');
  assert.equal((await call('list_assets', { assetId: assetB })).isError, true);
  assert.equal(
    (
      await call('read_costs', {
        from: '2026-09-01',
        to: '2026-09-30',
        assetId: assetB,
      })
    ).isError,
    true,
  );
  const search = (await call('list_assets', { query: "' OR 1=1 --" }))
    .structuredContent;
  assert.equal(search.records.length, 0);
});
test('cost total covers all pages, excludes pending dealer proposals and other owners', async () => {
  const result = (
    await call('read_costs', { from: '2026-09-01', to: '2026-09-30', limit: 1 })
  ).structuredContent;
  assert.equal(result.records.length, 1);
  assert.equal(result.summary.total_inc_vat, '345');
  assert.equal(result.summary.recorded_vat, '45');
  assert.equal(result.pagination.totalRecords, 2);
  assert.equal(result.pagination.hasMore, true);
  assert.equal(result.summary.categories[0].total_inc_vat, '115');
  const page = (
    await call('read_costs', {
      from: '2026-09-01',
      to: '2026-09-30',
      limit: 1,
      offset: 1,
    })
  ).structuredContent;
  assert.equal(page.summary.total_inc_vat, '345');
  assert.notEqual(page.records[0].id, result.records[0].id);
});
test('fuel excludes voided/foreign records, reports undated data and separates tank issues', async () => {
  const result = (
    await call('read_fuel_slips', { from: '2026-09-01', to: '2026-09-30' })
  ).structuredContent;
  assert.equal(result.summary.litres, '10');
  assert.equal(result.summary.excludedUndatedRecords, 1);
  const issues = (
    await call('read_fuel_issues', { from: '2026-09-01', to: '2026-09-01' })
  ).structuredContent;
  assert.equal(issues.summary.litres, '12');
  assert.equal(issues.records.length, 1);
});
test('strict date and pagination validation', () => {
  for (const args of [
    { from: '2026-02-30', to: '2026-03-01' },
    { from: '2026-09-02', to: '2026-09-01' },
    { from: '2026-09-01', to: '2026-09-30', limit: 1000 },
    { from: '2026-09-01', to: '2026-09-30', offset: -1 },
  ])
    assert.throws(() => parseReadArgs('read_costs', args));
});

test('budget progress covers full current period, respects fuel settings and never leaks foreign-linked budgets', async () => {
  const dates = (await db.query('SELECT id,invoice_date::text AS date FROM asset_invoices')).rows;
  try {
    await db.exec("UPDATE asset_invoices SET invoice_date=(now() AT TIME ZONE 'Africa/Johannesburg')::date");
    const first = (await call('read_budgets',{limit:1})).structuredContent;
    assert.equal(first.pagination.totalRecords,2);
    assert.equal(first.records[0].spent,'345');
    assert.equal(first.records[0].over_by,'45');
    assert.equal(first.records[0].status,'over_budget');
    assert.equal(first.pagination.nextOffset,1);
    const second = (await call('read_budgets',{assetId:assetA})).structuredContent;
    assert.equal(second.records.length,1);
    assert.equal(second.records[0].spent,'115');
    assert.equal(second.records[0].remaining,'85');
    assert.equal(second.records[0].status,'warning');
    assert.equal(second.records[0].include_fuel_slip_costs,false);
  } finally { for(const row of dates) await db.query('UPDATE asset_invoices SET invoice_date=$1::date WHERE id=$2',[row.date,row.id]); }
});
test('maintenance exposes schedules/completion and calculates due dates/usage only for owned assets',async()=>{
  const result=(await call('read_maintenance')).structuredContent;
  assert.equal(result.pagination.totalRecords,3);
  assert.deepEqual(result.records.map(r=>r.computed_status),['overdue','due','done']);
  assert.ok(result.records.every(r=>r.asset_id===assetA));
  assert.ok(result.records.every(r=>!('asset_specs' in r)));
  const paged=(await call('read_maintenance',{limit:1,offset:1})).structuredContent;
  assert.equal(paged.records.length,1);assert.equal(paged.pagination.totalRecords,3);
});
test('maintenance cannot infer a safe due state from missing or incompatible readings',()=>{
  const {maintenanceStatus}=require(path.join(tmp,'ai-connection/extended-data.js'));
  const base={status:'upcoming',trigger_type:'usage',due_usage:100,current_usage:95,usage_metric:'hours',current_usage_metric:'hours'};
  assert.equal(maintenanceStatus(base,'2026-09-01'),'due_soon');
  assert.equal(maintenanceStatus({...base,current_usage:null},'2026-09-01'),'unknown');
  assert.equal(maintenanceStatus({...base,current_usage_metric:'km'},'2026-09-01'),'unknown');
  assert.equal(maintenanceStatus({...base,status:'cancelled'},'2026-09-01'),'cancelled');
  assert.equal(maintenanceStatus({...base,trigger_type:'date',due_date:'2026-09-01'},'2026-09-01'),'due');
});
test('field activity and problems use SA dates, expose resolution state and exclude foreign data/photos',async()=>{
  const period={from:'2026-09-01',to:'2026-09-30'};
  const activity=(await call('read_maintenance_activity',period)).structuredContent;
  assert.equal(activity.records.length,1);
  assert.equal(activity.records[0].note,'Serviced: oil changed');
  assert.ok(!JSON.stringify(activity).includes('secret-photo-url'));
  const problems=(await call('read_problems',{...period,limit:1})).structuredContent;
  assert.equal(problems.pagination.totalRecords,2);assert.equal(problems.records.length,1);
  assert.ok(problems.records[0].noted_or_resolved_at);
  const next=(await call('read_problems',{...period,offset:1})).structuredContent;
  assert.equal(next.records[0].noted_or_resolved_at,null);
});
test('every extended tool rejects cross-account selectors and leaves business records unchanged',async()=>{
  const before=(await db.query('SELECT jsonb_agg(to_jsonb(m)) AS rows FROM asset_maintenance_records m')).rows;
  for(const name of ['read_budgets','read_maintenance','read_maintenance_activity','read_problems']){
    const args=name==='read_budgets'||name==='read_maintenance'?{}:{from:'2026-09-01',to:'2026-09-30'};
    assert.equal((await call(name,{...args,assetId:assetB})).isError,true);
    assert.equal((await call(name,{...args,userId:'owner-b'})).isError,true);
    assert.equal((await call(name,{...args,sql:'DELETE FROM asset_maintenance_records'})).isError,true);
    assert.equal((await call(name,args)).isError,false);
  }
  assert.deepEqual((await db.query('SELECT jsonb_agg(to_jsonb(m)) AS rows FROM asset_maintenance_records m')).rows,before);
});
test('uninitialised optional data is unavailable, never an invented empty register',async()=>{
  await db.exec('ALTER TABLE asset_cost_budgets RENAME TO hidden_budgets');
  try {assert.equal((await call('read_budgets')).structuredContent.available,false);}
  finally {await db.exec('ALTER TABLE hidden_budgets RENAME TO asset_cost_budgets');}
});
test('refresh rotation invalidates old access and refresh tokens', async () => {
  const tokens = await store.exchangeToken(
    pool,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh,
      resource: config.resource,
    }),
    config,
  );
  assert.equal((await rpc('tools/list', {}, access)).status, 401);
  await assert.rejects(
    store.exchangeToken(
      pool,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh,
        resource: config.resource,
      }),
      config,
    ),
    /reused refresh token/,
  );
  assert.equal((await rpc('tools/list', {}, tokens.access_token)).status, 401);
  const replacement = await createGrant();
  access = replacement.tokens.access_token;
  refresh = replacement.tokens.refresh_token;
  assert.equal((await rpc('tools/list')).status, 200);
});
test('revocation immediately denies access and refresh', async () => {
  const { tokens } = await createGrant();
  await db.query(
    'UPDATE ai_connections SET revoked_at=now() WHERE access_hash=$1',
    [security.digest(tokens.access_token)],
  );
  assert.equal((await rpc('tools/list', {}, tokens.access_token)).status, 401);
  await assert.rejects(
    store.exchangeToken(
      pool,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        resource: config.resource,
      }),
      config,
    ),
  );
});
test('expired access/code, changed resource and scope are denied', async () => {
  const { tokens } = await createGrant();
  await db.query(
    "UPDATE ai_connections SET access_expires_at=now()-interval '1 second' WHERE access_hash=$1",
    [security.digest(tokens.access_token)],
  );
  assert.equal((await rpc('tools/list', {}, tokens.access_token)).status, 401);
  const a = security.authorizationRequest(authParams(), config);
  const code = await store.issueCode(
    pool,
    'owner-a',
    a,
    'expired-code-proof',
    config,
  );
  await db.query(
    "UPDATE ai_connection_codes SET expires_at=now()-interval '1 second' WHERE code_hash=$1",
    [security.digest(code)],
  );
  await assert.rejects(
    store.exchangeToken(
      pool,
      new URLSearchParams({
        grant_type: 'authorization_code',
        resource: config.resource,
        code,
        code_verifier: 'v'.repeat(43),
        redirect_uri: a.redirectUri,
      }),
      config,
    ),
  );
  const other = { ...config, resource: 'https://aim4price.com/different' };
  await assert.rejects(
    store.readOnly(pool, (client) =>
      store.authenticateToken(client, 'Bearer ' + access, other),
    ),
  );
});
test('admin/dealer/free/suspended accounts and removed pilot users fail closed', async () => {
  for (const user of ['admin', 'dealer', 'free', 'suspended'])
    await assert.rejects(store.eligibleAccount(pool, user, config));
  await assert.rejects(
    store.eligibleAccount(pool, 'owner-a', { ...config, allowedUserIds: [] }),
  );
  await db.query(
    "UPDATE account_profiles SET account_status='suspended' WHERE user_id='owner-a'",
  );
  assert.equal((await rpc('tools/list')).status, 403);
  await assert.rejects(
    store.exchangeToken(
      pool,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh,
        resource: config.resource,
      }),
      config,
    ),
  );
  await db.query(
    "UPDATE account_profiles SET account_status='active' WHERE user_id='owner-a'",
  );
});
test('safe login continuation cannot become an external redirect', () => {
  assert.equal(
    sharedEnquiryReturnTo('/account/ai-connect?state=test'),
    '/account/ai-connect?state=test',
  );
  for (const bad of [
    '//evil.example/account/ai-connect',
    '/account/ai-connect/../../evil',
    '/account/ai-connect#evil',
    'https://evil.example/account/ai-connect',
    '/account/ai-connect\\evil',
  ])
    assert.equal(sharedEnquiryReturnTo(bad), null);
});
test('request body limit and unsupported protocol fail predictably', async () => {
  assert.equal(
    (
      await rpc('tools/list', {}, access, {
        'mcp-protocol-version': 'unsupported',
      })
    ).status,
    400,
  );
  const large = new Request(config.resource, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + access,
    },
    body: 'x'.repeat(20000),
  });
  assert.equal((await handleMcp(large, pool, config)).status, 413);
});
test('official MCP SDK client can initialize, discover and call the private read tools', async () => {
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
  const {
    StreamableHTTPClientTransport,
  } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const client = new Client({ name: 'pilot-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(
    new URL(config.resource),
    {
      requestInit: { headers: { Authorization: 'Bearer ' + access } },
      fetch: async (input, init) =>
        handleMcp(new Request(input, init), pool, config),
    },
  );
  await client.connect(transport);
  const list = await client.listTools();
  assert.equal(list.tools.length, 9);
  const result = await client.callTool({
    name: 'list_assets',
    arguments: { limit: 1 },
  });
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.records[0].id, assetA);
  await client.close();
});
test('consent preserves website login with app cookies and no referrer; app context cannot impersonate it',()=>{
  const Module=require('node:module');
  function compileSource(relative){
    const filename=path.join(__dirname,'..',relative);const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;
    const localRequire=m.require.bind(m);
    m.require=id=>id.startsWith('./lib/')?compileSource(id.slice(2)+'.ts'):localRequire(id);
    m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);return m.exports;
  }
  const {middleware}=compileSource('middleware.ts');const {NextRequest}=require('next/server');
  const cookie='better-auth.session_token=website; aim4price_owner_app=mobile';
  const request=new NextRequest(config.origin+'/api/ai/oauth/authorize',{method:'POST',headers:{Origin:config.origin,Cookie:cookie}});
  assert.equal(middleware(request).headers.get('x-middleware-request-cookie'),cookie);
  const appRequest=new NextRequest(config.origin+'/api/ai/oauth/authorize',{method:'POST',headers:{Origin:config.origin,Cookie:cookie,'x-aim4price-client-realm':'owner'}});
  const response=middleware(appRequest);assert.equal(response.headers.get('x-middleware-request-x-aim4price-app-realm'),'owner');assert.ok(!response.headers.get('x-middleware-request-cookie').includes('better-auth'));
});
