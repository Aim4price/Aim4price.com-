const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

test('old directory bookmarks reach Accounts or business verification after the admin access check', async () => {
  const code = ts.transpileModule(fs.readFileSync('app/admin/businesses/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  for (const [params, target] of [[{}, '/admin'], [{ verify: '1' }, '/admin?verify=1']]) {
    const calls = [];
    const modules = {
      'next/navigation': { redirect: path => calls.push(path) },
      '../../../lib/account-access': { requireAdminPageAccess: async () => calls.push('admin') }
    };
    const exports = {};
    new Function('require', 'exports', code)(key => modules[key], exports);
    await exports.default({ searchParams: Promise.resolve(params) });
    assert.deepEqual(calls, ['admin', target]);
  }
});

test('standalone listing intake and Google search routes are retired', () => {
  for (const path of ['admin/business-network', 'business-network/accept', 'business-network/invite',
    'account-directory', 'business-network/google', 'business-network/accept/search']) {
    assert.equal(fs.existsSync(`app/api/${path}/route.ts`), false, path);
  }
});
