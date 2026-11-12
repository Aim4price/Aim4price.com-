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
  'middleman-account',
  'ai-connection/security',
  'ai-connection/store',
  'ai-connection/data',
  'ai-connection/customer-data',
  'ai-connection/extended-data',
  'asset-usage',
  'ai-connection/rate-limit',
  'ai-connection/mcp',
  'ai-connection/admin-data',
  'ai-connection/audit',
  'ai-connection/navigation',
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
  await db.exec(fs.readFileSync(path.join(__dirname, '../database/migrations/137-ai-provider-admin-reporting.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '../database/migrations/148-ongoing-owner-ai-connections.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '../database/migrations/157-ai-customer-account-scope.sql'), 'utf8'));
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
test('AI service disabled by default and incomplete configuration fails closed', () => {
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
test('ineligible accounts fail closed while eligible owners need no pilot entry', async () => {
  for (const user of ['admin', 'dealer', 'free', 'suspended'])
    await assert.rejects(store.eligibleAccount(pool, user, config));
  assert.equal((await store.eligibleAccount(pool, 'owner-a', { ...config, allowedUserIds: [] })).accountType, 'owner');
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
  assert.equal(middleware(new NextRequest(config.origin+'/account/ai-connect')).headers.get('Referrer-Policy'), 'same-origin');
  assert.equal(middleware(new NextRequest(config.origin+'/api/ai/oauth/authorize')).headers.get('Referrer-Policy'), 'no-referrer');
  for (const origin of [null, 'null', 'https://evil.example']) {
    assert.throws(() => security.requireSameOrigin(new Request(config.origin, { headers: origin === null ? {} : { Origin: origin } }), config), { status: 403 });
  }
  const previousOrigin = process.env.AIM4PRICE_AI_ORIGIN;
  process.env.AIM4PRICE_AI_ORIGIN = config.origin;
  const cookie='better-auth.session_token=website; aim4price_owner_app=mobile';
  const request=new NextRequest(config.origin+'/api/ai/oauth/authorize',{method:'POST',headers:{Origin:config.origin,Cookie:cookie}});
  assert.equal(middleware(request).headers.get('x-middleware-request-cookie'),cookie);
  const proxiedRequest = new NextRequest('http://internal.railway:3000/api/ai/oauth/authorize', {method:'POST',headers:{Origin:config.origin,Cookie:cookie}});
  assert.equal(middleware(proxiedRequest).headers.get('x-middleware-request-cookie'), cookie);
  const foreignRequest = new NextRequest('http://internal.railway:3000/api/ai/oauth/authorize', {method:'POST',headers:{Origin:'https://evil.example',Cookie:cookie}});
  assert.ok(!middleware(foreignRequest).headers.get('x-middleware-request-cookie').includes('better-auth'));
  if (previousOrigin === undefined) delete process.env.AIM4PRICE_AI_ORIGIN;
  else process.env.AIM4PRICE_AI_ORIGIN = previousOrigin;
  const appRequest=new NextRequest(config.origin+'/api/ai/oauth/authorize',{method:'POST',headers:{Origin:config.origin,Cookie:cookie,'x-aim4price-client-realm':'owner'}});
  const response=middleware(appRequest);assert.equal(response.headers.get('x-middleware-request-x-aim4price-app-realm'),'owner');assert.ok(!response.headers.get('x-middleware-request-cookie').includes('better-auth'));
});

test('approval requires explicit terms acknowledgement', () => {
  for (const value of ['', 'terms=no', 'terms=accepted&terms=accepted']) {
    assert.throws(() => security.requireConsentTerms(new URLSearchParams(value)), { code: 'consent_required' });
  }
  assert.doesNotThrow(() => security.requireConsentTerms(new URLSearchParams('terms=accepted')));
});

test('login resumes validated OAuth parameters on the local consent page', () => {
  const params = authParams();
  const login = new URL(security.connectionSignInHref(params, config), config.origin);
  assert.equal(login.pathname, '/auth');
  assert.equal(login.searchParams.get('accountAccess'), 'desktop');
  assert.equal(login.hash, '#login');
  const resume = new URL(login.searchParams.get('returnTo'), config.origin);
  assert.equal(resume.origin, config.origin);
  assert.equal(resume.pathname, '/account/ai-connect');
  assert.deepEqual([...resume.searchParams], [...params]);
  assert.throws(() => security.connectionSignInHref(authParams({redirect_uri:'https://evil.example'}), config));
});

test('expired browser login redirects to login without issuing an authorization code', async () => {
  const Module = require('node:module');
  const filename = path.join(__dirname, '../app/api/ai/oauth/authorize/route.ts');
  const route = new Module(filename, module);
  route.filename = filename;
  route.paths = module.paths;
  let writes = 0;
  route.require = id => {
    if (id.endsWith('/rate-limit')) return { checkSharedRate: async()=>{throw new Error('unexpected rate write');} };
    if (id.endsWith('/security')) return { ...security, connectionConfig: () => config };
    if (id.endsWith('/browser')) return { connectionOwner: async () => { throw new security.ConnectionError(401, 'login_required', 'Sign in first'); } };
    if (id.endsWith('/store')) return { issueCode: async () => { writes++; throw new Error('must not issue a code'); } };
    if (id.endsWith('/db')) return { getDb: () => { writes++; throw new Error('must not access database'); } };
    throw new Error('Unexpected import: ' + id);
  };
  route._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, filename);
  const makeRequest = (params, origin = config.origin) => new Request(config.origin + '/api/ai/oauth/authorize', {
    method:'POST', headers:{Origin:origin}, body:new URLSearchParams({authorization:params.toString(),decision:'allow',terms:'accepted'}),
  });
  const response = await route.exports.POST(makeRequest(authParams()));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), config.origin + security.connectionSignInHref(authParams(), config));
  assert.equal((await route.exports.POST(makeRequest(authParams({redirect_uri:'https://evil.example'})))).status, 400);
  assert.equal((await route.exports.POST(makeRequest(authParams(), 'https://evil.example'))).status, 403);
  assert.equal(writes, 0);
});

