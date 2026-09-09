import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function moduleAt(path, dependencies = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? require(name) });
  return exports;
}
const names = moduleAt('lib/app-login-name.ts');

test('business suggestion and usernames are case insensitive and account scoped', () => {
  assert.equal(names.suggestAppAccountName('Vasbyt Boerdery'), 'vasbyt');
  assert.equal(names.suggestAppAccountName('Élan Farms'), 'elan');
  assert.equal(names.validateAppAccountName(' VASBYT '), 'vasbyt');
  assert.equal(names.accountAppUsername(' Kuyler ', 'vasbyt'), 'kuyler@vasbyt');
  assert.equal(names.accountAppUsername('KUYLER@VASBYT', 'vasbyt'), 'kuyler@vasbyt');
  assert.equal(names.accountAppUsername('kuyler', 'other'), 'kuyler@other');
});

test('foreign suffixes, ambiguous names and invalid lengths are rejected', () => {
  for (const value of ['kuyler@other', 'kuyler@vasbyt@other', 'ku yler', 'ku', 'a'.repeat(33), 'kuyler!']) {
    assert.throws(() => names.accountAppUsername(value, 'vasbyt'));
  }
  for (const value of ['ab', '-vasbyt', 'vasbyt-', 'vas byt', 'a'.repeat(33)]) {
    assert.throws(() => names.validateAppAccountName(value));
  }
});

test('login normalization preserves legacy identifiers but never strips a typo into another login', () => {
  assert.equal(names.normalizeAppLogin(' Kuyler@VASBYT '), 'kuyler@vasbyt');
  assert.equal(names.normalizeAppLogin('Kuyler'), 'kuyler');
  for (const value of ['kuy ler', 'kuyler!', 'kuyler@vasbyt!', 'a'.repeat(81)]) assert.equal(names.normalizeAppLogin(value), '');
});

function fixture({ namespace = 'vasbyt', duplicateTable = '', writeError = false } = {}) {
  const calls = [];
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes('to_regclass')) return { rows: [{ table_name: values[0] }], rowCount: 1 };
      if (sql.startsWith('select username_normalized')) return { rows: [{ username_normalized: 'legacy' }], rowCount: 1 };
      if (sql.startsWith('select account_name')) return { rows: namespace ? [{ account_name: namespace }] : [], rowCount: namespace ? 1 : 0 };
      if (sql.includes('select 1 from') && sql.includes(duplicateTable) && duplicateTable) return { rows: [{}], rowCount: 1 };
      if (sql === 'WRITE' && writeError) throw new Error('Write failed');
      return { rows: [], rowCount: 0 };
    },
    release() { calls.push({ sql: 'RELEASE' }); },
  };
  const pool = { ...client, connect: async () => client };
  const api = moduleAt('lib/app-login-namespace.ts', { './db': { getDb: () => pool }, './app-login-name': names });
  return { api, calls };
}

test('legacy edits remain possible before setup; new and renamed names require the account namespace', async () => {
  const { api } = fixture({ namespace: null });
  assert.equal(await api.resolveAccountAppUsername('owner', 'KUYLER', 'kuyler'), 'kuyler');
  await assert.rejects(api.resolveAccountAppUsername('owner', 'newname'), /Confirm your business/);
  const ready = fixture().api;
  assert.equal(await ready.resolveAccountAppUsername('owner', 'newname'), 'newname@vasbyt');
  await assert.rejects(ready.resolveAccountAppUsername('owner', 'newname@other'), /account suffix/);
});

test('duplicates in every app directory stop the write and roll back', async () => {
  for (const duplicateTable of ['owner_app_users', 'dealer_app_staff', 'field_managers']) {
    const { api, calls } = fixture({ duplicateTable });
    let wrote = false;
    await assert.rejects(api.withUniqueAppUsername('kuyler@vasbyt', 'dealer', null, undefined, async () => { wrote = true; }), /already in use/);
    assert.equal(wrote, false);
    assert.equal(calls.at(-2).sql, 'rollback');
    assert.equal(calls.at(-1).sql, 'RELEASE');
  }
});

