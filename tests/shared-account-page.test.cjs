const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
function load(file,mocks){const exports={};mocks={ '../../components/BusinessCredits':{default:'BusinessCredits',getBusinessCredits:async()=>({workspace:{role:'owner',paid_since:null,upgrade_requested_at:null},balance:{limit:500,used:82,held:1}})}, '../../lib/accounting-pilot':{isAccountingPilotSession:()=>false}, '../../components/AccountDirectoryListing':{default:'DirectoryListing'}, '../business/business-client':{default:'BusinessDetails'}, '../../lib/business-accounts':{readBusinessAccount:async()=>({review:{website:'',evidence:''}})}, '../business/page.module.css':{default:{}}, ...mocks};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(id=>id in mocks?mocks[id]:require(id),exports);return exports;}
const token='a'.repeat(43);
const lead={share:{senderName:'Private sender',assets:[{title:'Private tractor',serialNumber:'PRIVATE-SERIAL'}]},details:{recipientEmail:'private@example.test',request:'Private request'},reports:[{id:'report',label:'Private report'}]};
const mocks={
 '../../../lib/dealer-maintenance-tracker':{listActiveDealerMaintenanceLeadAccess:async()=>[]},
 '../../../components/SharedEnquiryLive':{default:'Live'},
 '../../../components/SharedEnquiryLanding':{default:'Landing'},
 '../../../components/AppHeader':{default:'Header'},
 '../../../components/SharedAssetPasswordGate':{default:'PasswordGate'},
 '../../../components/asset-register/SharedEnquiryRequest':{default:'Request'},
 '../../../components/asset-register/SharedAssetCards':{default:'AssetCards'},
 '../../../lib/external-lead-access':{externalLeadAccess:async()=>({access:'sign-in'}),leadAllows:()=>true},
 '../../../lib/guest-leads':{readLeadPage:async()=>lead},
 '../../../lib/asset-share-links':{getAssetSharePasswordState:async()=>({exists:false,protected:false,unlocked:true})},
 './page.module.css':{},
};
test('protected enquiry page keeps asset data behind access checks and shows the landing before opening',async()=>{
 for(const access of ['sign-in','wrong-recipient','verify-email','request-access','suspended','approval-required']){
  const page=load('app/asset-share/[token]/AssetShareView.tsx',{...mocks,'../../../lib/external-lead-access':{externalLeadAccess:async()=>({access}),leadAllows:()=>true}});
  const output=await page.default({params:{token}});
  assert.equal(output.props.children[1].type,'Landing');
  assert.deepEqual(output.props.children[1].props,{returnTo:'/asset-share/'+token+'?open=1',access,prompt:false,summary:{senderName:'Private sender',umbrellaName:'',assetCount:1,assetTitles:['Private tractor']}});
  const opened=await page.default({params:{token},searchParams:{open:'1'}});
  assert.equal(opened.props.children[1].type,'Landing');
  assert.equal(opened.props.children[1].props.prompt,true);
  for(const secret of ['PRIVATE-SERIAL','private@example.test','Private request','Private report']) assert.ok(!JSON.stringify(opened).includes(secret));
 }
 for(const access of ['read-only','active','owner']){
  const page=load('app/asset-share/[token]/AssetShareView.tsx',{...mocks,'../../../lib/external-lead-access':{externalLeadAccess:async()=>({access}),leadAllows:()=>true}});
  const landing=await page.default({params:{token}});
  assert.equal(landing.props.children[1].type,'Landing');
  const output=await page.default({params:{token},searchParams:{open:'1'}});
  assert.equal(output.props.children[2].props.share,lead.share);
 }
});
test('old invitation URLs redirect enquiries before serializing asset names',async()=>{
 const page=load('app/business-network/accept/page.tsx',{...mocks,'next/navigation':{redirect:path=>{throw Error(path);}}});
 await assert.rejects(page.default({searchParams:{share:token}}),{message:'/asset-share/'+token});
});

test('umbrella landing identifies the group without serializing the member records',async()=>{
 const grouped={...lead,share:{...lead.share,umbrellaName:'Vehicles'}};
 const page=load('app/asset-share/[token]/AssetShareView.tsx',{...mocks,'../../../lib/guest-leads':{readLeadPage:async()=>grouped},'../../../lib/external-lead-access':{externalLeadAccess:async()=>({access:'sign-in'}),leadAllows:()=>true}});
 const output=await page.default({params:{token}});
 assert.deepEqual(output.props.children[1].props.summary,{senderName:'Private sender',umbrellaName:'Vehicles',assetCount:1,assetTitles:[]});
 assert.ok(!JSON.stringify(output).includes('PRIVATE-SERIAL'));
});

