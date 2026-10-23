const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function load(file,mocks){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>mocks[name],exports);return exports;}
const id='10000000-0000-4000-8000-000000000001';
test('shared assessment is owner scoped, opt-in, latest only and contains no private answers',async()=>{
 const pg=new PGlite();let queries=0;
 const api=load('lib/shared-market-assessment.ts',{'./db':{getDb:()=>({query:(...args)=>{queries++;return pg.query(...args);}})},'./asset-saleability':{saleabilityBasis:asset=>asset.basis}});
 try {
  assert.deepEqual(await api.sharedMarketAssessments('owner',[{id}],false),{});assert.equal(queries,0);
  assert.deepEqual(await api.sharedMarketAssessments('owner',[{id}],true),{}); // Table not installed yet.
  await pg.exec('CREATE TABLE asset_register_items(id uuid PRIMARY KEY,user_id text); CREATE TABLE asset_saleability_assessments(id serial,owner_id text,asset_id uuid,assessment jsonb)');
  await pg.query('INSERT INTO asset_register_items VALUES($1,$2)',[id,'owner']);
  const saved={priceExVat:50000,assessedAt:'2026-10-20T10:00:00Z',basis:'current',answers:{private:'PRIVATE'},lowExVat:40000};
  for(const [owner,price] of [['owner',40000],['owner',50000],['other',90000]])await pg.query('INSERT INTO asset_saleability_assessments(owner_id,asset_id,assessment) VALUES($1,$2,$3)',[owner,id,{...saved,priceExVat:price}]);
  const result=await api.sharedMarketAssessments('owner',[{id,basis:'current'}],true);
  assert.deepEqual(result[id],{priceExVat:50000,assessedAt:saved.assessedAt,needsReview:false});
  assert.equal((await api.sharedMarketAssessments('owner',[{id,basis:'changed'}],true))[id].needsReview,true);
  assert.deepEqual(await api.sharedMarketAssessments('other',[{id}],true),{});
  await pg.query('UPDATE asset_register_items SET user_id=$1',['buyer']);
  assert.deepEqual(await api.sharedMarketAssessments('owner',[{id}],true),{});
 }finally{await pg.close();}
});
test('invalid saved prices and dates are withheld; unexpected database errors are not hidden',async()=>{
 let saved={priceExVat:-1,assessedAt:'2026-10-20'};
 const api=load('lib/shared-market-assessment.ts',{'./db':{getDb:()=>({query:async()=>({rows:[{asset_id:id,assessment:saved}]})})},'./asset-saleability':{saleabilityBasis:()=>''}});
 for(const value of [-1,NaN,Infinity,'500']){saved.priceExVat=value;assert.deepEqual(await api.sharedMarketAssessments('owner',[{id}],true),{});}
 saved={priceExVat:500,assessedAt:'invalid'};assert.deepEqual(await api.sharedMarketAssessments('owner',[{id}],true),{});
 const broken=load('lib/shared-market-assessment.ts',{'./db':{getDb:()=>({query:async()=>{throw Error('connection failed');}})}});
 await assert.rejects(broken.sharedMarketAssessments('owner',[{id}],true),/connection failed/);
});
