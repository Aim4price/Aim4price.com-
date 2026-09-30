const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
function load(file,mocks){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(id=>id in mocks?mocks[id]:require(id),exports);return exports;}
const token='a'.repeat(43);
const lead={share:{senderName:'Private sender',assets:[{title:'Private tractor',serialNumber:'PRIVATE-SERIAL'}]},details:{recipientEmail:'private@example.test',request:'Private request'},reports:[{id:'report',label:'Private report'}]};
const mocks={
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
  assert.deepEqual(output.props.children[1].props,{returnTo:'/asset-share/'+token+'?open=1',access,prompt:false});
  const opened=await page.default({params:{token},searchParams:{open:'1'}});
  assert.equal(opened.props.children[1].type,'Landing');
  assert.equal(opened.props.children[1].props.prompt,true);
  assert.ok(!JSON.stringify(opened).includes('Private'));
 }
 for(const access of ['read-only','active','owner']){
  const page=load('app/asset-share/[token]/page.tsx',{...mocks,'../../../lib/external-lead-access':{externalLeadAccess:async()=>({access}),leadAllows:()=>true}});
  const landing=await page.default({params:{token}});
  assert.equal(landing.props.children[1].type,'Landing');
  const output=await page.default({params:{token},searchParams:{open:'1'}});
  assert.equal(output.props.children[1].props.share,lead.share);
 }
});
test('old invitation URLs redirect enquiries before serializing asset names',async()=>{
 const page=load('app/business-network/accept/page.tsx',{...mocks,'next/navigation':{redirect:path=>{throw Error(path);}}});
 await assert.rejects(page.default({searchParams:{share:token}}),{message:'/asset-share/'+token});
});
