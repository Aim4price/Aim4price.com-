const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  Function('require', 'module', 'exports', code)(name => { if (name in mocks) return mocks[name]; throw Error(name); }, module, module.exports);
  return module.exports;
}
const options = load('lib/fuel-work-choice-options.ts', {});
test('work choice validation rejects duplicates, malformed identifiers and excessive text', () => {
  assert.throws(() => options.validateFuelWorkChoices([{id:'x',name:'Ploughing'},{id:'y',name:' ploughing '}]), /already exists/);
  assert.throws(() => options.validateFuelWorkChoices([{id:'../x',name:'Work'}]), /Invalid/);
  assert.throws(() => options.validateFuelWorkChoices([{id:'x',name:'x'.repeat(121)}]), /120/);
  assert.deepEqual(options.validateFuelWorkChoices([{id:'work',name:'  Field   work  '}]), [{id:'work',name:'Field work'}]);
  assert.deepEqual(options.validateFuelWorkChoices([]), []);
});
test('saved work is owner scoped and stale first saves or updates cannot overwrite newer choices', async () => {
  const rows = new Map();
  const db = { query: async (sql, args) => {
    if (sql.startsWith('CREATE')) return {rows:[]};
    const [owner, choices, revision] = args, existing = rows.get(owner);
    if (sql.startsWith('SELECT')) return {rows:existing ? [existing] : []};
    assert.match(sql, /owner_user_id/);
    if (sql.startsWith('INSERT') ? !!existing : !existing || existing.revision !== revision) return {rows:[]};
    const saved = {choices:JSON.parse(choices),revision:(existing?.revision ?? 0)+1}; rows.set(owner,saved); return {rows:[saved]};
  }};
  const api = load('lib/fuel-work-choices.ts', {'./db':{getDb:()=>db},'./fuel-work-choice-options':options});
  assert.equal((await api.getFuelWorkChoices('owner-a')).revision,0);
  const choices = [{id:'planting',name:'Plant maize'}];
  assert.equal((await api.saveFuelWorkChoices('owner-a',choices,0)).revision,1);
  assert.equal(await api.saveFuelWorkChoices('owner-a',[],0),null);
  assert.equal((await api.getFuelWorkChoices('owner-b')).revision,0);
  assert.equal((await api.saveFuelWorkChoices('owner-a',[],1)).revision,2);
  assert.deepEqual((await api.getFuelWorkChoices('owner-a')).choices,[]);
  assert.equal(await api.saveFuelWorkChoices('owner-a',choices,1),null);
});
test('work choice routes require access and derive ownership from the session, not the request', async () => {
  let allowed = false;
  const calls = [];
  const route = load('app/api/fuel/work-choices/route.ts', {
    'next/server': {NextResponse: {json: (data, init = {}) => ({data, status:init.status ?? 200})}},
    '../../../../lib/owner-workspace-access': {resolveOwnerWorkspaceContext: async (_request, options) => {
      calls.push(options);
      return allowed ? {ok:true,context:{ownerUserId:'session-owner'}} : {ok:false,response:{status:403}};
    }},
    '../../../../lib/fuel-work-choices': {
      getFuelWorkChoices: async owner => {assert.equal(owner,'session-owner');return {choices:[],revision:1};},
      saveFuelWorkChoices: async (owner, choices, revision) => {
        assert.equal(owner,'session-owner');
        return revision === 1 ? {choices,revision:2} : null;
      },
    },
  });
  const request = {json:async()=>({ownerUserId:'forged-owner',choices:[],revision:1})};
  assert.equal((await route.GET(request)).status,403);
  assert.equal((await route.PUT(request)).status,403);
  allowed = true;
  assert.equal((await route.GET(request)).status,200);
  assert.equal((await route.PUT(request)).data.revision,2);
  assert.deepEqual(calls.at(-1),{ledger:'fuel',requireWrite:true});
  assert.equal((await route.PUT({json:async()=>({choices:[],revision:0})})).status,409);
});