test('asset summary matches active register counts and umbrella values across pages', async () => {
  const { runReadTool } = require(path.join(tmp, 'ai-connection/data.js'));
  const { randomUUID } = require('node:crypto');
  const ids = Array.from({length:5}, () => randomUUID());
  const group = randomUUID(), foreignGroup = randomUUID();
  await db.exec(`ALTER TABLE asset_register_items ADD COLUMN lifecycle_state text;
    ALTER TABLE asset_register_items ADD COLUMN value numeric;
    CREATE TABLE asset_groups(id uuid PRIMARY KEY,user_id text,name text,value_mode text);
    CREATE TABLE asset_group_members(group_id uuid,asset_id uuid UNIQUE,role text,counts_toward_total boolean);`);
  try {
    for (const [i, value, state] of [[0,100.6,'active'],[1,999,'active'],[2,250.4,'active'],[3,200600,'disposed'],[4,1,'archived']])
      await db.query(`INSERT INTO asset_register_items(id,user_id,title,selected_value_ex_vat,lifecycle_state)
        VALUES($1,'owner-a',$2,$3,$4)`, [ids[i], 'Summary fixture '+i, value, state]);
    await db.query(`INSERT INTO asset_groups VALUES($1,'owner-a','Own umbrella','included_in_primary'),($2,'owner-b','Foreign umbrella','separate')`,[group,foreignGroup]);
    await db.query(`INSERT INTO asset_group_members VALUES($1,$2,'linked',false),($1,$3,'linked',true),($4,$5,'linked',false)`,[group,ids[1],ids[2],foreignGroup,assetA]);
    await db.query('UPDATE asset_register_items SET value=100.6,selected_value_ex_vat=9999 WHERE id=$1',[ids[0]]);
    const read = args => store.readOnly(pool, reader => runReadTool(reader, 'owner-a', 'list_assets', parseReadArgs('list_assets',args), {name:'Owner',email:'owner@example.com'}));
    const first = await read({limit:1});
    assert.equal(first.records.length,1);
    assert.equal(first.summary.total_assets,4); // original asset + three active fixtures
    assert.equal(first.summary.register_value_ex_vat,'500351'); // 500000 + round(100.6) + round(250.4)
    assert.equal(first.summary.excluded_from_value_count,1);
    assert.equal(first.pagination.totalRecords,4);
    assert.equal(first.pagination.hasMore,true);
    assert.deepEqual((await read({limit:1,offset:3})).summary,first.summary);
    const all = await read({limit:100});
    assert.ok(all.records.every(row => row.lifecycle_state === 'active'));
    assert.ok(!all.records.some(row => [ids[3],ids[4],assetB].includes(row.id)));
    assert.equal(all.records.find(row => row.id===ids[1]).register_value_contribution_ex_vat,'0');
    assert.equal(all.records.find(row => row.id===assetA).group_name,null);
    // Explicit member flags also override separate-value mode, as on the website.
    await db.query(`UPDATE asset_groups SET value_mode='separate' WHERE id=$1`,[group]);
    assert.equal((await read({})).summary.register_value_ex_vat,'500351');
    assert.equal((await read({query:'Summary fixture'})).summary.total_assets,3);
    assert.equal((await read({query:'Summary fixture'})).summary.register_value_ex_vat,'351');
    assert.equal((await read({assetId:ids[3]})).summary.total_assets,0);
    assert.equal((await read({query:'no matching asset'})).summary.register_value_ex_vat,'0');
  } finally {
    await db.query('DELETE FROM asset_register_items WHERE id=ANY($1::uuid[])',[ids]);
    await db.exec('DROP TABLE asset_group_members; DROP TABLE asset_groups; ALTER TABLE asset_register_items DROP COLUMN lifecycle_state; ALTER TABLE asset_register_items DROP COLUMN value');
  }
});