test('username check and write share the locked transaction and exclude only their own record', async () => {
  const { api, calls } = fixture();
  await api.withUniqueAppUsername('kuyler@vasbyt', 'dealer', 'staff-id', 'legacy', db => db.query('WRITE'));
  const checks = calls.filter(call => call.sql.includes('select 1 from'));
  assert.deepEqual(Array.from(checks.find(c => c.sql.includes('dealer_app_staff')).values), ['kuyler@vasbyt', 'staff-id']);
  assert.equal(checks.find(c => c.sql.includes('owner_app_users')).values[1], null);
  assert.equal(calls[0].sql, 'begin');
  assert.match(calls[1].sql, /pg_advisory_xact_lock/);
  assert.equal(calls.at(-3).sql, 'WRITE');
  assert.equal(calls.at(-2).sql, 'commit');
  assert.equal(calls.at(-1).sql, 'RELEASE');
  const failed = fixture({ writeError: true });
  await assert.rejects(failed.api.withUniqueAppUsername('kuyler@vasbyt', 'owner', null, undefined, db => db.query('WRITE')), /Write failed/);
  assert.equal(failed.calls.at(-2).sql, 'rollback');
});

test('business names cannot change or claim another account legacy suffix', async () => {
  const { api } = fixture();
  assert.equal(await api.confirmAppLoginNamespace('owner', 'VASBYT'), 'vasbyt');
  await assert.rejects(api.confirmAppLoginNamespace('owner', 'different'), /already been confirmed/);
  const reserved = fixture({ duplicateTable: 'field_managers' });
  await assert.rejects(reserved.api.confirmAppLoginNamespace('owner', 'vasbyt'), /already in use/);
  assert.equal(reserved.calls.some(c => c.sql.includes('insert into')), false);
});

test('namespace API derives ownership from the session and refuses staff or inactive accounts', async () => {
  let session = { user: { id: 'signed-in-owner', name: 'Owner' } };
  let profile = { accountType: 'owner', accountStatus: 'active', businessName: 'Vasbyt Boerdery' };
  const claims = [];
  const api = moduleAt('app/api/account/app-login-name/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    '../../../../lib/auth-session': {
      getServerSession: async () => session,
      isDealerAppSession: s => Boolean(s?.dealerApp),
      isOwnerAppSession: s => Boolean(s?.ownerApp),
    },
    '../../../../lib/account-profile': { getAccountProfile: async () => profile },
    '../../../../lib/app-login-name': names,
    '../../../../lib/app-login-namespace': {
      getAppLoginNamespace: async () => null,
      confirmAppLoginNamespace: async (id, name) => { claims.push([id, name]); return name; },
    },
  });
  assert.equal((await api.GET()).body.suggestedName, 'vasbyt');
  await api.POST({ json: async () => ({ accountName: 'vasbyt', accountUserId: 'someone-else' }) });
  assert.deepEqual(claims, [['signed-in-owner', 'vasbyt']]);
  for (const denied of [null, { ...session, dealerApp: {} }, { ...session, ownerApp: {} }]) {
    session = denied;
    assert.equal((await api.GET()).status, 403);
    assert.equal((await api.POST({ json: async () => ({ accountName: 'taken' }) })).status, 403);
  }
  session = { user: { id: 'signed-in-owner' } };
  profile = { ...profile, accountStatus: 'inactive' };
  assert.equal((await api.GET()).status, 403);
  assert.equal(claims.length, 1);
});

test('stale edits cannot restore a username after another request renamed it', async () => {
  const { api, calls } = fixture();
  let wrote = false;
  await assert.rejects(api.withUniqueAppUsername('oldname', 'owner', 'user-id', 'oldname', async () => { wrote = true; }), /changed while you were editing/);
  assert.equal(wrote, false);
  assert.equal(calls.at(-2).sql, 'rollback');
  const unchanged = fixture({ duplicateTable: 'dealer_app_staff' });
  await unchanged.api.withUniqueAppUsername('legacy', 'owner', 'user-id', 'legacy', db => db.query('WRITE'));
  assert.ok(unchanged.calls.some(c => c.sql.includes('for update')));
  assert.equal(unchanged.calls.at(-2).sql, 'commit');
});
