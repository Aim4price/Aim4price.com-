const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file,mocks){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(id=>id in mocks?mocks[id]:require(id),exports);return exports;}
test('switching verifies the real session before clearing cache and navigating',async()=>{
 const originalFetch=global.fetch,originalWindow=global.window;
 try{
  let clear=0,redirects=[],calls=[];
  global.window={location:{replace:url=>redirects.push(url)}};
  const {switchWebsiteAccount}=load('lib/switch-website-account.ts',{'./header-session-cache':{clearCachedHeaderSession:()=>clear++}});
  global.fetch=async(url,options)=>{calls.push({url,options});return Response.json(null)};
  await switchWebsiteAccount();
  assert.deepEqual(calls.map(c=>c.url),['/api/auth/sign-out','/api/auth/get-session']);
  assert.equal(calls[0].options.method,'POST');
  assert.ok(calls.every(c=>c.options.credentials==='include'&&c.options.cache==='no-store'));
  assert.equal(clear,1);assert.deepEqual(redirects,['/auth#login']);
  for(const failure of ['signout','verification','still-signed-in','invalid-json']){
   clear=0;redirects=[];
   global.fetch=async url=>{
    if(url.endsWith('/sign-out'))return new Response(null,{status:failure==='signout'?503:200});
    if(failure==='verification')return new Response(null,{status:503});
    if(failure==='invalid-json')return new Response('bad json');
    return Response.json({user:{id:'blocked'},session:{id:'current'}});
   };
   await assert.rejects(switchWebsiteAccount());
   assert.equal(clear,0);assert.deepEqual(redirects,[]);
  }
 }finally{global.fetch=originalFetch;global.window=originalWindow;}
});
test('blocked login visits render a switch action instead of redirecting back to pending',async()=>{
 let status='suspended',signedIn=true,accountType='owner';
 const Switch=()=>null;
 const {default:Page}=load('app/auth/page.tsx',{
  '../../components/AppHeader':()=>null,'../../components/SwitchAccountButton':Switch,'./page.module.css':{},
  'next/navigation':{redirect:path=>{throw Error('redirect:'+path)}},
  '../../lib/account-access':{getAccountAccess:async()=>({isActive:status==='active',isAdmin:false})},
  '../../lib/account-profile':{getAccountProfile:async()=>({accountType})},
  '../../lib/auth-session':{getAnyServerSession:async()=>signedIn?{user:{id:'user',email:'test@example.test'}}:null},
  '../../lib/middleman-account':{isMiddlemanAccountSubtype:()=>false},'./auth-client':()=>null,
 });
 const hasSwitch=node=>!!node&&(node.type===Switch||[node.props?.children].flat().some(hasSwitch));
 for(status of ['suspended','pending_payment'])assert.ok(hasSwitch(await Page({})));
 status='active';await assert.rejects(Page({}),/redirect:\/asset-register/);
 assert.ok(hasSwitch(await Page({searchParams:{switchAccount:'1'}})));
 accountType='business';await assert.rejects(Page({}),/redirect:\/business/);
 signedIn=false;assert.ok(!hasSwitch(await Page({})));
});
