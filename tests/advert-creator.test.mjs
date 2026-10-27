import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
async function load(path, dependencies = {}) {
  const source = await fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('exports','module','require',js)(module.exports,module,(key) => { if (!(key in dependencies)) throw Error(key); return dependencies[key]; });
  return module.exports;
}
const details = { title:'Example machine',year:'2020',usage:'3000',usageUnit:'hours',condition:'good',askingPrice:'500000',vatLabel:'plus-vat',location:'',description:'',contactName:'Seller',phone:'0820000000',email:'',businessName:'Seller' };
const estimate = { id:'1',title:details.title,year:details.year,usage:details.usage,usageUnit:details.usageUnit,condition:details.condition,valueExVat:500000,createdAt:'2026-10-27T00:00:00Z' };
test('direct adverts validate without any estimate or asset register ID',async()=>{
 const {advertDetailsError}=await load('lib/advert-creator.ts');
 assert.equal(advertDetailsError(details),'');
 for (const askingPrice of ['','0','-1','NaN','Infinity']) assert.ok(advertDetailsError({...details,askingPrice}));
 assert.ok(advertDetailsError({...details,usage:'101',usageUnit:'percent'}));
 assert.ok(advertDetailsError({...details,phone:''}));
});
test('ratings only apply to matching positive estimates; pricing and style may change',async()=>{
 const {estimateMatchesAdvert}=await load('lib/advert-creator.ts');
 assert.equal(estimateMatchesAdvert(null,details),false);
 assert.equal(estimateMatchesAdvert(estimate,details),true);
 assert.equal(estimateMatchesAdvert(estimate,{...details,askingPrice:'450000',vatLabel:'vat-included'}),true);
 for(const key of ['title','year','usage','usageUnit','condition']) assert.equal(estimateMatchesAdvert(estimate,{...details,[key]:'changed'}),false);
 for(const valueExVat of [0,-1,NaN,Infinity]) assert.equal(estimateMatchesAdvert({...estimate,valueExVat},details),false);
});
test('estimate endpoint rejects unauthenticated and unauthorized access and scopes results to the seller',async()=>{
 let session=null,profile={accountType:'dealer',accountStatus:'active'},dealer=null,queries=[];
 const {GET}=await load('app/api/ad-studio/estimates/route.ts',{
  'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},
  '../../../../lib/auth-session':{getServerSession:async()=>session},
  '../../../../lib/account-profile':{getAccountProfile:async()=>profile},
  '../../../../lib/dealer-app-session':{getDealerAppSession:async()=>dealer},
  '../../../../lib/dealer-app-access':{dealerRoleCan:role=>role==='manager'},
  '../../../../lib/db':{getDb:()=>({query:async(sql,params)=>{queries.push({sql,params});return {rows:[{id:1,brand_name:'Brand',model_name:'Model',year_model:2020,hours:3000,condition:'good',aim4price_value_ex_vat:'500000',created_at:'2026-10-27',valuation_payload:{input:{usage_mode:'percent',life_worked_percent:35}}}]};}})},
 });
 assert.equal((await GET()).status,401);assert.equal(queries.length,0);
 session={user:{id:'seller-123'}};profile.accountStatus='inactive';assert.equal((await GET()).status,403);
 profile.accountStatus='active';dealer={role:'blocked'};assert.equal((await GET()).status,403);assert.equal(queries.length,0);
 dealer={role:'manager'};const response=await GET();assert.equal(response.status,200);assert.deepEqual(queries[0].params,['seller-123']);assert.match(queries[0].sql,/where user_id = \$1/);
 assert.equal(response.body.estimates[0].usageUnit,'percent');assert.equal(response.body.estimates[0].usage,'35');assert.equal(response.body.estimates[0].valueExVat,500000);
});