test('malformed asset share tokens stop before password or database checks',async()=>{
 let passwordChecks=0,leadReads=0;
 const page=load('app/asset-share/[token]/AssetShareView.tsx',{...mocks,
  '../../../lib/asset-share-links':{getAssetSharePasswordState:async()=>{passwordChecks++;return{exists:false,protected:false,unlocked:true};}},
  '../../../lib/guest-leads':{readLeadPage:async()=>{leadReads++;return null;}},
 });
 const output=await page.default({params:{token:'invalid'}});
 assert.equal(output.props.children[1].type,'AssetCards');
 assert.equal(output.props.children[1].props.share,null);
 assert.equal(passwordChecks,0);
 assert.equal(leadReads,0);
});

test('signed-in free Dealers return to their enquiry or hub instead of the unpaid-account screen',async()=>{
 let status='pending_payment';
 const page=load('app/auth/page.tsx',{
  '../../lib/sharing-foundation':{sharingPlan:async()=> 'free'},
  '../../lib/external-share-permissions':load('lib/external-share-permissions.ts',{}),
  '../../components/AppHeader':{default:'Header'},'../../components/SwitchAccountButton':{default:'Switch'},'./page.module.css':{default:{}},
  'next/navigation':{redirect:path=>{throw Error(path);}},
  '../../lib/account-access':{getAccountAccess:async()=>({isActive:false})},
  '../../lib/account-profile':{getAccountProfile:async()=>({accountType:'dealer',accountStatus:status})},
  '../../lib/auth-session':{getAnyServerSession:async()=>({user:{id:'free',email:'free@example.test'}})},
  '../../lib/middleman-account':{},'./auth-client':{default:'Auth'},
 });
 await assert.rejects(page.default({searchParams:{returnTo:'/asset-share/'+token+'?open=1'}}),{message:'/asset-share/'+token+'?open=1'});
 await assert.rejects(page.default({}),{message:'/shared-enquiries'});
 assert.ok(await page.default({searchParams:{switchAccount:'1'}}));
 status='suspended';assert.ok(await page.default({}));
});

test('resend verification uses the signed-in email and a safe return destination',async()=>{
 let session=null,sent=null,limited=0;
 const route=load('app/api/shared-account/verification/route.ts',{
  '../../../../lib/auth-session':{getAnyServerSession:async()=>session},
  '../../../../lib/auth':{auth:{api:{sendVerificationEmail:async value=>{sent=value.body;}}}},
  '../../../../lib/external-share-permissions':load('lib/external-share-permissions.ts',{}),
  '../../../../lib/trusted-request-origin':{isTrustedRequestOrigin:(a,b)=>a===b},
  '../../../../lib/business-network':{limitBusinessAction:async()=>{limited++;}},
 });
 const request=(body={},origin='https://aim4price.test')=>new Request('https://aim4price.test/api/shared-account/verification',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await route.POST(request())).status,401);
 session={user:{id:'free',email:'real@example.test'}};
 assert.equal((await route.POST(request({},'https://evil.test'))).status,403);
 assert.equal((await route.POST(request({email:'forged@example.test',returnTo:'https://evil.test'}))).status,200);
 assert.deepEqual(sent,{email:'real@example.test',callbackURL:'/shared-enquiries'});
 const returnTo='/asset-share/'+token+'?open=1';
 assert.equal((await route.POST(request({returnTo}))).status,200);
 assert.equal(sent.callbackURL,returnTo);assert.equal(limited,2);
});

