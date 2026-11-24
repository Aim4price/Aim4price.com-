const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const ts = require('typescript');
const {PGlite} = require('@electric-sql/pglite');

function load(name, dependencies) {
  const module = {exports:{}};
  const js = ts.transpileModule(readFileSync('lib/' + name + '.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require', 'module', 'exports', js)(key => dependencies[key], module, module.exports);
  return module.exports;
}

test('register and category budgets count incurred costs once and exclude pending dealer records', async () => {
  const db = new PGlite();
  const query = async (sql, params) => {
    const result = params ? await db.query(sql,params) : (await db.exec(sql)).at(-1);
    return {...result,rowCount:result.rows.length};
  };
  const deps = {'./db':{getDb:() => ({query,connect:async()=>({query,release(){}})})},'./my-invoices':{ensureMyInvoiceTables:async()=>{}},
    './asset-history-schema':{installAssetHistoryTriggers:async()=>{}},'./asset-register-db':{getAssetRegisterItemById:async()=>({})}};
  deps['./cost-categories'] = load('cost-categories',{});
  deps['./cost-budget-history'] = load('cost-budget-history',deps);
  const api = load('cost-budgets',deps);
  const register = '10000000-0000-4000-8000-000000000001';
  const asset = '20000000-0000-4000-8000-000000000001';
  try {
    await db.exec(`create table asset_registers(id uuid primary key,user_id text,business_name text);
      create table asset_register_items(id uuid primary key,user_id text,title text,register_id uuid);
      create table asset_invoices(user_id text,asset_register_item_id uuid,invoice_date date,cost_category text,total_inc_vat numeric,
        source text,created_by_dealer_user_id text,owner_storage_status text,created_at timestamptz,updated_at timestamptz);`);
    await query('insert into asset_registers values ($1,$2,$3)', [register,'owner','Farm']);
    await query('insert into asset_register_items values ($1,$2,$3,$4)',[asset,'owner','JCB',register]);
    const date = api.currentCostBudgetPeriodWindow('annual').start;
    for (const [category,amount,dealer] of [['repair',5000,null],['insurance',1000,null],['service',800,'dealer']]) {
      await query('insert into asset_invoices values ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())',['owner',asset,date,category,amount,'manual',dealer,dealer?'pending':'owner']);
    }
    const options={period:'annual',amount:60000,warningPercent:80};
    const overall=await api.createCostBudget('owner',{...options,registerId:register},{});
    const service=await api.createCostBudget('owner',{...options,registerId:register,categories:['service','repair']},{});
    assert.equal(overall.spent,6000);
    assert.equal(service.spent,5000);
    assert.equal(service.remaining,55000);
    await assert.rejects(api.createCostBudget('owner',{...options,registerId:register,categories:['repair','service']},{}),/DUPLICATE/);
    await assert.rejects(api.createCostBudget('another',{...options,registerId:register},{}),/NOT_FOUND/);
    const updated=await api.updateCostBudget('owner',service.id,{...options,registerId:register,categories:['insurance']},{});
    assert.equal(updated.spent,1000);
  } finally {await db.close();}
});

test('expected instalments respect the period, allocation and month end',()=>{
  const {expectedCommitmentAmount} = load('budget-expected',{});
  const budget={assetId:'tractor',categories:['insurance'],periodStart:'2026-02-01',periodEnd:'2026-04-01'};
  const item={status:'active',category:'insurance',startDate:'2026-01-31',frequency:'monthly',amount:1100,assets:[{assetId:'tractor',annualAllocation:7200},{assetId:'truck'}]};
  assert.equal(expectedCommitmentAmount(budget,[item],new Map(),'2026-02-28'),1200);
  assert.equal(expectedCommitmentAmount(budget,[item],new Map(),'2026-03-01'),600);
  assert.equal(expectedCommitmentAmount(budget,[{...item,category:'lease'}],new Map(),'2026-02-01'),0);
});
