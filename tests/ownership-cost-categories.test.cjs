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
        source text,created_by_dealer_user_id text,owner_storage_status text,created_at timestamptz,updated_at timestamptz, subtotal_ex_vat numeric, vat_amount numeric);`);
    await query('insert into asset_registers values ($1,$2,$3)', [register,'owner','Farm']);
    await query('insert into asset_register_items values ($1,$2,$3,$4)',[asset,'owner','JCB',register]);
    const date = api.currentCostBudgetPeriodWindow('annual').start;
    for (const [category,amount,dealer] of [['repair',5000,null],['insurance',1000,null],['service',800,'dealer']]) {
      await query('insert into asset_invoices values ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())',['owner',asset,date,category,amount,'manual',dealer,dealer?'pending':'owner']);
    }
    const options={period:'annual',amount:60000,warningPercent:80};
    const overall = await api.createCostBudget('owner', {...options, assetId: asset}, {});
    assert.equal(overall.includeRecurringCosts, true);
    await api.setBudgetRecurringPreference('owner', overall, false);
    const [afterToggle] = await api.listCostBudgetsWithProgress('owner');
    assert.equal(afterToggle.includeRecurringCosts, false);
    assert.equal(afterToggle.revision, overall.revision);
    assert.equal(afterToggle.spent, overall.spent);
    await assert.rejects(api.setBudgetRecurringPreference('other', overall, true), /NOT_FOUND/);
    const repairs = {...options, assetId: asset, categories: ['service', 'repair']};
    const service = await api.createCostBudget('owner', repairs, {});
    assert.equal(overall.includeVat, true);
    assert.equal(overall.spent, 6000);
    assert.equal(service.spent, 5000);
    assert.equal(service.remaining, 55000);
    await assert.rejects(api.createCostBudget('owner', {...repairs, categories:['repair','service']}, {}), /DUPLICATE/);
    for (const scope of [{}, {registerId: register}]) {
      await assert.rejects(api.createCostBudget('owner', {...options, ...scope}, {}), /ASSET_INVALID/);
      await assert.rejects(api.updateCostBudget('owner', service.id, {...options, ...scope}, {}), /NOT_FOUND/);
    }

    await query("update asset_invoices set vat_amount=150 where cost_category='repair'");
    await query("update asset_invoices set subtotal_ex_vat=950 where cost_category='insurance'");
    const net = await api.updateCostBudget('owner', overall.id, {...options, assetId:asset, includeVat:false, amount:5900}, {});
    assert.equal(net.includeVat, false);
    assert.equal(net.spent, 5800);
    assert.equal(net.remaining, 100);
    assert.equal(net.status, 'warning');
    const reopened = (await api.listCostBudgetsWithProgress('owner')).find(b => b.id === overall.id);
    assert.equal(reopened.includeVat, false);
    const retained = await api.updateCostBudget('owner', overall.id, {...options, assetId:asset}, {});
    assert.equal(retained.spent, 5800);
    const gross = await api.updateCostBudget('owner', overall.id, {...options, assetId:asset, includeVat:true}, {});
    assert.equal(gross.spent, 6000);
    const netInsurance = await api.createCostBudget('owner', {...options,assetId:asset,categories:['insurance'],includeVat:false}, {});
    assert.equal(netInsurance.spent, 950);

    // A register budget saved before the asset-only flow still counts eligible costs.
    const legacy = await query(`insert into asset_cost_budgets
      (user_id, register_id, period, amount, warning_percent, categories)
      values ('owner', $1, 'annual', 60000, 80, array['repair','service']) returning id`, [register]);
    const legacyId = legacy.rows[0].id;
    const existing = (await api.listCostBudgetsWithProgress('owner')).find(budget => budget.id === legacyId);
    assert.equal(existing.spent, 5000);
    const input = {...options, registerId: register, categories: ['insurance']};
    await assert.rejects(api.updateCostBudget('another', legacyId, input, {}), /NOT_FOUND/);
    const updated = await api.updateCostBudget('owner', legacyId, input, {});
    assert.equal(updated.spent, 1000);
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

test('paused and unallocated shared costs are visible without inflating available funds', () => {
  const {budgetRecurringCosts} = load('budget-expected',{});
  const budget = {assetId:'a',periodStart:'2026-11-01',periodEnd:'2026-12-01'};
  const registers = new Map([['a','r']]);
  const schedule = {id:'insurance',description:'Cover',status:'paused',frequency:'monthly',startDate:'2026-01-30',amount:2000,assets:[{assetId:'a'}]};
  const [paused] = budgetRecurringCosts(budget,[schedule],registers,'2026-11-26');
  assert.equal(paused.expected,0);
  assert.equal(paused.editableAmount,2000);
  const [shared] = budgetRecurringCosts(budget,[{...schedule,status:'active',assets:[{assetId:'a'},{assetId:'b'}]}],registers,'2026-11-26');
  assert.equal(shared.editableAmount,null);
  assert.equal(shared.allocationNeeded,true);
  assert.equal(shared.expected,0);
  assert.equal(shared.nextDue,'2026-11-30');
});
