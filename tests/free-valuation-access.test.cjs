const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {publicValuationThrottle}=require('../lib/public-valuation-throttle.ts');
const request=ip=>({headers:new Headers({'x-real-ip':ip})});
test('normal repeated valuations have no cumulative allowance and burst limits expire',()=>{
 const req=request('test-normal');
 for(let minute=0;minute<20;minute++)for(let n=0;n<10;n++)assert.equal(publicValuationThrottle(req,'calculation',minute*60000),null);
});
test('automated calculation bursts receive a temporary retry response',async()=>{
 const req=request('test-burst');for(let n=0;n<90;n++)assert.equal(publicValuationThrottle(req,'calculation',0),null);
 const response=publicValuationThrottle(req,'calculation',1000);assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'59');
 assert.match((await response.json()).error,/remain free/);assert.equal(publicValuationThrottle(req,'calculation',60000),null);
 assert.equal(publicValuationThrottle(request('test-other'),'calculation',1000),null);
});
test('PDF burst protection is separate from calculating and missing proxy identity is not a global lockout',()=>{
 const req=request('test-report');for(let n=0;n<20;n++)assert.equal(publicValuationThrottle(req,'report',0),null);
 assert.equal(publicValuationThrottle(req,'report',0).status,429);assert.equal(publicValuationThrottle(req,'calculation',0),null);
 for(let n=0;n<100;n++)assert.equal(publicValuationThrottle({headers:new Headers()},'calculation',0),null);
});
test('public valuation UI has no guest quota or active-account lifetime barrier; saving remains gated',()=>{
 const client=fs.readFileSync('app/valuation/valuation-client.tsx','utf8');
 assert.doesNotMatch(client,/guestValuationCount|incrementGuestValuationCount|3 free estimates|!canUseAdvancedAssumptions/);
 assert.match(client,/const canSaveToAssetRegister = isSignedIn/);
 assert.match(client,/onClick={openFinalLifetimeModal}/);
 assert.match(client,/Value your assets for free/);
});
