/* Desktop user access with synthetic data; no invitations are sent. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
let cssIndex=0;
const stubs={'components/WebsitePortal':'exports.createPortal=(children,target)=>require("react-dom").createPortal(children,target);','components/SwitchAccountButton':'module.exports=()=>null;'};
function cssModule(file){
 const prefix='c'+cssIndex+++'_',map={},sheet=postcss.parse(fs.readFileSync(path.join(root,file),'utf8'));
 sheet.walkRules(rule=>{
  const globals=[];let selector=rule.selector;
  while(selector.includes(':global(')){
   const start=selector.indexOf(':global(');let end=start+8,depth=1;
   for(;depth&&end<selector.length;end++){if(selector[end]==='(')depth++;else if(selector[end]===')')depth--;}
   const token='GLOBALTOKEN'+globals.length;
   globals.push(selector.slice(start+8,end-1));selector=selector.slice(0,start)+token+selector.slice(end);
  }
  selector=selector.replace(/\.([a-zA-Z_][\w-]*)/g,(_,name)=>{map[name]=prefix+name;return '.'+prefix+name;});
  globals.forEach((value,index)=>{selector=selector.replace('GLOBALTOKEN'+index,value);});
  rule.selector=selector;
 });
 sheets.push(sheet.toString());modules[file]='module.exports='+JSON.stringify(map);
}
function add(file){
 if(Object.hasOwn(modules,file))return;
 if(file.endsWith('.css')){cssModule(file);return;}
 if(stubs[file]){modules[file]=stubs[file];return;}
 const filename=['.tsx','.ts','.json',''].map(ext=>path.join(root,file+ext)).find(fs.existsSync);
 if(!filename)throw Error('Missing module '+file);
 if(filename.endsWith('.json')){modules[file]='module.exports='+fs.readFileSync(filename,'utf8');return;}
 modules[file]='';
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 modules[file]=code.replace(/require\(["']([^"']+)["']\)/g,(match,name)=>{
  if(!name.startsWith('.'))return match;
  const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),name));add(resolved);
  return 'require('+JSON.stringify(resolved)+')';
 });
}


add('app/account/team-access/team-access-client');
add('app/team/team-workspace-client');
add('components/team/TeamLogin');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';



(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],headless:true});
 fs.mkdirSync('.next/team-access-validation',{recursive:true});
 try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function mount(mode,width=1440){
  await page.goto('about:blank');
  await page.setViewport({width,height:1000});
  await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial;background:#f4f8f6}button,input{font:inherit}'+sheets.join('\n')+'</style><div id="app"></div>');
  await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
  await page.addScriptTag({content:runtime+`;
    const permissions={viewValues:false,editDetails:true,updateUsage:true,viewMaintenance:true,completeMaintenance:true,uploadDocuments:true,viewPhotos:false,uploadPhotos:false,exportAssets:true};
    const asset={id:'asset-a',registerId:'register-a',registerName:'Skimmelkrans Boerdery',title:'Landini Super 110',brand:'Landini',model:'Super 110',year:2024,serial:'VIN123',registration:'ABC123',condition:'good',usage:2741,usageMetric:'hours',photoCount:0};
    window.requests=[];window.revoked=false;window.showValues=false;
    window.fetch=async(url,init={})=>{window.requests.push({url:String(url),method:init.method||'GET',body:init.body});let response;
      if(url==='/api/team-access'&&init.method==='POST'){window.saved=JSON.parse(init.body);response={ok:true};}
      else if(url==='/api/team-access')response={businessId:'owner-a',members:[{id:'member-a',ownerId:'owner-a',email:'existing@example.com',displayName:'Existing user',status:'active',scope:'all',registerIds:[],assetIds:[],documentIds:[],permissions,expiresAt:null,version:1}],registers:[{id:'register-a',name:'Skimmelkrans Boerdery'}],assets:[{id:'asset-a',registerId:'register-a',title:'Landini Super 110'}],documents:[{id:'document-a',title:'Operator manual',assetIds:['asset-a']}],activity:[]};
      else if(url==='/api/team-workspaces')response={workspaces:[{id:'membership-a',name:'Skimmelkrans Boerdery',status:'active',permissions,expiresAt:null}]};
      else if(window.revoked)return {ok:false,json:async()=>({error:'Team access has been revoked.'})};
      else if(String(url).endsWith('/documents'))response={documents:[{id:'document-a',title:'Operator manual',fileName:'manual.pdf',assetIds:['asset-a']}]};
      else if(String(url).includes('/maintenance'))response={records:[{id:'maintenance-a',title:'Engine service',type:'service',status:'upcoming',statusLabel:'Upcoming',notes:'Change oil',dueDate:'2026-11-01'}]};
      else if(init.method==='PATCH'){window.updated=JSON.parse(init.body);response={ok:true};}
      else response={name:'Skimmelkrans Boerdery',permissions:{...permissions,viewValues:window.showValues},assets:[window.showValues?{...asset,values:{current:987654,replacement:1234567,insured:999999}}:asset],version:window.showValues?2:1};
      return {ok:true,json:async()=>response};
    };
    ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(require('${mode==='login'?'components/team/TeamLogin':mode==='owner'?'app/account/team-access/team-access-client':'app/team/team-workspace-client'}').default,{email:'staff@example.com',business:'owner-a'}));`});
 }
 async function click(text){await page.waitForFunction(t=>Array.from(document.querySelectorAll('button')).some(b=>!b.disabled&&(b.textContent.trim()===t||b.getAttribute('aria-label')===t)),{},text);await page.evaluate(t=>Array.from(document.querySelectorAll('button')).find(b=>!b.disabled&&(b.textContent.trim()===t||b.getAttribute('aria-label')===t)).click(),text);}
 async function fillLabel(label,value){await page.evaluate((label)=>{const node=Array.from(document.querySelectorAll('label')).find(l=>l.childNodes[0]?.textContent.trim()===label);node.querySelector('input,textarea').setAttribute('data-fill','true');},label);await page.locator('[data-fill=true]').fill(value);await page.$eval('[data-fill=true]',e=>e.removeAttribute('data-fill'));}
 async function assertFits(){assert(await page.$eval('[role=dialog]',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}),'Dialog bounds');}
 await mount('login');await fillLabel('Email address','staff@example.com');await fillLabel('Password','Initial-password-123');await page.evaluate(()=>{window.fetch=async(url,init)=>{window.loginRequest=JSON.parse(init.body);return {ok:false,json:async()=>({error:'Incorrect email or password.'})}}});await click('Sign in');await page.waitForFunction(()=>document.body.textContent.includes('Incorrect email or password.'));assert.deepEqual(await page.evaluate(()=>window.loginRequest),{email:'staff@example.com',password:'Initial-password-123',business:'owner-a'});
 await mount('owner');await click('Manage users');await assertFits();await click('Manage');await page.waitForFunction(()=>document.body.textContent.includes('Manage desktop user'));await click('Cancel');await page.waitForFunction(()=>document.body.textContent.includes('Choose a person to manage.'));await page.screenshot({path:'.next/team-access-validation/desktop-users-manager.png'});await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));await page.screenshot({path:'.next/team-access-validation/desktop-users-launcher.png'});await click('Add user');await fillLabel('Name','Workshop staff');await fillLabel('Email address','staff@example.com');await fillLabel('Initial password','Initial-password-123');await click('Continue');await click('Workshop');
 assert.equal(await page.evaluate(()=>Array.from(document.querySelectorAll('label')).find(l=>l.textContent.includes('View asset values')).querySelector('input').checked),false);
 await page.screenshot({path:'.next/team-access-validation/owner-permissions-desktop.png'});
 await click('Continue');await page.evaluate(()=>Array.from(document.querySelectorAll('label')).find(l=>l.textContent.trim()==='Skimmelkrans Boerdery').querySelector('input').click());await click('Continue');
 await page.evaluate(()=>Array.from(document.querySelectorAll('label')).find(l=>l.textContent.trim()==='Operator manual').querySelector('input').click());await assertFits();
 await click('Create user');await page.waitForFunction(()=>window.saved);const saved=await page.evaluate(()=>window.saved);assert.equal(saved.email,'staff@example.com');assert.equal(saved.password,'Initial-password-123');assert.equal(saved.permissions.viewValues,false);assert.deepEqual(saved.registerIds,['register-a']);assert.deepEqual(saved.documentIds,['document-a']);
 await page.setViewport({width:390,height:844});await click('Add user');await assertFits();await click('Permissions');await page.screenshot({path:'.next/team-access-validation/owner-permissions-mobile.png'});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
 await mount('member');await click('Open workspace');await click('Open asset →');await page.waitForSelector('[role=dialog]');await assertFits();assert.equal(await page.evaluate(()=>document.body.textContent.includes('987654')),false);
 await click('Edit permitted details');await fillLabel('Brand','Landini updated');await click('Save changes');await page.waitForFunction(()=>window.updated);assert.deepEqual(await page.evaluate(()=>window.updated.patch),{brand:'Landini updated'});
 await page.screenshot({path:'.next/team-access-validation/member-details-desktop.png'});await click('Maintenance');await page.waitForFunction(()=>document.body.textContent.includes('Engine service'));await click('Mark completed');await page.waitForSelector('textarea');await page.locator('textarea').fill('Changed engine oil and checked filters.');await fillLabel('Service company','Workshop');await fillLabel('Mechanic','Technician');await click('Confirm completed');await page.waitForFunction(()=>window.requests.some(r=>r.method==='POST'&&r.url.endsWith('/maintenance')));
 await click('Documents');await page.waitForFunction(()=>document.body.textContent.includes('Operator manual'));
 await page.setViewport({width:390,height:844});await assertFits();await page.screenshot({path:'.next/team-access-validation/member-documents-mobile.png'});await click('Done');
 await page.evaluate(()=>{window.revoked=true;window.dispatchEvent(new Event('focus'));});await page.waitForFunction(()=>document.body.textContent.includes('revoked'));
 assert.equal(await page.evaluate(()=>document.body.textContent.includes('Landini Super 110')),false,'Revoked workspace retained assets');
 assert.deepEqual(errors,[]);console.log('PASS owner permissions, scope and document selection, safe defaults, member editing and maintenance, responsive modals, and revoked workspace clearing');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
