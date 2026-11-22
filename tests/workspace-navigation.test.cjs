const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(path, dependencies = {}) {
  const output = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: {module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022},
  }).outputText;
  const exports = {};
  new Function('exports','require',output)(exports, name => dependencies[name] ?? require(name));
  return exports;
}
const nav = load('lib/workspace-navigation.ts', {
  './middleman-account':load('lib/middleman-account.ts'),
});

test('each personal workspace has four ordered header links and Account last in its grid', () => {
  for (const [role, third] of [['owner','Asset Register'],['business','Shared Assets'],['middleman','Marketplace']]) {
    assert.deepEqual(nav.workspaceHeader(role,'/business').map(item=>item.label), ['Home','Workspace',third,'Value Asset']);
    const cards = nav.workspaceCards(role,false,'/leads');
    assert.equal(cards.at(-1).key,'account');
    assert.equal(new Set(cards.map(card=>card.href)).size,cards.length);
  }
  const owner = nav.workspaceCards('owner',false,'/leads');
  assert.equal(owner[0].href, '/asset-registers');
  assert.ok(owner.every(card => !['/annual-review','/asset-register'].includes(card.href)));
  assert.ok(owner.some(card=>card.href==='/fuel?view=slips'));
  assert.ok(owner.some(card=>card.href==='/budgets'));
});

test('both Business tiers keep the same inventory with their own inbox and paid locks', () => {
  const free = nav.workspaceCards('business',true,nav.receivedAssetsHref('business','free'));
  const paid = nav.workspaceCards('business',false,nav.receivedAssetsHref('dealer','desktop'));
  assert.deepEqual(free.map(card=>card.key),paid.map(card=>card.key));
  assert.equal(free.find(card=>card.key==='shared').href,'/business');
  assert.equal(paid.find(card=>card.key==='shared').href,'/leads');
  assert.equal(free.find(card=>card.key==='parts').locked,true);
  assert.equal(paid.find(card=>card.key==='parts').label,'Parts & Stock');
  assert.ok(paid.every(card=>!card.locked));
  assert.ok(free.filter(card=>['account','value','shared','marketplace'].includes(card.key)).every(card=>!card.locked));
  for (const role of ['business','middleman']) {
    const links = nav.workspaceCards(role,false,'/leads').map(card=>card.href);
    assert.ok(links.includes('/ad-studio?mode=template') && links.includes('/ad-studio?mode=create'));
  }
});