test('free Business and Business account pages open the real account with invoices without Desktop access',async()=>{
 for(const role of ['business','dealer']) {
  const profile={accountType:role,accountStatus:'active',userId:'shared-user'};
  const page=load('app/account/page.tsx',{
  '../../lib/middleman-account':load('lib/middleman-account.ts',{}),
   '../../lib/team-login':{getManagedTeamActor:async()=>null},
   '../../lib/team-access':{canManageTeamAccess:async()=>false},
   '../../lib/auth-session':{getAnyServerSession:async()=>({user:{id:'shared-user'}})},
   '../../lib/account-profile':{getAccountProfile:async()=>profile,getAccountScanPinStatus:async()=>{throw Error('Shared account must not load paid QR controls');}},
   '../../lib/sharing-foundation':{sharingPlan:async()=> 'free'},
   '../../lib/account-access':{requireActivePageAccess:async()=>{throw Error('Shared account must not require Desktop');}},
   'next/navigation':{redirect:path=>{throw Error('redirect:'+path);}},
   './account-client':{default:'AccountClient'},
  });
  const result=await page.default();assert.equal(result.type,'AccountClient');assert.equal(result.props.initialProfile,profile);assert.equal(result.props.sharedAccount,true);assert.equal(result.props.canManageDesktopUsers,false);assert.equal(result.props.sharedSettings,undefined);if(role==='business')assert.equal(result.props.subscription.remaining,417);
 }
});
test('suspended free accounts still follow the account access block',async()=>{
 const page=load('app/account/page.tsx',{
  '../../lib/middleman-account':load('lib/middleman-account.ts',{}),
   '../../lib/team-login':{getManagedTeamActor:async()=>null},
   '../../lib/team-access':{canManageTeamAccess:async()=>false},
  '../../lib/auth-session':{getAnyServerSession:async()=>({user:{id:'shared-user'}})},
  '../../lib/account-profile':{getAccountProfile:async()=>({accountType:'business',accountStatus:'suspended'})},
  '../../lib/sharing-foundation':{sharingPlan:async()=> 'free'},
  '../../lib/account-access':{},'next/navigation':{redirect:path=>{throw Error('redirect:'+path);}},'./account-client':{default:'AccountClient'},
 });
 await assert.rejects(page.default(),/redirect:\/pending-payment/);
});

test('free Business login defaults to Shared enquiries while preserving explicit asset links',async()=>{
 const page=load('app/auth/page.tsx',{
  '../../lib/sharing-foundation':{sharingPlan:async()=> 'free'},
  '../../lib/external-share-permissions':load('lib/external-share-permissions.ts',{}),
  '../../components/AppHeader':{default:'Header'},'../../components/SwitchAccountButton':{default:'Switch'},'./page.module.css':{default:{}},
  'next/navigation':{redirect:path=>{throw Error(path);}},
  '../../lib/account-access':{getAccountAccess:async()=>({isActive:true})},
  '../../lib/account-profile':{getAccountProfile:async()=>({accountType:'business',accountStatus:'active'})},
  '../../lib/auth-session':{getAnyServerSession:async()=>({user:{id:'free',email:'free@example.test'}})},
  '../../lib/middleman-account':{},'./auth-client':{default:'Auth'},
 });
 await assert.rejects(page.default({}),{message:'/business'});
 await assert.rejects(page.default({searchParams:{returnTo:'/asset-share/'+token+'?open=1'}}),{message:'/asset-share/'+token+'?open=1'});
});

test('guests can browse standard links while recipient and approval restrictions still apply', async()=>{
 for(const [details,publicView] of [
  [null,true],[{accessMode:'signed-in',permissions:{}},true],
  [{accessMode:'owner-approval'},false],[{accessMode:'signed-in',recipientUserId:'invited'},false],
  [{recipientWhatsApp:'+27111111111'},false],[{recipientEmail:'invited@example.test'},false],
 ]) {
  const page=load('app/asset-share/[token]/AssetShareView.tsx',{...mocks,'../../../lib/guest-leads':{readLeadPage:async()=>({...lead,details})}});
  const landing=await page.default({params:{token}});
  assert.equal(landing.props.children[1].props.access,publicView?'guest-view':'sign-in');
  const opened=await page.default({params:{token},searchParams:{open:'1'}});
  if(publicView){
   const cards=opened.props.children[2];
   assert.equal(cards.props.share,lead.share);
   assert.equal(opened.props.children[1].props.recordActivity,false);
   if(details){assert.equal(cards.props.enquiry.access,'sign-in');assert.deepEqual(cards.props.enquiry.reports,[]);}
  }else{assert.equal(opened.props.children[1].type,'Landing');}
 }
});

