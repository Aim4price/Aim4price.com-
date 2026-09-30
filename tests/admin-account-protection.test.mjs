import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, deps = {}) {
  const code = ts.transpileModule(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  Function('require', 'module', 'exports', code)(name => name in deps ? deps[name] : require(name), module, module.exports);
  return module.exports;
}
const constants = load('lib/account-constants.ts');
function authOptions(onDelete) {
  return load('lib/auth.ts', {
    'better-auth': { betterAuth: options => options },
    './account-constants': constants,
    './account-deletion': { deleteUserWorkspaceData: onDelete },
    './db': { getDb: () => ({}) },
    './sharing-foundation': {}, './business-workspaces': {}, './email': {}, './access-email': {}, './billing': {}, './account-profile': {},
    './admin-usage-events': {}, './signup-workspace-context': {},
  }).auth;
}
test('self-service and auth database deletion hooks reject the admin before workspace cleanup', async () => {
  let cleanupCalls = 0;
  const options = authOptions(async () => cleanupCalls++);
  for (const email of ['aim4price@gmail.com', 'Aim4price@Gmail.com', '  AIM4PRICE@GMAIL.COM  ']) {
    const user = { id: 'protected-user', email };
    for (const hook of [options.user.deleteUser.beforeDelete, options.databaseHooks.user.delete.before]) {
      await assert.rejects(hook(user), error => error.status === 'FORBIDDEN' && /cannot be deleted/.test(error.message));
    }
  }
  assert.equal(cleanupCalls, 0);
});
test('ordinary account self-deletion still cleans the requested workspace', async () => {
  const deleted = [];
  const options = authOptions(async id => deleted.push(id));
  const user = { id: 'ordinary', email: 'customer@example.com' };
  await options.user.deleteUser.beforeDelete(user);
  await options.databaseHooks.user.delete.before(user);
  assert.deepEqual(deleted, ['ordinary']);
});
test('admin deletion reads the stored email and rejects a protected target before any deletion', async () => {
  let cleanupCalls = 0;
  const queries = [];
  const users = load('lib/admin-users.ts', {
    './account-constants': constants,
    './account-deletion': { deleteUserWorkspaceData: async () => cleanupCalls++ },
    './account-profile': {}, './admin-storage-usage': {},
    './db': { getDb: () => ({ query: async (sql, params) => {
      queries.push(sql); assert.deepEqual(params, ['protected-id']);
      return { rows: [{ id: 'protected-id', email: ' AIM4PRICE@GMAIL.COM ' }] };
    } }) },
  });
  await assert.rejects(users.deleteAdminManagedUser('protected-id'), /cannot be deleted/);
  assert.equal(cleanupCalls, 0);
  assert.equal(queries.length, 1);
  assert.match(queries[0], /select id, name, email/);
});
