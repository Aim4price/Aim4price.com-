const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
test('cost picker eligibility follows exact active write grants without removing read-only history assets',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`CREATE TABLE asset_leads(owner_user_id text, partner_user_id text, asset_register_item_id uuid);
 CREATE TABLE dealer_maintenance_access(id text, owner_user_id text, dealer_user_id text, asset_register_item_id uuid, is_active boolean, can_add_costs boolean);
 CREATE TABLE asset_register_items(id uuid,user_id text);
 CREATE TABLE account_profiles(user_id text,business_name text,display_name text);
 CREATE TABLE "user"(id text,name text);
 INSERT INTO "user" VALUES('owner','Farm');`);
 const ids=Array.from({length:4},(_,i)=>`10000000-0000-4000-8000-00000000000${i+1}`);
 for(const id of ids){await db.query('INSERT INTO asset_register_items VALUES($1, $2)',[id,'owner']);await db.query('INSERT INTO asset_leads VALUES($1,$2,$3)',['owner','dealer',id]);}
 for(const [i,active,canAdd] of [[0,true,true],[1,true,false],[2,false,true]])await db.query('INSERT INTO dealer_maintenance_access VALUES($1,$2,$3,$4,$5,$6)',[String(i),'owner','dealer',ids[i],active,canAdd]);
 await db.query('INSERT INTO dealer_maintenance_access VALUES($1,$2,$3,$4,true,true)',['other','owner','other-dealer',ids[3]]);
 const noop=async()=>{};
 const stubs={'./sharing-foundation':{},'./asset-register-db':{getAssetRegisterItemsByRefs:async refs=>refs.map(r=>({id:r.assetId,userId:r.userId}))},'./dealer-maintenance-tracker':{ensureDealerMaintenanceTrackerTables:noop},'./db':{getDb:()=>db},'./my-invoices':{ensureMyInvoiceTables:noop,mapMyInvoiceAssetOption:a=>({id:a.id,title:a.id})},'./partner-access':{ensurePartnerAccessTables:noop}};
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('lib/dealer-costs.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(name=>{assert(name in stubs, name);return stubs[name];},module,module.exports);
 const assets=await module.exports.listDealerCostAssets('dealer');
 assert.equal(assets.length,4,'all shared assets remain available for history');
 assert.deepEqual(assets.filter(a=>a.canAddCosts).map(a=>a.id),[ids[0]],'read-only, revoked and other-dealer grants cannot enter the cost flow');
 assert.equal((await module.exports.getDealerCostAssetAccess('dealer',ids[0])).owner_user_id,'owner');
 for(const id of ids.slice(1))assert.equal(await module.exports.getDealerCostAssetAccess('dealer',id),null);
 await db.exec("UPDATE dealer_maintenance_access SET can_add_costs=false WHERE id='0'");
 assert.equal((await module.exports.listDealerCostAssets('dealer')).filter(a=>a.canAddCosts).length,0);
 } finally {await db.close();}
});
