const test = require('node:test'), assert = require('node:assert/strict');
const load = require('./helpers/load-ts.cjs');
test('manual listing access checks active account and app marketplace permissions', async () => {
 let session = null, profile = { accountType:'owner', accountStatus:'active' }, dealerAllowed = true, ownerAllowed = true;
 const { getMarketplaceManualAccess: access } = load('lib/marketplace-manual-access.ts', {
  './auth-session': { getServerSession:async()=>session, isDealerAppSession:s=>!!s.dealerApp, isOwnerAppSession:s=>!!s.ownerApp },
  './account-profile': { getAccountProfile:async()=>profile },
  './dealer-app-access': { dealerRoleCan:(_role,permission)=>{assert.equal(permission,'marketplace'); return dealerAllowed;} },
  './owner-app-access': { getOwnerAppAccess:async()=>({}), ownerAppCan:(_access,permission)=>{assert.equal(permission,'manage_marketplace');return ownerAllowed;} },
 });
 assert.equal(await access(),null);
 session={user:{id:'seller'}};assert.equal((await access()).userId,'seller');
 profile.accountStatus='inactive';assert.equal(await access(),null);profile.accountStatus='active';
 profile.accountType='business';assert.equal(await access(),null);profile.accountType='dealer';
 session.dealerApp={role:'sales'};dealerAllowed=false;assert.equal(await access(),null);dealerAllowed=true;assert.ok(await access());
 delete session.dealerApp;profile.accountType='owner';session.ownerApp={};ownerAllowed=false;assert.equal(await access(),null);ownerAllowed=true;assert.ok(await access());
});
test('manual publication uses one seller-scoped listing and only dealers get a showroom', async () => {
 let access=null, showroomCalls=0, publishCalls=0;
 const {POST}=load('app/api/marketplace/manual/route.ts',{
  'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},
  '../../../../lib/marketplace-manual-access':{getMarketplaceManualAccess:async()=>access},
  '../../../../lib/advert-publication':{normalizeAdvertPublication:body=>body},
  '../../../../lib/marketplace-db':{publishStudioAdvert:async(user,input)=>{assert.equal(user,'seller');publishCalls++;return {id:input.id};}},
  '../../../../lib/middleman-showroom-db':{getOrCreateMiddlemanShowroom:async()=>{showroomCalls++;return {slug:'dealer',isPublic:false};}},
 });
 const req={headers:new Headers({origin:'https://example.com'}),nextUrl:{origin:'https://example.com'},json:async()=>({id:'draft-id'})};
 assert.equal((await POST(req)).status,403);
 access={userId:'seller',profile:{accountType:'owner'}};
 let result=await POST(req);assert.equal(result.status,200);assert.equal(result.body.showroomUrl,null);assert.equal(showroomCalls,0);
 access.profile.accountType='dealer';result=await POST(req);assert.equal(result.body.listing.id,'draft-id');assert.equal(result.body.showroomPublic,false);assert.equal(showroomCalls,1);assert.equal(publishCalls,2);
 assert.equal((await POST({...req,headers:new Headers({origin:'https://foreign.example'})})).status,403);assert.equal(publishCalls,2);
});
