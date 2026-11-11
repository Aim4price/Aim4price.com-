/* Disposable database and real Next.js app. Never connects to a supplied database. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID, randomBytes, scryptSync } = require('node:crypto');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');
const load = require('../../tests/helpers/load-ts.cjs');
const root = path.resolve(__dirname, '../..');
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function startEnvironment() {
  if (fs.readdirSync(root).some(name => /^\.env(?:\.|$)/.test(name) && !/example|sample/.test(name)))
    throw Error('Run QA in a clean checkout without .env files. Production configuration must not enter QA.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aim4price-manager-qa-'));
  const db = await PGlite.create({ extensions: { pgcrypto } });
  const query = async (sql, args) => args ? db.query(sql, args) : (await db.exec(sql)).at(-1);
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const overrides = { './db': { getDb: () => pool }, './auth-session': {}, 'next/headers': {}, './auth': {} };
  await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,name text,email text UNIQUE,"emailVerified" boolean DEFAULT true,image text,"createdAt" timestamptz DEFAULT now(),"updatedAt" timestamptz DEFAULT now());
  CREATE TABLE asset_register_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text,register_id uuid,kind text,title text,value numeric,hours numeric,year_model integer,brand_name text,model_name text,condition text,serial_number text,selected_method text DEFAULT 'manual',selected_value_ex_vat numeric,replacement_price_ex_vat numeric,insured_value_ex_vat numeric,is_insured boolean DEFAULT false,is_financed boolean DEFAULT false,is_licensed boolean DEFAULT false,valuation_run_id bigint,specs_json jsonb DEFAULT '{}',photos jsonb DEFAULT '[]',documents jsonb DEFAULT '[]',public_asset_code text,plate_label text,qr_status text DEFAULT 'active',last_known_lat numeric,last_known_lng numeric,last_known_location_text text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
  CREATE TABLE equipment_families(id bigint PRIMARY KEY,sector_id bigint,family_key text,family_label text,usage_metric_type text,is_propelled boolean);
  CREATE TABLE equipment_models(id bigint PRIMARY KEY);
  CREATE TABLE valuation_runs(id bigserial PRIMARY KEY,user_id text,equipment_family_id bigint,typed_model_name text,normalized_typed_model_name text,brand_name text,model_name text,specs_json jsonb DEFAULT '{}',created_at timestamptz DEFAULT now());`);
  for (const [file, fn] of [['asset-registers', 'ensureAssetRegisterTables'], ['account-profile', 'ensureAccountProfileColumns'], ['owner-app', 'ensureOwnerAppTables'], ['fuel-ledger', 'ensureFuelLedgerTables']])
    await load(path.join(root, 'lib', file + '.ts'), overrides)[fn]();
  const owner = 'manager-qa-owner', register = randomUUID();
  await db.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)', [owner, 'Synthetic QA Owner', 'owner@manager-qa.invalid']);
  await db.query("INSERT INTO account_profiles(user_id,display_name,business_name,account_type,account_status) VALUES($1,'Synthetic QA Owner','Manager QA Farm','owner','active')", [owner]);
  await db.query("INSERT INTO asset_registers(id,user_id,business_name,is_primary,is_selected) VALUES($1,$2,'QA Register',true,true)", [register, owner]);
  const assets = {};
  for (const [name, lifecycle, qr] of [['tractor','active','active'],['excluded','active','active'],['retired','retired','retired'],['deleted','active','deleted']]) {
    const id = randomUUID(); assets[name] = id;
    await db.query(`INSERT INTO asset_register_items(id,user_id,register_id,kind,title,value,selected_value_ex_vat,replacement_price_ex_vat,hours,year_model,brand_name,model_name,condition,serial_number,specs_json,lifecycle_state,qr_status,public_asset_code)
      VALUES($1,$2,$3,'tractor',$4,987654,987654,1234567,1400,2021,'QA','Tractor','good',$5,'{"usageMetric":"hours"}',$6,$7,$8)`,
      [id,owner,register,'QA '+name+' tractor','QA-'+name,lifecycle,qr,'QA-'+name.toUpperCase()]);
  }
  const { TEAM_TEMPLATES } = load(path.join(root, 'lib/team-access-policy.ts'));
  const accounts = {};
  for (const [role, template] of Object.entries(TEAM_TEMPLATES)) {
    const id = randomUUID(), username = role + '@manager-qa', password = randomBytes(24).toString('base64url');
    const salt = randomBytes(18).toString('base64url');
    const hash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString('base64url')}`;
    await db.query(`INSERT INTO owner_app_users(id,parent_owner_user_id,display_name,username,username_normalized,password_hash,access_role,permissions)
      VALUES($1,$2,$3,$4,$4,$5,$6,$7)`, [id,owner,'QA '+role,username,hash,role,JSON.stringify(template.permissions)]);
    await db.query("INSERT INTO owner_app_user_access_settings(owner_app_user_id,asset_scope) VALUES($1,'selected')", [id]);
    await db.query('INSERT INTO owner_app_user_asset_access(owner_app_user_id,asset_id) VALUES($1,$2)', [id,assets.tractor]);
    accounts[role] = { id, username, password, permissions: template.permissions };
  }
  const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: await freePort(), maxConnections: 20 });
  await socket.start();
  const databaseUrl = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres`;
  const port = Number(process.env.MANAGER_QA_PORT || await freePort());
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid QA port');
  const origin = `http://127.0.0.1:${port}`;
  // Deliberately do not inherit database, email, object storage, auth or payment credentials.
  const env = { PATH: process.env.PATH, HOME: dir, TMPDIR: os.tmpdir(), NODE_ENV: 'development',
    DATABASE_URL: databaseUrl, BETTER_AUTH_SECRET: randomBytes(48).toString('hex'), BETTER_AUTH_URL: origin,
    NEXT_PUBLIC_SITE_URL: origin, AWS_EC2_METADATA_DISABLED: 'true', NEXT_TELEMETRY_DISABLED: '1', AIM4PRICE_AUTOMATIC_VALUATIONS_DISABLED: '1',
    AIM4PRICE_PUSH_DISABLED: '1', AIM4PRICE_BILLING_DISABLED: '1' };
  const log = fs.openSync(path.join(dir, 'server.log'), 'a', 0o600);
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-H', '127.0.0.1', '-p', String(port)], { cwd: root, env, stdio: ['ignore', log, log] });
  const manifest = { origin, owner, register, assets, accounts };
  fs.writeFileSync(path.join(dir, 'accounts.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  let stopping;
  function stop() { return stopping ||= shutdown(); }
  async function shutdown() { child.kill('SIGTERM'); await new Promise(resolve => { if (child.exitCode !== null) return resolve(); child.once('exit', resolve); setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000).unref(); }); fs.closeSync(log); await socket.stop(); await db.close(); fs.rmSync(path.join(dir, 'accounts.json'), {force:true}); }
  return { ...manifest, dir, db, child, stop };
}
module.exports = { startEnvironment };
if (require.main === module) startEnvironment().then(env => {
  console.log(`Isolated Manager QA: ${env.origin}\nSynthetic accounts: ${env.dir}/accounts.json\nStop with Ctrl+C; the database is discarded.`);
  process.once('SIGINT', async () => { await env.stop(); process.exit(0); });
  process.once('SIGTERM', async () => { await env.stop(); process.exit(0); });
}).catch(error => { console.error(error); process.exit(1); });