const registryEnv = {
  AIM4PRICE_AI_ENABLED: 'true', AIM4PRICE_AI_ORIGIN: config.origin,
  BETTER_AUTH_SECRET: config.signingSecret, AIM4PRICE_AI_ACCESS_MODE: 'owners',
  AIM4PRICE_AI_CLIENT_ID: 'pilot', AIM4PRICE_AI_CLIENT_SECRET: config.clientSecret,
  AIM4PRICE_AI_REDIRECT_URIS: config.redirectUris[0],
  AIM4PRICE_AI_ADMIN_ENABLED: 'true', AIM4PRICE_AI_ADMIN_CLIENT_ID: 'admin-client',
  AIM4PRICE_AI_ADMIN_CLIENT_SECRET: 'a'.repeat(40), AIM4PRICE_AI_ADMIN_REDIRECT_URIS: 'https://chatgpt.com/admin-callback',
  AIM4PRICE_AI_CLAUDE_SECRET: 'c'.repeat(40),
  AIM4PRICE_AI_CLIENTS_JSON: JSON.stringify([{ id: 'claude', name: 'Claude', audience: 'owner', secretEnv: 'AIM4PRICE_AI_CLAUDE_SECRET', redirectUris: ['https://claude.ai/callback'], origins: ['https://claude.ai'], launchUrl: 'https://claude.ai/' }]),
};
function registryConfig(audience = 'owner') { return security.connectionConfig(registryEnv, audience); }
async function registryGrant(c, user) {
  const params = authParams({client_id: c.clientId,redirect_uri:c.redirectUris[0],resource:c.resource,scope:security.connectionScope(c)});
  const auth = security.authorizationRequest(params,c);
  const proof = security.consentProof(auth,user,require('node:crypto').randomUUID(),c.signingSecret);
  const code = await store.issueCode(pool,user,auth,proof,c);
  const form = new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:auth.redirectUri,code_verifier:'v'.repeat(43),resource:c.resource});
  return {tokens:await store.exchangeToken(pool,form,c),form,auth};
}
async function registryRpc(c, token, name, args = {}, origin) {
  return handleMcp(new Request(c.resource,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...(origin?{Origin:origin}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method:name.startsWith('tools/')?name:'tools/call',params:name.startsWith('tools/')?{}:{name,arguments:args}})}),pool,c);
}
test('multiple providers use independent exact callbacks, credentials and scopes; invalid registry fails closed', () => {
  const c = registryConfig();
  const claude = security.selectClient(c,'claude');
  assert.equal(claude.clientName,'Claude');
  assert.equal(store.authenticateClient(new URLSearchParams({client_id:'claude',client_secret:'c'.repeat(40)}),null,c).clientId,'claude');
  assert.throws(()=>store.authenticateClient(new URLSearchParams({client_id:'claude',client_secret:config.clientSecret}),null,c));
  assert.throws(()=>security.authorizationRequest(authParams({client_id:'claude'}),claude));
  assert.throws(()=>security.selectClient(c,'admin-client'));
  assert.throws(()=>security.connectionConfig({...registryEnv,AIM4PRICE_AI_CLIENTS_JSON:'[{"id":"oops"}]'}));
  const duplicate=JSON.parse(registryEnv.AIM4PRICE_AI_CLIENTS_JSON);duplicate[0].id='pilot';
  assert.throws(()=>security.connectionConfig({...registryEnv,AIM4PRICE_AI_CLIENTS_JSON:JSON.stringify(duplicate)}));
  assert.throws(()=>registryConfig('bad')); // no matching provider
});
test('customer mode admits active Owners and rejects unverified dealers and ineligible accounts',async()=>{
  const c=registryConfig();assert.deepEqual(c.allowedUserIds,[]);
  assert.equal((await store.eligibleAccount(pool,'owner-b',c)).id,'owner-b');
  for(const id of ['admin','dealer','free','suspended','aim4price-assistance-any']) await assert.rejects(store.eligibleAccount(pool,id,c));
  const claude=security.selectClient(c,'claude');const grant=await registryGrant(claude,'owner-b');
  const response=await registryRpc(c,grant.tokens.access_token,'list_assets');
  assert.equal(response.status,200);const result=(await response.json()).result.structuredContent;
  assert.ok(result.records.every(r=>r.id===assetB));
  assert.equal((await registryRpc(c,grant.tokens.access_token,'list_assets',{},'https://chatgpt.com')).status,403);
  assert.equal((await registryRpc(c,grant.tokens.access_token,'list_assets',{},'https://claude.ai')).status,200);
  const removed={...c,clients:c.clients.filter(x=>x.id!=='claude')};
  assert.notEqual((await registryRpc(removed,grant.tokens.access_token,'list_assets')).status,200);
  await assert.rejects(store.exchangeToken(pool,new URLSearchParams({grant_type:'refresh_token',refresh_token:grant.tokens.refresh_token,resource:c.resource}),c));
});
test('admin requires a real verified admin and is isolated from all owner grants, scopes and endpoints',async()=>{
  await db.exec('ALTER TABLE "user" ADD COLUMN "emailVerified" boolean DEFAULT false');
  const c=registryConfig('admin');
  await assert.rejects(store.eligibleAccount(pool,'admin',c));
  await db.query('UPDATE "user" SET "emailVerified"=true WHERE id=$1',['admin']);
  for(const id of ['owner-a','owner-b','dealer','free','suspended','aim4price-assistance-any']) await assert.rejects(store.eligibleAccount(pool,id,c));
  const admin=await registryGrant(c,'admin');const owner=await registryGrant(registryConfig(),'owner-a');
  assert.equal(admin.tokens.scope,security.ADMIN_READ_SCOPE);
  assert.equal((await registryRpc(c,owner.tokens.access_token,'tools/list')).status,401);
  assert.equal((await registryRpc(registryConfig(),admin.tokens.access_token,'tools/list')).status,401);
  const tools=(await (await registryRpc(c,admin.tokens.access_token,'tools/list')).json()).result.tools;
  assert.deepEqual(tools.map(x=>x.name),['admin_asset_summary','admin_list_assets']);
  assert.ok(tools.every(t=>t.annotations.readOnlyHint && t.securitySchemes[0].scopes[0]===security.ADMIN_READ_SCOPE));
  assert.equal((await (await registryRpc(registryConfig(),owner.tokens.access_token,'admin_asset_summary')).json()).result.isError,true);
  const duration=(await db.query('SELECT extract(epoch from(expires_at-created_at)) AS duration FROM ai_connections WHERE access_hash=$1',[security.digest(admin.tokens.access_token)])).rows[0];
  assert.ok(Number(duration.duration)<=86401);
  const before=(await db.query('SELECT count(*) FROM ai_connection_codes')).rows[0].count;
  await assert.rejects(registryGrant(c,'owner-a'));
  assert.equal((await db.query('SELECT count(*) FROM ai_connection_codes')).rows[0].count,before);
  await db.query('UPDATE "user" SET email=$1 WHERE id=$2',['former-admin@example.com','admin']);
  assert.equal((await registryRpc(c,admin.tokens.access_token,'admin_asset_summary')).status,403);
  await assert.rejects(store.exchangeToken(pool,new URLSearchParams({grant_type:'refresh_token',refresh_token:admin.tokens.refresh_token,resource:c.resource}),c));
  await db.query('UPDATE "user" SET email=$1 WHERE id=$2',['aim4price@gmail.com','admin']);
  await db.query("UPDATE account_profiles SET account_status='suspended' WHERE user_id='admin'");
  assert.equal((await registryRpc(c,admin.tokens.access_token,'tools/list')).status,403);
  await db.query("UPDATE account_profiles SET account_status='active' WHERE user_id='admin'");
});
test('admin summaries cover every matching account/page; selected output excludes sensitive fields; reads are audited',async()=>{
  const c=registryConfig('admin');const grant=await registryGrant(c,'admin');
  const call=async(name,args)=>{const r=await registryRpc(c,grant.tokens.access_token,name,args);assert.equal(r.status,200);const body=await r.json();assert.equal(body.result.isError,false);return body.result.structuredContent;};
  const summary=await call('admin_asset_summary',{groupBy:'account',limit:1});
  assert.equal(summary.summary.total_assets,2);assert.equal(summary.summary.total_accounts,2);
  assert.equal(summary.summary.register_value_ex_vat,'1499999');
  assert.equal(summary.records.length,1);assert.equal(summary.pagination.hasMore,true);
  assert.deepEqual((await call('admin_asset_summary',{groupBy:'account',offset:1,limit:1})).summary,summary.summary);
  const filtered=await call('admin_list_assets',{accountId:'owner-a'});
  assert.equal(filtered.records[0].id,assetA);assert.equal(filtered.summary.total_assets,1);
  assert.equal((await call('admin_list_assets',{brand:'Other'})).records[0].id,assetB);
  assert.equal((await call('admin_list_assets',{query:"' OR true --"})).summary.total_assets,0);
  const all=await call('admin_list_assets',{});
  for(const row of all.records)for(const field of ['email','password','specs_json','last_known_lat','last_known_lng','photo_urls','user_id']) assert.ok(!(field in row));
  for(const [name,args] of [['delete_asset',{}],['admin_asset_summary',{sql:'DELETE FROM asset_register_items'}],['admin_list_assets',{limit:101}],['admin_asset_summary',{groupBy:'email'}]]) {
    const result=await(await registryRpc(c,grant.tokens.access_token,name,args)).json();assert.equal(result.result.isError,true);
  }
  const logs=(await db.query('SELECT tool,outcome FROM ai_connection_audit WHERE connection_id=(SELECT id FROM ai_connections WHERE access_hash=$1)',[security.digest(grant.tokens.access_token)])).rows;
  assert.ok(logs.some(l=>l.outcome==='completed'));assert.ok(logs.some(l=>l.outcome==='denied'));assert.ok(logs.every(l=>['admin_asset_summary','admin_list_assets','unrecognised_tool'].includes(l.tool)));
  assert.equal((await db.query('SELECT count(*) FROM asset_register_items')).rows[0].count,2);
  const failingPool={...pool,query:async(sql,args)=>{if(sql.includes('ai_connection_audit'))throw new Error('audit unavailable');return pool.query(sql,args);}};
  const response=await handleMcp(new Request(c.resource,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+grant.tokens.access_token},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'admin_asset_summary',arguments:{}}})}),failingPool,c);
  assert.equal(response.status,503);assert.ok(!(await response.text()).includes('Private B'));
});
test('admin totals honour umbrella exclusions, missing values and lifecycle independently of grouping',async()=>{
  const {parseAdminArgs,runAdminTool}=require(path.join(tmp,'ai-connection/admin-data.js'));
  const id='99999999-1111-4111-8111-111111111111';
  await db.exec(`ALTER TABLE asset_register_items ADD COLUMN lifecycle_state text;
    CREATE TABLE asset_groups(id uuid PRIMARY KEY,user_id text,name text,value_mode text);
    CREATE TABLE asset_group_members(group_id uuid,asset_id uuid UNIQUE,role text,counts_toward_total boolean);
    INSERT INTO asset_groups VALUES('${id}','owner-a','Umbrella','included_in_primary');
    INSERT INTO asset_group_members VALUES('${id}','${assetA}','linked',false);`);
  const read=(args)=>store.readOnly(pool,r=>runAdminTool(r,'admin_asset_summary',parseAdminArgs('admin_asset_summary',args)));
  try{
    let data=await read({});assert.equal(data.summary.total_assets,2);assert.equal(data.summary.excluded_from_value_count,1);assert.equal(data.summary.register_value_ex_vat,'999999');
    await db.query('UPDATE asset_register_items SET selected_value_ex_vat=NULL,lifecycle_state=$1 WHERE id=$2',['disposed',assetB]);
    data=await read({});assert.equal(data.summary.total_assets,1);
    data=await read({lifecycle:'all'});assert.equal(data.summary.total_assets,2);assert.equal(data.summary.missing_value_count,1);
    await db.query('UPDATE asset_groups SET user_id=$1',['owner-b']);
    data=await read({});assert.equal(data.summary.excluded_from_value_count,0);assert.equal(data.summary.register_value_ex_vat,'500000');
  } finally {
    await db.query('UPDATE asset_register_items SET selected_value_ex_vat=999999 WHERE id=$1',[assetB]);
    await db.exec('DROP TABLE asset_group_members; DROP TABLE asset_groups; ALTER TABLE asset_register_items DROP COLUMN lifecycle_state');
  }
});
test('shared rate limit counts independent server calls and stores hashed bounded identities',async()=>{
  const {checkSharedRate}=require(path.join(tmp,'ai-connection/rate-limit.js'));
  await checkSharedRate(pool,'fixture-user',2);await checkSharedRate({...pool},'fixture-user',2);
  await assert.rejects(checkSharedRate(pool,'fixture-user',2),{status:429});
  const row=(await db.query('SELECT * FROM ai_connection_rate_limits WHERE bucket=$1',[security.digest('fixture-user')])).rows[0];assert.equal(row.requests,3);assert.notEqual(row.bucket,'fixture-user');
  await db.query("UPDATE ai_connection_rate_limits SET window_start=now()-interval '2 minutes' WHERE bucket=$1",[security.digest('fixture-user')]);
  await checkSharedRate(pool,'fixture-user',2);
  assert.equal((await db.query('SELECT requests FROM ai_connection_rate_limits WHERE bucket=$1',[security.digest('fixture-user')])).rows[0].requests,1);
});

