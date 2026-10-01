const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
function load(file,mocks){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(id=>id in mocks?mocks[id]:require(id),exports);return exports;}
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
