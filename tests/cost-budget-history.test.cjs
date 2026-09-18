const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
test('Postgres history captures edits and deletion atomically, seeds honestly and isolates owners',async()=>{
 const db=new PGlite();
 const query=async(sql,params)=>params?db.query(sql,params):((await db.exec(sql)).at(-1)||{rows:[]});
 const mod={exports:{}};
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync('lib/cost-budget-history.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(()=>({getDb:()=>({query,connect:async()=>({query,release(){}})})}),mod,mod.exports);
 try {
 await db.exec(`create table asset_cost_budgets(id uuid primary key,user_id text,asset_register_item_id uuid,revision integer,period text,amount numeric,warning_percent smallint,include_fuel_slip_costs boolean,created_at timestamptz,updated_at timestamptz);
 insert into asset_cost_budgets values ('00000000-0000-4000-8000-000000000001','owner','00000000-0000-4000-8000-000000000002',1,'monthly',1000,80,false,'2025-01-01','2025-01-01'),
 ('00000000-0000-4000-8000-000000000003','other',null,3,'annual',2000,80,true,'2024-01-01','2025-06-01');`);
 await mod.exports.ensureCostBudgetHistory();await mod.exports.ensureCostBudgetHistory();
 let history=await mod.exports.readCostBudgetHistory('owner');assert.equal(history.length,1);assert.equal(history[0].effectiveFrom,'2025-01-01');
 assert.equal((await mod.exports.readCostBudgetHistory('other'))[0].effectiveFrom,'2025-06-01');
 await db.exec("update asset_cost_budgets set amount=3000,revision=2,updated_at=now() where user_id='owner'");
 history=await mod.exports.readCostBudgetHistory('owner');assert.equal(history.length,2);assert.equal(history[0].amount,1000);assert.equal(history[1].amount,3000);assert.equal(history[0].effectiveTo,history[1].effectiveFrom);
 await db.exec("begin; update asset_cost_budgets set amount=9000,revision=3 where user_id='owner'; rollback;");
 assert.equal((await mod.exports.readCostBudgetHistory('owner')).length,2);
 await db.exec("delete from asset_cost_budgets where user_id='owner'");
 history=await mod.exports.readCostBudgetHistory('owner');assert.equal(history.length,2);assert.ok(history.every(v=>v.effectiveTo));
 await db.exec("insert into asset_cost_budgets values ('00000000-0000-4000-8000-000000000004','owner',null,1,'annual',5000,90,true,now(),now())");
 assert.equal((await mod.exports.readCostBudgetHistory('owner')).length,3);
 await db.exec(fs.readFileSync('database/migrations/107-cost-budget-history.sql','utf8'));
 assert.equal((await mod.exports.readCostBudgetHistory('owner')).length,3);
 } finally {await db.close();}
});