test('admin refresh remains admin-only, rotates, and disconnect stops reporting; shared limiter is enforced by MCP',async()=>{
  const c={...registryConfig('admin'),sharedLimits:true};const grant=await registryGrant(c,'admin');
  const form=new URLSearchParams({grant_type:'refresh_token',refresh_token:grant.tokens.refresh_token,resource:c.resource});
  const next=await store.exchangeToken(pool,form,c);
  assert.equal(next.scope,security.ADMIN_READ_SCOPE);
  assert.equal((await registryRpc(c,grant.tokens.access_token,'tools/list')).status,401);
  assert.equal((await registryRpc(c,next.access_token,'tools/list')).status,200);
  const key=security.digest('mcp:admin');
  await db.query("UPDATE ai_connection_rate_limits SET requests=60,window_start=date_trunc('minute',now()) WHERE bucket=$1",[key]);
  assert.equal((await registryRpc(c,next.access_token,'tools/list')).status,429);
  await db.query('DELETE FROM ai_connection_rate_limits WHERE bucket=$1',[key]);
  await db.query('UPDATE ai_connections SET revoked_at=now() WHERE access_hash=$1',[security.digest(next.access_token)]);
  assert.equal((await registryRpc(c,next.access_token,'tools/list')).status,401);
  await assert.rejects(store.exchangeToken(pool,new URLSearchParams({grant_type:'refresh_token',refresh_token:next.refresh_token,resource:c.resource}),c));
});
test('provider cannot redeem another provider authorization code; consent cannot change audience or provider',async()=>{
  const first=registryConfig();const second=security.selectClient(first,'claude');
  const auth=security.authorizationRequest(authParams(),first);
  const proof=security.consentProof(auth,'owner-a','another-session',first.signingSecret);
  const code=await store.issueCode(pool,'owner-a',auth,proof,first);
  const form=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:auth.redirectUri,code_verifier:'v'.repeat(43),resource:first.resource});
  await assert.rejects(store.exchangeToken(pool,form,second));
  assert.throws(()=>security.verifyConsent(proof,'owner-a','another-session',second));
  assert.throws(()=>security.verifyConsent(proof,'owner-a','another-session',registryConfig('admin')));
  assert.ok((await store.exchangeToken(pool,form,first)).access_token);
});
test('security metadata migration is repeatable and preserves existing grants',async()=>{
  const before=(await db.query('SELECT count(*) FROM ai_connections')).rows[0].count;
  await db.exec(fs.readFileSync(path.join(__dirname,'../database/migrations/137-ai-provider-admin-reporting.sql'),'utf8'));
  assert.equal((await db.query('SELECT count(*) FROM ai_connections')).rows[0].count,before);
  await assert.rejects(db.query("UPDATE ai_connections SET scope='aim4price:write'"));
});


