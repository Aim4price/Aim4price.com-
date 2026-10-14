const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
function load(file, mocks = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'), mocks);
    return require(name);
  }, module, module.exports);
  return module.exports;
}
const { canViewTutorialPreview } = load('lib/tutorial-preview-access.ts');
test('private draft permits only authenticated review accounts', () => {
  for (const user of [null, undefined, {}, { email: 'kallageldenhuys@gmail.com' }, { id: 'other', email: 'someone@example.com' }, { id: 'other', email: 'kallageldenhuys@gmail.com.attacker.example' }]) assert.equal(canViewTutorialPreview(user), false);
  for (const email of ['kallageldenhuys@gmail.com', ' KALLAGELDENHUYS@GMAIL.COM ', 'aim4price@gmail.com']) assert.equal(canViewTutorialPreview({ id: 'authenticated-id', email }), true);
});
test('page redirects anonymous visitors and refuses other signed-in users before rendering', async () => {
  let session = null;
  const { default: Page } = load('app/tutorials/page.tsx', {
    'next/navigation': { redirect: location => { throw new Error('redirect:' + location); }, notFound: () => { throw new Error('not-found'); } },
    '../../components/AppHeader': { default: () => null },
    '../../lib/auth-session': { getAnyServerSession: async () => session },
    '../../lib/tutorial-preview-access': { canViewTutorialPreview },
    './tutorial-library': { default: () => null },
  });
  await assert.rejects(Page(), /redirect:\/auth\?returnTo=%2Ftutorials#login/);
  session = { user: { id: 'other', email: 'other@example.com' } };
  await assert.rejects(Page(), /not-found/);
  session = { user: { id: 'reviewer', email: 'kallageldenhuys@gmail.com' } };
  assert.ok(await Page());
});
