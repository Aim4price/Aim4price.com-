const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
function load(file, mocks = {}) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require','exports',js)(name => name in mocks ? mocks[name] : require(name),exports);
  return exports;
}
const policy = load('lib/annual-review-policy.ts');
test('annual availability changes at midnight South Africa, first opening in 2027', () => {
  assert.equal(policy.liveReviewYear(new Date('2026-12-31T21:59:59Z')),null);
  assert.equal(policy.liveReviewYear(new Date('2026-12-31T22:00:00Z')),2027);
  assert.equal(policy.liveReviewYear(new Date('2027-12-31T21:59:59Z')),2027);
  assert.equal(policy.liveReviewYear(new Date('2027-12-31T22:00:00Z')),2028);
  for(const invalid of [null,'3',NaN,Infinity,-10.5,20.5,3.1]) assert.throws(()=>policy.annualPercentage(invalid));
  for(const valid of [-10,0,3,3.5,20]) assert.equal(policy.annualPercentage(valid),valid);
});
async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('owner'),('other');
    CREATE TABLE asset_register_items(id text PRIMARY KEY,user_id text,value numeric,revision text);
    INSERT INTO asset_register_items VALUES('one','owner',80,'v1'),('two','owner',160,'v1'),('foreign','other',500,'v1');
    CREATE TABLE history(asset_id text, value numeric);`);
  await db.exec(fs.readFileSync('database/migrations/151-annual-asset-reviews.sql','utf8'));
  // Prove startup migration is repeatable.
  await db.exec(fs.readFileSync('database/migrations/151-annual-asset-reviews.sql','utf8'));
  let failId = '', year = 2027, releases=0;
  const query = (sql,params) => sql.includes('pg_advisory_xact_lock') ? Promise.resolve({rows:[]}) : db.query(sql,params);
  const tx = {query,release(){releases++;}};
  const pool = {query,connect:async()=>tx};
  const api = load('lib/annual-review-live.ts', {
    './db':{getDb:()=>pool},
    './asset-register-db':{prepareAssetRegisterRevaluation:async()=>{}},
    './annual-review-policy':{...policy,liveReviewYear:()=>year},
    './annual-review-preview':{loadAnnualReview:async(_email,_year,_id,userId)=>({rows:(await db.query('SELECT * FROM asset_register_items WHERE user_id=$1 ORDER BY id',[userId])).rows.map(a=>({row:{id:a.id,revision:a.revision,eligible:true,currentValue:Number(a.value),replacementPrice:a.id==='one'?100:200},includedExtras:a.id==='one'?25:0}))})},
    './asset-register-revaluation':{revalueAssetRegisterItem:async input=>{
      assert.equal(input.transaction,tx); assert.equal(input.annualYear,year); assert.equal(input.saveReplacementPrice,true);
      if(input.assetId===failId)throw Error('fixture failed');
      const price=input.replacementPriceExVat-(input.assetId==='one'?25:0);
      const value=price*.8;
      await tx.query("UPDATE asset_register_items SET value=$1,revision='v2' WHERE id=$2 AND user_id=$3",[value,input.assetId,input.userId]);
      await tx.query('INSERT INTO history VALUES($1,$2)',[input.assetId,value]);
      return {newValueExVat:value,valuationRunId:42};
    }},
  });
  const input={year:2027,keepUnchanged:false,percent:3,assets:[{id:'one',revision:'v1',replacementPrice:103,proposedValue:82.4},{id:'two',revision:'v1',replacementPrice:206,proposedValue:164.8}]};
  return {db,api,input,setFail:id=>failId=id,setYear:y=>year=y,state:async()=>({assets:(await db.query('SELECT * FROM asset_register_items ORDER BY id')).rows,history:(await db.query('SELECT * FROM history')).rows,receipts:(await db.query('SELECT * FROM annual_asset_reviews')).rows,releases})};
}
test('confirmation commits all assets, history and one annual receipt; repeat is idempotent',async()=>{
  const f=await fixture();try{
    assert.equal((await f.api.applyAnnualReview('owner',f.input)).alreadyCompleted,false);
    let state=await f.state(); assert.equal(state.history.length,2);assert.equal(state.receipts.length,1);assert.equal(state.assets[0].value,'500');
    assert.equal(state.receipts[0].changes.length,2);
    assert.equal((await f.api.applyAnnualReview('owner',f.input)).alreadyCompleted,true);
    state=await f.state();assert.equal(state.history.length,2);assert.equal(state.receipts.length,1);
  }finally{await f.db.close();}
});
test('one failed calculation rolls back the whole batch and retry can succeed',async()=>{
  const f=await fixture();try{
    f.setFail('two');await assert.rejects(f.api.applyAnnualReview('owner',f.input),/fixture failed/);
    let s=await f.state();assert.equal(s.history.length,0);assert.equal(s.receipts.length,0);assert.equal(s.assets.find(a=>a.id==='one').value,'80');
    f.setFail('');await f.api.applyAnnualReview('owner',f.input);assert.equal((await f.state()).receipts.length,1);
  }finally{await f.db.close();}
});
test('stale, foreign, duplicate, omitted and changed-preview assets cannot save',async()=>{
  const f=await fixture();try{
    for(const assets of [[],[f.input.assets[0],f.input.assets[0]],f.input.assets.map(a=>({...a,revision:'stale'})),[...f.input.assets,{id:'foreign'}],f.input.assets.map(a=>({...a,proposedValue:1})),f.input.assets.map(a=>({...a,replacementPrice:1}))]){
      await assert.rejects(f.api.applyAnnualReview('owner',{...f.input,assets}));
      const s=await f.state();assert.equal(s.history.length,0);assert.equal(s.receipts.length,0);
    }
    await assert.rejects(f.api.applyAnnualReview('other',f.input));
  }finally{await f.db.close();}
});
test('keep unchanged records completion without touching valuations or history',async()=>{
  const f=await fixture();try{
    await f.api.applyAnnualReview('owner',{...f.input,keepUnchanged:true});const s=await f.state();
    assert.equal(s.history.length,0);assert.equal(s.receipts[0].kept_unchanged,true);assert.equal(s.receipts[0].adjustment_percent,'0');assert.equal(s.assets.find(a=>a.id==='one').revision,'v1');
  }finally{await f.db.close();}
});
test('future years and prelaunch saves fail; next year can be reviewed again',async()=>{
  const f=await fixture();try{
    f.setYear(null);await assert.rejects(f.api.applyAnnualReview('owner',f.input),/1 January 2027/);
    f.setYear(2027);await assert.rejects(f.api.applyAnnualReview('owner',{...f.input,year:2028}),/year changed/);
    await f.api.applyAnnualReview('owner',{...f.input,keepUnchanged:true});
    f.setYear(2028);await f.api.applyAnnualReview('owner',{...f.input,year:2028,keepUnchanged:true});assert.equal((await f.state()).receipts.length,2);
  }finally{await f.db.close();}
});

test('API uses the authenticated account and never accepts a submitted owner identity',async()=>{
  const {NextRequest,NextResponse}=require('next/server');
  let session={user:{id:'signed-in',email:'owner@example.com'}},allowed=true,applied=[],loaded=[],originChecked=0;
  const api=load('app/api/annual-review/route.ts',{
    'next/server':{NextResponse},
    '../../../lib/auth-session':{getServerSession:async()=>session},
    '../../../lib/asset-register-account-access':{getAssetRegisterAccountAccess:async()=>allowed},
    '../../../lib/business-network-api':{businessBody:r=>r.json(),requireBusinessOrigin:r=>{originChecked++;if(r.headers.get('origin')!=='https://aim4price.com')throw Error('This request must be sent from Aim4price.');}},
    '../../../lib/annual-review-preview':{loadAnnualReview:async(...args)=>{loaded.push(args);return{rows:[]};}},
    '../../../lib/annual-review-policy':{...policy,liveReviewYear:()=>2027},
    '../../../lib/annual-review-live':{requireAnnualYear:y=>{if(y!==2027)throw Error('The review year changed.');return y;},annualReceipt:async()=>null,applyAnnualReview:async(...args)=>{applied.push(args);return{completed:true};}},
  });
  const req=(origin='https://aim4price.com')=>new NextRequest('https://aim4price.com/api/annual-review',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({action:'apply',year:2027,userId:'victim',email:'victim@example.com'})});
  assert.equal((await api.POST(req('https://evil.example'))).status,400);assert.equal(applied.length,0);
  session=null;assert.equal((await api.POST(req())).status,403);assert.equal(applied.length,0);
  session={user:{id:'signed-in',email:'owner@example.com'}};allowed=false;assert.equal((await api.POST(req())).status,403);assert.equal(applied.length,0);
  allowed=true;assert.equal((await api.POST(req())).status,200);assert.equal(applied[0][0],'signed-in');assert.equal(originChecked,4);
  await api.GET(new NextRequest('https://aim4price.com/api/annual-review?email=victim@example.com&year=2099'));
  assert.equal(loaded[0][1],2027);assert.equal(loaded[0][3],'signed-in');
});