test('admin sign-in preserves only a local AI consent continuation',()=>{
  const {adminAiReturnTo}=require(path.join(tmp,'ai-connection/navigation.js'));
  const c=registryConfig('admin');
  const params=authParams({client_id:c.clientId,redirect_uri:c.redirectUris[0],resource:c.resource,scope:security.ADMIN_READ_SCOPE});
  const login=new URL(security.connectionSignInHref(params,c),c.origin);
  const next=adminAiReturnTo(login.searchParams.get('returnTo'));
  assert.equal(new URL(next,c.origin).pathname,'/admin/ai-connect');
  assert.deepEqual([...new URL(next,c.origin).searchParams],[...params]);
  for(const value of ['//evil.test/admin/ai-connect','https://evil.test/admin/ai-connect','/admin/ai-connect/../../evil','/admin/ai-connect#bad','/admin/ai-connect-extra','/admin/other',null])assert.equal(adminAiReturnTo(value),null);
  const source=fs.readFileSync(path.join(__dirname,'../app/auth/auth-client.tsx'),'utf8');
  assert.ok(source.includes('adminAiReturnTo(preferredPath ?? getSafeReturnTo())'));
});

test('ongoing owner approval renews beyond 30 days with short-lived tokens', async () => {
  const { tokens } = await createGrant();
  const hash = security.digest(tokens.access_token);
  const grant = (await db.query('SELECT expires_at FROM ai_connections WHERE access_hash=$1', [hash])).rows[0];
  assert.equal(grant.expires_at, null);
  assert.equal(tokens.expires_in, 3600);
  await db.query("UPDATE ai_connections SET created_at=now()-interval '365 days',access_expires_at=now()-interval '1 second' WHERE access_hash=$1", [hash]);
  assert.equal((await rpc('tools/list', {}, tokens.access_token)).status, 401);
  const renewed = await store.exchangeToken(pool, new URLSearchParams({
    grant_type: 'refresh_token', refresh_token: tokens.refresh_token, resource: config.resource,
  }), config);
  assert.equal(renewed.expires_in, 3600);
  assert.notEqual(renewed.refresh_token, tokens.refresh_token);
  assert.equal((await rpc('tools/list', {}, renewed.access_token)).status, 200);
  assert.equal((await db.query('SELECT expires_at FROM ai_connections WHERE access_hash=$1', [security.digest(renewed.access_token)])).rows[0].expires_at, null);
});

test('legacy fixed-term approvals retain expiry on renewal and cannot renew after expiry', async () => {
  const { tokens } = await createGrant();
  await db.query("UPDATE ai_connections SET expires_at=now()+interval '20 minutes' WHERE access_hash=$1", [security.digest(tokens.access_token)]);
  const before = (await db.query('SELECT expires_at FROM ai_connections WHERE access_hash=$1', [security.digest(tokens.access_token)])).rows[0].expires_at;
  const renewed = await store.exchangeToken(pool, new URLSearchParams({
    grant_type: 'refresh_token', refresh_token: tokens.refresh_token, resource: config.resource,
  }), config);
  assert.ok(renewed.expires_in > 0 && renewed.expires_in <= 1200);
  const after = (await db.query('SELECT expires_at FROM ai_connections WHERE access_hash=$1', [security.digest(renewed.access_token)])).rows[0].expires_at;
  assert.equal(new Date(before).getTime(), new Date(after).getTime());
  await db.query("UPDATE ai_connections SET expires_at=now()-interval '1 second' WHERE access_hash=$1", [security.digest(renewed.access_token)]);
  assert.equal((await rpc('tools/list', {}, renewed.access_token)).status, 401);
  await assert.rejects(store.exchangeToken(pool, new URLSearchParams({
    grant_type: 'refresh_token', refresh_token: renewed.refresh_token, resource: config.resource,
  }), config), /expired or was disconnected/);
});

