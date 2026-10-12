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

test('every fuel-capable Basic family has relevant activity suggestions', () => {
  const { BASIC_FUEL_FAMILY_KEYS } = load('lib/basic-fuel-families.ts', {});
  for (const equipmentFamilyKey of BASIC_FUEL_FAMILY_KEYS) {
    assert.notEqual(options.fuelActivityProfile({equipmentFamilyKey}), 'general', equipmentFamilyKey);
    assert.ok(options.fuelActivitySuggestions({equipmentFamilyKey}).length >= 2, equipmentFamilyKey);
  }
  assert.ok(options.DEFAULT_FUEL_WORK_CHOICES.length > 20);
  assert.ok(options.DEFAULT_FUEL_WORK_CHOICES.length <= 100);
  options.validateFuelWorkChoices(options.DEFAULT_FUEL_WORK_CHOICES);
});
test('vehicles never inherit farming defaults and specific machinery wins over broad kinds', () => {
  const vehicle = {kind:'vehicle',equipmentFamilyKey:'sedan_fastback'};
  const names = options.fuelActivityChoices(options.DEFAULT_FUEL_WORK_CHOICES, vehicle).map(c=>c.name);
  assert.ok(names.includes('Delivery')); assert.ok(names.includes('Transporting people')); assert.ok(names.includes('Travel to a meeting'));
  assert.ok(!names.includes('Ploughing')); assert.ok(!names.includes('Planting'));
  assert.equal(options.fuelActivityProfile({kind:'tractor',equipmentFamilyKey:'truck_tractor'}),'truck');
  assert.equal(options.fuelActivityProfile({kind:'vehicle',equipmentFamilyKey:'truck_concrete_boom_pump'}),'concrete-pump');
  assert.ok(options.fuelActivitySuggestions({kind:'tractor'}).some(c=>c.name==='Ploughing'));
  assert.ok(!options.fuelActivitySuggestions({kind:'unknown'}).some(c=>c.name==='Ploughing'));
});
test('new custom work is scoped by profile and legacy custom descriptions remain available', () => {
  const saved = options.validateFuelWorkChoices([{id:'custom',name:'School collection',profile:'vehicle'}, {id:'legacy',name:'My recorded job'}]);
  assert.equal(saved[0].profile,'vehicle');
  assert.ok(options.fuelActivityChoices(saved,{kind:'vehicle'}).some(c=>c.id==='custom'));
  assert.ok(!options.fuelActivityChoices(saved,{kind:'tractor'}).some(c=>c.id==='custom'));
  assert.ok(options.fuelActivityChoices(saved,{kind:'tractor'}).some(c=>c.id==='legacy'));
  assert.throws(()=>options.validateFuelWorkChoices([{id:'x',name:'Invalid profile',profile:'invalid'}]),/profile/);
});
