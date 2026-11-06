const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports',js)(name=>name in mocks?mocks[name]:require(name),exports);
  return exports;
}
const {readAnnualReviewBody,ANNUAL_REVIEW_BODY_LIMIT}=load('lib/annual-review-request.ts');
test('large account confirmation fits; oversized, chunked and malformed requests fail',async()=>{
  const assets=Array.from({length:10000},(_,i)=>({id:`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`,revision:'2026-12-31T10:00:00.000Z',proposedValue:1234567.89,replacementPrice:2345678.91}));
  const payload={action:'apply',year:2027,percent:3,keepUnchanged:false,assets};
  const request=body=>new Request('https://example.com',{method:'POST',body});
  assert.equal((await readAnnualReviewBody(request(JSON.stringify(payload)))).assets.length,10000);
  for(const body of ['[]','null','{}broken','"string"'])await assert.rejects(readAnnualReviewBody(request(body)),/Invalid/);
  await assert.rejects(readAnnualReviewBody(request('x'.repeat(ANNUAL_REVIEW_BODY_LIMIT+1))),/too large/);
  let cancelled=false;
  const stream=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(500000));},cancel(){cancelled=true;}});
  await assert.rejects(readAnnualReviewBody(new Request('https://example.com',{method:'POST',body:stream,duplex:'half'})),/too large/);
  assert.equal(cancelled,true);
});
test('concurrent transactions stay on their own connection and release async scope after success or failure',async()=>{
  const previous=global.aim4pricePool;
  let poolQueries=0;
  const pool={query:async()=>{poolQueries++;return 'pool';},connect:()=>{throw Error('pool exhausted');}};
  global.aim4pricePool=pool;
  try {
    const api=load('lib/db.ts',{'pg':{Pool:class {}}});
    const clients=Array.from({length:20},(_,id)=>({query:async()=>id}));
    await Promise.all(clients.map((client,id)=>api.withDatabaseClient(client,async()=>{
      // Yield to interleave every account before any valuation read runs.
      await new Promise(resolve=>setImmediate(resolve));
      assert.equal(await api.getDb().query('select'),id);
      assert.throws(()=>api.getDb().connect(),/outer transaction/);
    })));
    assert.equal(poolQueries,0,'no extra pool connection needed even when the pool is full');
    await assert.rejects(api.withDatabaseClient(clients[0],async()=>{throw Error('rollback');}),/rollback/);
    assert.equal(api.getDb(),pool);
    assert.equal(await api.getDb().query('select'),'pool');
    assert.equal(poolQueries,1);
  }finally{global.aim4pricePool=previous;}
});