// Customer pilot uses real SQL and the same OAuth/MCP path as production.
test('Dealer and Business pilot enforces tool, asset, section and live membership boundaries', async () => {
  config.customerAccountTypes = ['owner', 'dealer', 'business'];
  config.allowedUserIds.push('business');
  try {
    await db.exec(`UPDATE "user" SET "emailVerified"=true WHERE id='dealer';
      INSERT INTO "user"(id,name,email,"emailVerified") VALUES('business','Business','business@example.com',true);
      INSERT INTO account_profiles VALUES('business','business','active','Business');
      CREATE TABLE business_workspaces(id uuid PRIMARY KEY,owner_user_id text);
      CREATE TABLE business_workspace_members(business_id uuid,user_id text,role text,status text);
      CREATE TABLE business_verified_identities(email text,business_id uuid,user_id text);
      CREATE TABLE guest_businesses(email text,suspended boolean);
      INSERT INTO business_workspaces VALUES('${assetB}','business');
      INSERT INTO business_workspace_members VALUES('${assetB}','business','owner','active');
      INSERT INTO business_verified_identities VALUES('business@example.com','${assetB}','business');
      CREATE TABLE asset_share_links(token text,user_id text,asset_ids uuid[],umbrella_id uuid,lead_details jsonb,display_options jsonb,created_at timestamptz DEFAULT now(),revoked_at timestamptz);
      INSERT INTO asset_share_links(token,user_id,asset_ids,lead_details,display_options) VALUES
        ('targeted','owner-a',ARRAY['${assetA}']::uuid[],'{"recipientEmail":"business@example.com","recipientUserId":"business","request":"Review maintenance","permissions":{"maintenanceReports":true}}','{"valuation":false}'),
        ('wrong-user','owner-a',ARRAY['${assetA}']::uuid[],'{"recipientEmail":"business@example.com","recipientUserId":"someone-else"}','{}'),
        ('unbound','owner-a',ARRAY['${assetA}']::uuid[],'{"accessMode":"signed-in"}','{}'),
        ('wrong-owner','owner-b',ARRAY['${assetA}']::uuid[],'{"recipientEmail":"business@example.com"}','{}');
      CREATE TABLE dealer_maintenance_access(id uuid,owner_user_id text,dealer_user_id text,asset_register_item_id uuid,is_active boolean,revoked_at timestamptz,can_view_maintenance_reports boolean,can_view_logged_problems boolean,can_view_cost_of_ownership boolean);
      INSERT INTO dealer_maintenance_access VALUES('${assetA}','owner-a','dealer','${assetA}',true,NULL,true,false,false);`);
    const business = (await createGrant('business')).tokens;
    const dealer = (await createGrant('dealer')).tokens;
    async function partnerCall(token, name, args = {}) {
      const response = await rpc('tools/call', {name, arguments:args}, token);
      assert.equal(response.status, 200);
      return (await response.json()).result;
    }
    const listed = (await (await rpc('tools/list', {}, business.access_token)).json()).result.tools.map(t=>t.name);
    assert.deepEqual(listed, ['account_profile','list_shared_enquiries','read_shared_asset']);
    assert.equal((await partnerCall(business.access_token,'read_costs',{from:'2026-01-01',to:'2026-12-31'})).isError,true);
    assert.equal((await partnerCall(business.access_token,'list_assets')).isError,true);
    const inbox = (await partnerCall(business.access_token,'list_shared_enquiries')).structuredContent;
    assert.equal(inbox.pagination.totalRecords,1);
    assert.equal(inbox.records[0].request,'Review maintenance');
    assert.equal(JSON.stringify(inbox).includes('targeted'),false);
    const enquiryId = inbox.records[0].enquiry_id;
    const detail = (await partnerCall(business.access_token,'read_shared_asset',{enquiryId,assetId:assetA,section:'asset'})).structuredContent;
    assert.equal(detail.record.saved_value_ex_vat,null);
    assert.equal((await partnerCall(business.access_token,'read_shared_asset',{enquiryId,assetId:assetB,section:'asset'})).isError,true);
    assert.equal((await partnerCall(business.access_token,'read_shared_asset',{enquiryId,assetId:assetA,section:'costs',from:'2026-09-01',to:'2026-09-30'})).isError,true);
    const maintenance = await partnerCall(business.access_token,'read_shared_asset',{enquiryId,assetId:assetA,section:'maintenance'});
    assert.equal(maintenance.isError,false);
    assert.ok(maintenance.structuredContent.records.every(r=>r.asset_id===assetA));
    assert.equal((await partnerCall(business.access_token,'read_shared_asset',{enquiryId,assetId:assetA,section:'maintenance',ownerId:'owner-b'})).isError,true);
    await db.exec(`UPDATE asset_share_links SET lead_details=jsonb_set(lead_details,'{permissions,maintenanceReports}','false') WHERE token='targeted'`);
    assert.equal((await partnerCall(business.access_token,'read_shared_asset',{enquiryId,assetId:assetA,section:'maintenance'})).isError,true);
    await db.exec(`UPDATE asset_share_links SET lead_details=jsonb_set(lead_details,'{permissions,costOfOwnership}','true') WHERE token='targeted'`);
    const costArgs={enquiryId,assetId:assetA,section:'costs',from:'2026-09-01',to:'2026-09-30',limit:1};
    const sharedCosts=(await partnerCall(business.access_token,'read_shared_asset',costArgs)).structuredContent;
    const {runReadTool,parseReadArgs}=require(path.join(tmp,'ai-connection/data.js'));
    const ownerCosts=await runReadTool(db,'owner-a','read_costs',parseReadArgs('read_costs',{assetId:assetA,from:costArgs.from,to:costArgs.to,limit:100}),{name:'Owner',email:''});
    assert.deepEqual(sharedCosts.summary,ownerCosts.summary);
    assert.ok(sharedCosts.records.every(r=>r.asset_id===assetA));
    await db.query('UPDATE asset_register_items SET user_id=$1 WHERE id=$2',['owner-b',assetA]);
    assert.equal((await partnerCall(business.access_token,'read_shared_asset',{enquiryId,assetId:assetA,section:'asset'})).isError,true);
    await db.query('UPDATE asset_register_items SET user_id=$1 WHERE id=$2',['owner-a',assetA]);
    await db.exec(`UPDATE asset_share_links SET revoked_at=now() WHERE token='targeted'`);
    assert.equal((await partnerCall(business.access_token,'read_shared_asset',{enquiryId,assetId:assetA,section:'asset'})).isError,true);
    assert.equal((await partnerCall(business.access_token,'list_shared_enquiries')).structuredContent.pagination.totalRecords,0);
    const client = (await partnerCall(dealer.access_token,'list_client_assets')).structuredContent;
    assert.equal(client.records.length,1);
    const clientArgs = {accessId:assetA,assetId:assetA,section:'maintenance'};
    assert.equal((await partnerCall(dealer.access_token,'read_client_asset',clientArgs)).isError,false);
    assert.equal((await partnerCall(dealer.access_token,'read_client_asset',{...clientArgs,section:'costs',from:'2026-09-01',to:'2026-09-30'})).isError,true);
    assert.equal((await partnerCall(dealer.access_token,'read_client_asset',{...clientArgs,assetId:assetB})).isError,true);
    await db.exec('UPDATE dealer_maintenance_access SET is_active=false');
    assert.equal((await partnerCall(dealer.access_token,'read_client_asset',clientArgs)).isError,true);
    assert.equal((await partnerCall(dealer.access_token,'read_parts')).structuredContent.available,false);
    await db.exec("UPDATE business_workspace_members SET status='revoked'");
    assert.equal((await rpc('tools/list',{},business.access_token)).status,403);
    await assert.rejects(store.exchangeToken(pool,new URLSearchParams({grant_type:'refresh_token',refresh_token:business.refresh_token,resource:config.resource}),config));
    await db.exec("UPDATE business_workspace_members SET status='active'");
    await db.exec("UPDATE account_profiles SET account_type='owner' WHERE user_id='business'");
    assert.equal((await rpc('tools/list',{},business.access_token)).status,401);
    await assert.rejects(store.exchangeToken(pool,new URLSearchParams({grant_type:'refresh_token',refresh_token:business.refresh_token,resource:config.resource}),config));
    await db.exec("UPDATE account_profiles SET account_type='business' WHERE user_id='business'");
    await db.exec("INSERT INTO guest_businesses VALUES('business@example.com',true)");
    assert.equal((await rpc('tools/list',{},business.access_token)).status,403);
    await db.exec("DELETE FROM guest_businesses");
    await db.query('UPDATE ai_connections SET revoked_at=now() WHERE access_hash=$1',[security.digest(dealer.access_token)]);
    assert.equal((await rpc('tools/list',{},dealer.access_token)).status,401);
  } finally {
    delete config.customerAccountTypes;
    config.allowedUserIds = config.allowedUserIds.filter(id=>id!=='business');
  }
});

