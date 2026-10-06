const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
function load(file,mocks){const exports={};mocks={ '../../components/AccountDirectoryListing':{default:'DirectoryListing'}, '../business/business-client':{default:'BusinessDetails'}, '../../lib/business-accounts':{readBusinessAccount:async()=>({review:{website:'',evidence:''}})}, '../business/page.module.css':{default:{}}, ...mocks};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(id=>id in mocks?mocks[id]:require(id),exports);return exports;}
const token='a'.repeat(43);
const lead={share:{senderName:'Private sender',assets:[{title:'Private tractor',serialNumber:'PRIVATE-SERIAL'}]},details:{recipientEmail:'private@example.test',request:'Private request'},reports:[{id:'report',label:'Private report'}]};
const mocks={
 '../../../components/SharedEnquiryLive':{default:'Live'},
 '../../../components/SharedEnquiryLanding':{default:'Landing'},
 '../../../components/AppHeader':{default:'Header'},
 '../../../components/asset-register/SharedEnquiryRequest':{default:'Request'},
 '../../../components/asset-register/SharedAssetCards':{default:'AssetCards'},
 '../../../lib/guest-leads':{readLeadPage:async()=>lead},
 './page.module.css':{},
};
test('protected enquiry page keeps asset data behind access checks and shows the landing before opening',async()=>{
 for(const access of ['sign-in','wrong-recipient','verify-email','request-access','suspended','approval-required']){
  const page=load('app/asset-share/[token]/page.tsx',{...mocks,'../../../lib/external-lead-access':{externalLeadAccess:async()=>({access}),leadAllows:()=>true}});
  const output=await page.default({params:{token}});
  assert.equal(output.props.children[1].type,'Landing');
  assert.deepEqual(output.props.children[1].props,{returnTo:'/asset-share/'+token+'?open=1',access,prompt:false,summary:{senderName:'Private sender',umbrellaName:'',assetCount:1,assetTitles:['Private tractor']}});
  const opened=await page.default({params:{token},searchParams:{open:'1'}});
  assert.equal(opened.props.children[1].type,'Landing');
  assert.equal(opened.props.children[1].props.prompt,true);
  for(const secret of ['PRIVATE-SERIAL','private@example.test','Private request','Private report']) assert.ok(!JSON.stringify(opened).includes(secret));
 }
 for(const access of ['read-only','active','owner']){
  const page=load('app/asset-share/[token]/page.tsx',{...mocks,'../../../lib/external-lead-access':{externalLeadAccess:async()=>({access}),leadAllows:()=>true}});
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
 const page=load('app/asset-share/[token]/page.tsx',{...mocks,'../../../lib/guest-leads':{readLeadPage:async()=>grouped},'../../../lib/external-lead-access':{externalLeadAccess:async()=>({access:'sign-in'}),leadAllows:()=>true}});
 const output=await page.default({params:{token}});
 assert.deepEqual(output.props.children[1].props.summary,{senderName:'Private sender',umbrellaName:'Vehicles',assetCount:1,assetTitles:[]});
 assert.ok(!JSON.stringify(output).includes('PRIVATE-SERIAL'));
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

test('free Business and Dealer account pages open the real account with invoices without Desktop access',async()=>{
 for(const role of ['business','dealer']) {
  const profile={accountType:role,accountStatus:'active',userId:'shared-user'};
  const page=load('app/account/page.tsx',{
   '../../lib/auth-session':{getAnyServerSession:async()=>({user:{id:'shared-user'}})},
   '../../lib/account-profile':{getAccountProfile:async()=>profile,getAccountScanPinStatus:async()=>{throw Error('Shared account must not load paid QR controls');}},
   '../../lib/sharing-foundation':{sharingPlan:async()=> 'free'},
   '../../lib/account-access':{requireActivePageAccess:async()=>{throw Error('Shared account must not require Desktop');}},
   'next/navigation':{redirect:path=>{throw Error('redirect:'+path);}},
   './account-client':{default:'AccountClient'},
  });
  const result=await page.default();assert.equal(result.type,'AccountClient');assert.equal(result.props.initialProfile,profile);assert.equal(result.props.sharedAccount,true);assert.ok(result.props.sharedSettings);
 }
});
test('suspended free accounts still follow the account access block',async()=>{
 const page=load('app/account/page.tsx',{
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