test('Business opens its inbox directly and only reads shares for active verified recipients',async()=>{
 let verified=true, paused=false, reads=0;
 const link='/asset-share/'+token+'?open=1';
 const page=load('app/business/page.tsx',{
  '../asset-share/[token]/AssetShareView':{default:'AssetShareView'},
  '../../components/AppHeader':{default:'Header'},
  './BusinessSharedAssets':{default:'Inbox'},
  '../../lib/guest-leads':{listReceivedSharedEnquiries:async()=>{reads++;return ['share'];}},
  '../../lib/auth-session':{getServerSession:async()=>({user:{id:'business',emailVerified:verified}})},
  '../../lib/business-accounts':{readBusinessAccount:async()=>({profile:{accountType:'business',accountStatus:'active'}})},
  '../../lib/business-workspaces':{businessWorkspaceSummary:async()=>({suspended:paused})},
  '../../lib/external-share-permissions':{sharedEnquiryReturnTo:value=>value===link?link:null},
  'next/navigation':{redirect:path=>{throw Error(path);}}
 });
 const inbox=async()=> (await page.default({})).props.children[1].props;
 assert.deepEqual(await inbox(),{shares:['share'],notice:''});
 await assert.rejects(page.default({searchParams:{returnTo:link}}),{message:link});
 verified=false;assert.deepEqual((await inbox()).shares,[]);
 paused=true;verified=true;assert.match((await inbox()).notice,/paused/);
 assert.equal(reads,1);
});

test('Admin opening a Free Business account sees that user’s subscription and credits', async () => {
  const profile = {accountType:'business', accountStatus:'active'};
  const page = load('app/account/page.tsx', {
    '../../lib/auth-session':{getAnyServerSession:async()=>({user:{id:'admin'}})},
    '../../lib/account-access':{requireActivePageAccess:async()=>({session:{user:{id:'client'}}})},
    '../../lib/account-profile':{getAccountProfile:async user=>user.id==='client'?profile:{accountType:'owner'}},
    '../../lib/team-login':{getManagedTeamActor:async()=>null},
    '../../lib/team-access':{canManageTeamAccess:async()=>true},
    '../../lib/sharing-foundation':{sharingPlan:async()=> 'desktop'},
    '../../lib/middleman-account':load('lib/middleman-account.ts',{}),
    '../../components/BusinessCredits':{default:'Credits',getBusinessCredits:async id=>{
      assert.equal(id,'client');
      return {workspace:{role:'owner'},balance:{limit:500,used:3,held:2}};
    }},
    'next/navigation':{redirect:path=>assert.fail(path)},
    './account-client':{default:'AccountClient'},
  });
  const {props} = await page.default();
  assert.equal(props.initialProfile,profile);
  assert.equal(props.sharedAccount,true);
  assert.equal(props.canManageDesktopUsers,false);
  assert.equal(props.subscription.fullAccess,false);
  assert.equal(props.subscription.remaining,495);
});

test('opening an inbox member inline keeps the selected asset and applies the share access checks',async()=>{
 const id='bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb';
 const grouped={...lead,ownerId:'owner',share:{...lead.share,assets:[{assetId:id,title:'Tractor'}]}};
 for(const access of ['active','read-only','wrong-recipient']){
  const view=load('app/asset-share/[token]/AssetShareView.tsx',{...mocks,
   '../../../lib/dealer-maintenance-tracker':{listActiveDealerMaintenanceLeadAccess:async input=>{
    assert.deepEqual(input,{dealerUserId:'receiver',leads:[{ownerUserId:'owner',assetId:id}]});
    return [{accessId:'tracking',hasMaintenanceRecords:access==='active'}];
   }},
   '../../../lib/guest-leads':{readLeadPage:async()=>grouped},
   '../../../lib/external-lead-access':{externalLeadAccess:async()=>({access,user:{id:'receiver'}}),leadAllows:()=>false}});
  const result=await view.default({inline:true,params:{token},searchParams:{open:'1',asset:id}});
  assert.equal(result.props.children[0],null);
  if(access==='wrong-recipient') assert.equal(result.props.children[1].type,'Landing');
  else {
   const card=result.props.children[2];
   assert.equal(card.type,'AssetCards');assert.equal(card.props.initialAssetId,id);
   assert.equal(card.props.canRemove,true);
   assert.equal(card.props.trackingAccessId,access==='active'?'tracking':undefined);
   assert.equal(card.props.inline,true);assert.equal(card.props.enquiry.access,access);
  }
 }
});