test('customer scope migration is repeatable and preserves Owner and Admin grants', async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../database/migrations/157-ai-customer-account-scope.sql'),'utf8');
  const before = (await db.query('SELECT id,account_type FROM ai_connections ORDER BY id')).rows;
  await db.exec(sql); await db.exec(sql);
  assert.deepEqual((await db.query('SELECT id,account_type FROM ai_connections ORDER BY id')).rows,before);
});

test('parts listings respect memberships, hidden suppliers, archives and pagination', async () => {
  const { runCustomerTool } = require(path.join(tmp, 'ai-connection/customer-data.js'));
  const dealer = {id:'dealer',name:'Dealer',email:'dealer@example.com',accountType:'dealer'};
  await db.exec(`CREATE TABLE parts_networks(id uuid,name text,created_by text,list_mode boolean,archived boolean);
    CREATE TABLE parts_network_members(network_id uuid,dealer_id text,status text,visible boolean,business_name text,vat_included boolean,uploaded_at timestamptz);
    CREATE TABLE parts_network_rows(network_id uuid,dealer_id text,part_number text,part_key text,description text,brand text,quantity integer,price numeric);
    INSERT INTO parts_networks VALUES('${assetA}','Visible network','supplier',false,false),('${assetB}','Private network','supplier',false,false);
    INSERT INTO parts_network_members VALUES('${assetA}','dealer','active',true,'Dealer',true,now()),('${assetA}','supplier','active',true,'Supplier',false,now()),('${assetB}','supplier','active',true,'Supplier',false,now());
    INSERT INTO parts_network_rows VALUES('${assetA}','supplier','0001.1','0001.1','Part','Brand',5,100),('${assetA}','supplier','0002','0002','Other part','Brand',1,200),('${assetB}','supplier','0001.1','0001.1','Hidden','Brand',99,1);`);
  let result = await runCustomerTool(db,dealer,'read_parts',{limit:1});
  assert.equal(result.pagination.totalRecords,2); assert.equal(result.pagination.hasMore,true);
  result = await runCustomerTool(db,dealer,'read_parts',{query:'0001.1'});
  assert.equal(result.records.length,1); assert.equal(result.records[0].quantity,5);
  assert.equal(result.records[0].vat_included,false);
  await db.exec("UPDATE parts_network_members SET visible=false WHERE dealer_id='supplier'");
  assert.equal((await runCustomerTool(db,dealer,'read_parts',{})).pagination.totalRecords,0);
  await db.exec("UPDATE parts_network_members SET visible=true; UPDATE parts_network_members SET status='suspended' WHERE dealer_id='dealer'");
  assert.equal((await runCustomerTool(db,dealer,'read_parts',{})).pagination.totalRecords,0);
  await db.exec("UPDATE parts_network_members SET status='active'; UPDATE parts_networks SET archived=true");
  assert.equal((await runCustomerTool(db,dealer,'read_parts',{})).pagination.totalRecords,0);
});

test('consent and authorization codes cannot cross account type changes', async () => {
  config.customerAccountTypes = ['owner','dealer'];
  try {
    const auth = security.authorizationRequest(authParams(),config);
    const now = Date.now();
    const proof = security.consentProof(auth,'dealer','session',config.signingSecret,now,'dealer');
    assert.throws(()=>security.verifyConsent(proof,'dealer','session',config,now,'owner'));
    assert.equal(security.verifyConsent(proof,'dealer','session',config,now,'dealer').clientId,config.clientId);
    const code = await store.issueCode(pool,'dealer',auth,proof,config,'dealer');
    await db.exec("UPDATE account_profiles SET account_type='owner' WHERE user_id='dealer'");
    await assert.rejects(store.exchangeToken(pool,new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:auth.redirectUri,code_verifier:'v'.repeat(43),resource:config.resource}),config));
    await assert.rejects(store.issueCode(pool,'dealer',auth,proof+'other',config,'dealer'));
  } finally {
    await db.exec("UPDATE account_profiles SET account_type='dealer' WHERE user_id='dealer'");
    delete config.customerAccountTypes;
  }
});


test('legacy pilot settings cannot block eligible Dealer and Business accounts', async () => {
  const c = security.connectionConfig({...registryEnv,
    AIM4PRICE_AI_ACCESS_MODE:'pilot', AIM4PRICE_AI_ALLOWED_USER_IDS:'', AIM4PRICE_AI_ACCOUNT_TYPES:'owner'});
  assert.deepEqual(c.customerAccountTypes,['owner','dealer','business']);
  // Also exercise old in-memory configuration: neither type nor ID allowlists grant or deny eligibility.
  const legacy = {...c,accessMode:'pilot',allowedUserIds:[],customerAccountTypes:['owner']};
  for (const user of ['owner-a','dealer','business']) {
    const grant = await registryGrant(legacy,user);
    const response = await registryRpc(legacy,grant.tokens.access_token,'tools/list');
    assert.equal(response.status,200,user);
    const names=(await response.json()).result.tools.map(t=>t.name);
    assert.equal(names.includes('list_assets'),user!=='business');
    assert.equal(names.includes('read_shared_asset'),user!=='owner-a');
  }
  await assert.rejects(store.eligibleAccount(pool,'free',legacy),{code:'desktop_required'});
  await assert.rejects(store.eligibleAccount(pool,'suspended',legacy),{code:'inactive_account'});
  await assert.rejects(store.eligibleAccount(pool,'admin',legacy),{code:'admin_connection_required'});
  await db.exec(`UPDATE "user" SET "emailVerified"=false WHERE id='dealer'`);
  try { await assert.rejects(store.eligibleAccount(pool,'dealer',legacy),{code:'verification_required'}); }
  finally { await db.exec(`UPDATE "user" SET "emailVerified"=true WHERE id='dealer'`); }
});

test('cost summaries disclose missing values and undated records without leaking other accounts', async () => {
  const {runReadTool,parseReadArgs}=require(path.join(tmp,'ai-connection/data.js'));
  const ids=['aa000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000003'];
  try {
    await db.query(`INSERT INTO asset_invoices(id,user_id,asset_register_item_id,invoice_date,total_inc_vat,vat_amount) VALUES
      ($1,'owner-a',$4,'2026-09-05',NULL,NULL),($2,'owner-a',$4,NULL,500,0),($3,'owner-b',$5,NULL,999999,NULL)`, [...ids,assetA,assetB]);
    const data=await runReadTool(db,'owner-a','read_costs',parseReadArgs('read_costs',{from:'2026-09-01',to:'2026-09-30',assetId:assetA,limit:1}),{name:'Owner',email:''});
    assert.equal(Number(data.summary.total_inc_vat),345);
    assert.equal(Number(data.summary.missing_amount_count),1);
    assert.equal(Number(data.summary.missing_vat_count),1);
    assert.equal(data.summary.excludedUndatedRecords,1);
    assert.equal(data.records.length,1);
    assert.equal(data.pagination.totalRecords,3);
    assert.equal(data.pagination.hasMore,true);
    assert.ok(!JSON.stringify(data).includes('999999'));
  } finally { await db.query('DELETE FROM asset_invoices WHERE id=ANY($1::uuid[])',[ids]); }
});

test('disconnect with a rotated refresh token revokes only its provider grant', async () => {
  const first=(await createGrant()).tokens;
  const other=(await createGrant()).tokens;
  const renewed=await store.exchangeToken(pool,new URLSearchParams({grant_type:'refresh_token',refresh_token:first.refresh_token,resource:config.resource}),config);
  await store.revokeToken(db,first.refresh_token,{...config,clientId:'different-provider'});
  assert.equal((await rpc('tools/list',{},renewed.access_token)).status,200);
  await store.revokeToken(db,first.refresh_token,config);
  assert.equal((await rpc('tools/list',{},renewed.access_token)).status,401);
  assert.equal((await rpc('tools/list',{},other.access_token)).status,200);
  await assert.rejects(store.exchangeToken(pool,new URLSearchParams({grant_type:'refresh_token',refresh_token:renewed.refresh_token,resource:config.resource}),config));
  await store.revokeToken(db,first.refresh_token,config); // idempotent
});

test('Dealer and Business ongoing grants renew and suspension blocks both reads and refresh', async () => {
  for(const user of ['dealer','business']) {
    const tokens=(await createGrant(user)).tokens;
    await db.query("UPDATE ai_connections SET created_at=now()-interval '365 days',access_expires_at=now()-interval '1 second' WHERE access_hash=$1",[security.digest(tokens.access_token)]);
    assert.equal((await rpc('tools/list',{},tokens.access_token)).status,401);
    const renewed=await store.exchangeToken(pool,new URLSearchParams({grant_type:'refresh_token',refresh_token:tokens.refresh_token,resource:config.resource}),config);
    assert.equal(renewed.expires_in,3600);
    assert.equal((await rpc('tools/list',{},renewed.access_token)).status,200);
    try {
      await db.query("UPDATE account_profiles SET account_status='suspended' WHERE user_id=$1",[user]);
      assert.equal((await rpc('tools/list',{},renewed.access_token)).status,403);
      await assert.rejects(store.exchangeToken(pool,new URLSearchParams({grant_type:'refresh_token',refresh_token:renewed.refresh_token,resource:config.resource}),config));
    } finally { await db.query("UPDATE account_profiles SET account_status='active' WHERE user_id=$1",[user]); }
  }
});

test('malformed dealer access IDs return a tool error rather than a database failure', async () => {
  const tokens=(await createGrant('dealer')).tokens;
  const response=await rpc('tools/call',{name:'read_client_asset',arguments:{accessId:'aaaaaaaa----------------------------',assetId:assetA,section:'asset'}},tokens.access_token);
  assert.equal(response.status,200);
  assert.equal((await response.json()).result.isError,true);
});

test('budget with missing invoice amounts reports incomplete instead of on track', async () => {
  const {runReadTool,parseReadArgs}=require(path.join(tmp,'ai-connection/data.js'));
  const id='aa000000-0000-4000-8000-000000000004';
  try {
    await db.query(`INSERT INTO asset_invoices(id,user_id,asset_register_item_id,invoice_date,total_inc_vat) VALUES($1,'owner-a',$2,(now() AT TIME ZONE 'Africa/Johannesburg')::date,NULL)`,[id,assetA]);
    const data=await runReadTool(db,'owner-a','read_budgets',parseReadArgs('read_budgets',{}),{name:'Owner',email:''});
    assert.ok(data.records.length>0);
    assert.ok(data.records.every(r=>r.status==='incomplete' && Number(r.missing_amount_count)===1));
  } finally {await db.query('DELETE FROM asset_invoices WHERE id=$1',[id]);}
});
