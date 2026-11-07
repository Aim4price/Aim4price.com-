/* Owner login management with synthetic users and mocked APIs; no real writes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
let cssIndex=0;
const stubs={'components/AppHeader':'module.exports=()=>null;'};
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


add('app/account/app-access-management-client');
sheets.push(fs.readFileSync(path.join(root,'app/modal-close.css'),'utf8'));
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';

(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});
 try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.LOGIN_BROWSER_CPU_RATE)await page.emulateCPUThrottling(Number(process.env.LOGIN_BROWSER_CPU_RATE));
 let confirm=true;page.on('dialog',dialog=>confirm?dialog.accept():dialog.dismiss());
 await page.setViewport({width:1280,height:900});
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial;background:#eef4ef}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:`${runtime}
 window.requests=[];window.failSave=false;
 let users=[{id:'one',displayName:'George Jnr',username:'jnr@skb',accessRole:'admin',isActive:true,lastLoginAtIso:null,updatedAtIso:'2026-10-08T08:26:00Z'}, {id:'two',displayName:'Gerald',username:'gerald@skb',accessRole:'view_only',isActive:true,lastLoginAtIso:null,updatedAtIso:'2026-10-08T08:26:00Z'}];
 users.push({...users[1],id:'three',displayName:'Alex',username:'alex@skb',isActive:false});
 let settings={assetScope:'selected',assetIds:[],groupIds:[]};
 window.fetch=async(url,options={})=>{
 const method=options.method||'GET',body=options.body?JSON.parse(options.body):null;window.requests.push({url,method,body});
 let data={ok:true};let ok=true;
 if(url==='/api/account/app-login-name')data={ok:true,accountName:'skb',suggestedName:'skb'};
 else if(url==='/api/owner-app/users')data={ok:true,users};
 else if(url.endsWith('/access')){if(method==='PUT'){if(window.holdAccess)await new Promise(resolve=>window.releaseAccess=resolve);settings=body;}data={ok:true,settings,assets:[{id:'tractor',title:'Tractor',kind:'Tractor',registerId:'register-a'}],registers:[{id:'register-a',name:'Farm register'}],groups:[{id:'farm',name:'Farm equipment',memberCount:2,memberAssetIds:['tractor']}]};}
 else if(method==='PATCH'){if(window.failSave){ok=false;data={ok:false,error:'Username is already in use.'};}else{users=users.map(u=>url.endsWith(u.id)?{...u,...body}:u);data={ok:true,user:users.find(u=>url.endsWith(u.id))};}}
 else if(method==='DELETE')users=users.filter(u=>!url.endsWith(u.id));
 return {ok,json:async()=>data};};
 ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(require('app/account/app-access-management-client').OwnerAppAccessManagement));`});
 async function click(text){await page.waitForFunction(text=>Array.from(document.querySelectorAll('button')).some(b=>(b.textContent.trim()===text||b.getAttribute('aria-label')===text)&&!b.matches(':disabled')),{},text);await page.evaluate(text=>{const b=Array.from(document.querySelectorAll('button')).find(b=>(b.textContent.trim()===text||b.getAttribute('aria-label')===text)&&!b.matches(':disabled'));b.click();},text);}
 async function card(title){await page.waitForFunction(title=>Array.from(document.querySelectorAll('button')).some(b=>b.querySelector('strong')?.textContent===title&&!b.disabled),{},title);await page.evaluate(title=>Array.from(document.querySelectorAll('button')).find(b=>b.querySelector('strong')?.textContent===title).click(),title);}
 async function heading(title){console.log('Checking screen:',title);await page.waitForFunction(title=>Array.from(document.querySelectorAll('h3')).some(h=>h.textContent===title),{},title);}
 async function fill(label,value){const input=await page.evaluateHandle(label=>Array.from(document.querySelectorAll('label')).find(l=>l.textContent.startsWith(label))?.querySelector('input'),label);await input.click({clickCount:3});await input.press('Backspace');await input.type(value);}
 async function patch(){return page.evaluate(()=>window.requests.filter(r=>r.method==='PATCH').at(-1).body);}
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Manage logins')));
 fs.mkdirSync('.next/owner-ui-review',{recursive:true});
 for (const viewport of [{width:1366,height:768},{width:1920,height:900},{width:390,height:844}]) {
   await page.setViewport(viewport);
   await page.screenshot({path:'.next/owner-ui-review/launcher-'+viewport.width+'.png'});
   await page.evaluate(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Add login')).click());
   await page.waitForSelector('[role="dialog"] input');
   await page.evaluate(()=>Promise.allSettled(document.getAnimations().map(a=>a.finished)));
   assert(await page.$eval('[role="dialog"]',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}),'Modal fits width');
   if(viewport.width>640) assert(await page.$eval('[role="dialog"]',el=>Array.from(el.querySelectorAll('*')).every(e=>!['auto','scroll'].includes(getComputedStyle(e).overflowY)||e.scrollHeight<=e.clientHeight+1)),'Desktop create dialog has no internal scroll');
   await page.screenshot({path:'.next/owner-ui-review/create-'+viewport.width+'.png'});
   await page.click('[aria-haspopup="listbox"]');
   await page.waitForSelector('[role="listbox"]');
   await new Promise(r=>setTimeout(r,100));
   assert(await page.$eval('[role="listbox"]',el=>{const r=el.getBoundingClientRect(),b=document.querySelector('[aria-haspopup="listbox"]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&(r.bottom<=b.top||r.top>=b.bottom);}), 'Access menu aligns with field and stays in viewport');
   if(viewport.width>640) assert(await page.$eval('[role="listbox"]',el=>el.scrollHeight<=el.clientHeight+1),'All access options fit without scrolling');
   await page.screenshot({path:'.next/owner-ui-review/access-'+viewport.width+'.png'});
   await page.evaluate(()=>Array.from(document.querySelectorAll('[role="option"]')).find(b=>b.textContent.includes('View only')).click());
   assert(await page.$eval('[aria-haspopup="listbox"]',e=>e.textContent.includes('View only')));
   await click('Show passcode');assert.equal(await page.$eval('input[autocomplete="new-password"]',e=>e.type),'text');
   await click('Hide passcode');assert.equal(await page.$eval('input[autocomplete="new-password"]',e=>e.type),'password');
   await click('Cancel');
 }
 await page.setViewport({width:1280,height:900});
 await page.evaluate(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Manage logins')).click());
 for (const viewport of [{width:1366,height:768},{width:1920,height:1080},{width:390,height:844}]) {
   await page.setViewport(viewport);
   await page.waitForSelector('button[aria-label="Manage George Jnr"]');
   await page.evaluate(()=>Promise.allSettled(document.getAnimations().map(a=>a.finished)));
   const layout=await page.evaluate(()=>{
     const rows=Array.from(document.querySelectorAll('[role="dialog"] article'));
     return rows.map(row=>{
       const r=row.getBoundingClientRect(),button=row.querySelector('button'),b=button.getBoundingClientRect(),name=row.querySelector('strong').getBoundingClientRect();
       return {height:r.height,aligned:b.top<name.bottom&&b.bottom>name.top,fits:b.left>=r.left&&b.right<=r.right,overflow:row.scrollWidth>row.clientWidth+1};
     });
   });
   assert.equal(layout.length,3);
   assert(layout.every(row=>row.fits&&!row.overflow),'Directory controls stay inside their row');
   if(viewport.width>640){
     assert(layout.every(row=>row.aligned&&row.height<110),'Desktop identity and actions share a compact row');
     assert(await page.$eval('[role="dialog"] article',row=>row.parentElement.scrollHeight<=row.parentElement.clientHeight+1),'Three desktop logins fit without a list scrollbar');
   }
   await page.screenshot({path:'.next/owner-ui-review/directory-'+viewport.width+'.png'});
 }
 await page.setViewport({width:1280,height:900});
 const supportStyle = await page.$eval('[role="dialog"] header p',el=>{const s=getComputedStyle(el);return [s.fontFamily,s.fontSize,s.fontWeight,s.lineHeight,s.color];});
 await click('Manage George Jnr');await heading('Login details');
 assert.deepEqual(await page.$$eval('nav[aria-label="Login settings"] button',els=>els.map(el=>el.textContent.trim())),['All users','Login details','Permissions','Asset access','Passcode','Login status']);
 assert.equal(await page.evaluate(()=>Array.from(document.querySelectorAll('[role="dialog"] button')).some(b=>b.textContent==='Delete')),false);
 fs.mkdirSync('.next/owner-login-validation',{recursive:true});
 await page.evaluate(()=>Promise.allSettled(document.getAnimations().map(a=>a.finished)));
 await page.screenshot({path:'.next/owner-login-validation/overview-desktop.png'});
 await page.setViewport({width:390,height:844});
 assert(await page.$eval('[role="dialog"]',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}));
 await page.screenshot({path:'.next/owner-login-validation/overview-mobile.png'});
 await page.setViewport({width:1280,height:900});
 await click('Asset access');assert(await page.evaluate(()=>document.body.textContent.includes('Full access to all assets')));
 assert.equal(await page.$$eval('input[type="checkbox"]',els=>els.length),0);await click('Login details');
 await click('Permissions');await page.click('label:has(input[value="operations"])');await click('Save access');await heading('Permissions');assert.deepEqual(await patch(),{accessRole:'operations'});
 await click('Asset access');await card('Umbrellas');await page.waitForSelector('dialog[open] input[type="checkbox"]');await page.click('dialog[open] input[type="checkbox"]');await click('Confirm selection');
 await card('Registers');await page.waitForSelector('dialog[open] input[type="checkbox"]');await page.click('dialog[open] input[type="checkbox"]');await click('Cancel');
 await card('Registers');assert.equal(await page.$eval('dialog[open] input[type="checkbox"]',e=>e.checked),false);await page.click('dialog[open] input[type="checkbox"]');await click('Confirm selection');
 await card('Choose assets');await page.waitForSelector('dialog[open] input[type="checkbox"]');await page.click('dialog[open] input[type="checkbox"]');await page.screenshot({path:'.next/owner-login-validation/asset-picker.png'});await click('Confirm selection');
 assert(await page.evaluate(()=>document.body.textContent.includes('1 asset included')));
 await card('Umbrellas');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));await heading('Asset access');
 await page.screenshot({path:'.next/owner-login-validation/asset-access.png'});
 await page.setViewport({width:390,height:844});await card('Choose assets');
 assert(await page.$eval('dialog[open]',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}));
 await page.screenshot({path:'.next/owner-login-validation/picker-mobile.png'});await click('Cancel');await page.setViewport({width:1280,height:900});
 await page.evaluate(()=>window.holdAccess=true);await click('Save access');await page.waitForFunction(()=>document.querySelector('[data-modal-close]').disabled);await page.evaluate(()=>{window.holdAccess=false;window.releaseAccess();});await page.waitForFunction(()=>document.body.textContent.includes('Access saved.'));assert.deepEqual(await page.evaluate(()=>window.requests.filter(r=>r.method==='PUT').at(-1).body),{assetScope:'selected',assetIds:['tractor'],groupIds:['farm'],registerIds:['register-a']});
 await click('Passcode');await fill('New passcode','4321');await click('Save access');await page.waitForFunction(()=>document.querySelector('input[autocomplete="new-password"]').value==='');assert.deepEqual(await patch(),{password:'4321'});
 await click('Login details');await fill('Display name','George Junior');await page.evaluate(()=>window.failSave=true);await click('Save access');await page.waitForFunction(()=>document.body.textContent.includes('Username is already in use.'));await heading('Login details');
 await page.evaluate(()=>window.failSave=false);await click('Save access');await heading('Login details');assert.deepEqual(await patch(),{displayName:'George Junior',username:'jnr@skb'});
 await click('Login details');await fill('Display name','Unsaved');confirm=false;await click('Permissions');await heading('Login details');confirm=true;await click('Permissions');await heading('Permissions');
 await click('Login status');await click('Deactivate');await page.waitForFunction(()=>document.querySelector('[data-active="false"]'));await click('Activate');await page.waitForFunction(()=>document.querySelector('[data-active="true"]'));
 confirm=false;await click('Delete');assert.equal(await page.evaluate(()=>window.requests.filter(r=>r.method==='DELETE').length),0);confirm=true;await click('Delete');await page.waitForFunction(()=>!document.body.textContent.includes('Manage George Junior'));
 await page.evaluate(()=>{document.getElementById('app').remove();const host=document.createElement('div');host.id='other-app';document.body.append(host);});
 // Exercise every app against the same section flow, using its existing API contract.
 for (const kind of ['field','dealer','middleman']) {
   console.log('Checking app:',kind);
   await page.evaluate(kind => {
     window.requests=[];
     window.appUser={id:'staff-one',displayName:'Alex',username:'alex@skb',role:'sales',isActive:true,lastLoginAtIso:null,updatedAtIso:'2026-10-08T08:26:00Z'};
     window.appSettings={assetScope:'selected',fuelScope:'selected',canRecordWork:true,canScheduleMaintenance:true,canRecordFuel:true,canRefillFuel:false,assetIds:[],groupIds:[],fuelStorageIds:['tank']};
     window.fetch=async(url,options={})=>{
       const method=options.method||'GET',body=options.body?JSON.parse(options.body):null;
       window.requests.push({url,method,body});
       let data={ok:true};
       if(url==='/api/account/app-login-name')data={ok:true,accountName:'skb'};
       else if(url.endsWith('/access')) {if(method==='PUT')window.appSettings=body;data={ok:true,settings:window.appSettings,assets:[{id:'tractor',title:'Tractor',kind:'Tractor'}],groups:[{id:'farm',name:'Farm',memberCount:1,memberAssetIds:['tractor']}],storages:[{id:'tank',name:'Diesel tank',locationLabel:'Yard'}]};}
       else if(method==='PATCH'){window.appUser={...window.appUser,...body};data={ok:true,[kind==='field'?'manager':'staff']:window.appUser};}
       else data={ok:true,[kind==='field'?'managers':'staff']:[window.appUser]};
       // Exercise asynchronous saves/loads: navigation must wait for enabled controls.
       if(kind==='field')await new Promise(resolve=>setTimeout(resolve,75));
       return {ok:true,json:async()=>data};
     };
     const exports=require('app/account/app-access-management-client');
     ReactDOM.render(React.createElement(kind==='field'?exports.FieldManagerAppAccessManagement:exports.DealerAppAccessManagement,{key:kind,middlemanMode:kind==='middleman'}),document.getElementById('other-app'));
   },kind);
   await page.waitForFunction(()=>document.body.textContent.includes('Manage logins'));
   await page.evaluate(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Manage logins')).click());
   if(kind==='field') {
     await page.waitForSelector('input[type="search"]',{visible:true});
     // Let the modal's opening focus frame finish before sending keyboard input.
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     await page.click('input[type="search"]');await page.type('input[type="search"]','missing');
     await page.waitForFunction(()=>document.querySelector('input[type="search"]')?.value==='missing'&&document.body.textContent.includes('No matching logins.'));
     assert.equal(await page.$$eval('button[aria-label="Manage Alex"]',buttons=>buttons.length),0,'Unmatched search hides the login');
     await page.$eval('input[type="search"]',el=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'alex');el.dispatchEvent(new Event('input',{bubbles:true}));});
     await page.waitForSelector('button[aria-label="Manage Alex"]');
     await click('Business login settings');await click('All logins');await click('Manage Alex');await heading('Login details');
     assert.equal(await page.$$eval('nav[aria-label="Login settings"] button',els=>els.length),6);
     assert(!await page.evaluate(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='‹ Back')));
     for(const viewport of [{width:1366,height:768},{width:390,height:844}]) {
       await page.setViewport(viewport);
       assert(await page.$eval('[role="dialog"]',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}),'Field dialog fits viewport');
       if(viewport.width>640) assert(await page.$eval('[role="dialog"]',el=>Array.from(el.querySelectorAll('*')).every(e=>!['auto','scroll'].includes(getComputedStyle(e).overflowY)||e.scrollHeight<=e.clientHeight+1)),'Desktop details fit without internal scroll');
       await page.screenshot({path:'.next/owner-login-validation/field-details-'+viewport.width+'.png'});
     }
     await page.setViewport({width:1366,height:768});
     await fill('Display name','Unsaved');confirm=false;await click('Permissions');await heading('Login details');
     assert.equal(await page.$eval('label input',e=>e.value),'Unsaved');
     confirm=true;await click('Permissions');await heading('Permissions');await page.waitForSelector('input[type="checkbox"]');
     await page.click('input[type="checkbox"]');confirm=false;await click('Password');await heading('Permissions');
     confirm=true;await click('Password');await heading('Password');await click('Permissions');await page.waitForSelector('input[type="checkbox"]');
     assert.equal(await page.$eval('input[type="checkbox"]',e=>e.checked),true,'Discarded access changes do not leak into another section');
     await page.click('input[type="checkbox"]');await click('Save changes');await page.waitForFunction(()=>document.querySelector('[data-field-section] [role="status"]')?.textContent==='Changes saved.');
     assert.equal(await page.evaluate(()=>window.appSettings.canRecordWork),false);assert.deepEqual(await page.evaluate(()=>window.appSettings.fuelStorageIds),['tank']);
     await page.screenshot({path:'.next/owner-login-validation/field-permissions.png'});
     await click('Login details');await fill('Display name','Alex Updated');await click('Save changes');
     await page.waitForFunction(()=>document.querySelector('h2').textContent==='Manage Alex Updated');
     assert.deepEqual(await patch(),{displayName:'Alex Updated',username:'alex@skb'});
     await click('Password');await fill('New password','new-secret-123');await click('Show password');assert.equal(await page.$eval('input[autocomplete="new-password"]',e=>e.type),'text');await click('Save changes');
     await page.waitForFunction(()=>document.querySelector('input[autocomplete="new-password"]').value==='');assert.deepEqual(await patch(),{password:'new-secret-123'});
     await click('Asset access');await page.waitForFunction(()=>document.body.textContent.includes('No assets selected.'));
     assert(await page.$$eval('[data-field-section] button > span:first-child', els=>els.filter(e=>e.querySelector('svg')).every(e=>getComputedStyle(e).display==='none')), 'Selection buttons do not reserve space for hidden icons');
     await page.screenshot({path:'.next/owner-login-validation/field-assets-refined.png'});
     await card('Umbrellas');await page.waitForSelector('dialog[open] input[type="checkbox"]');await page.click('dialog[open] input[type="checkbox"]');await click('Cancel');
     await card('Umbrellas');await page.waitForSelector('dialog[open] input[type="checkbox"]');assert.equal(await page.$eval('dialog[open] input[type="checkbox"]',e=>e.checked),false);await page.click('dialog[open] input[type="checkbox"]');await click('Confirm selection');
     await click('Save changes');await page.waitForFunction(()=>document.querySelector('[data-field-section] [role="status"]')?.textContent==='Changes saved.');assert.deepEqual(await page.evaluate(()=>window.appSettings.groupIds),['farm']);
     await click('Fuel tank access');await page.waitForFunction(()=>document.body.textContent.includes('Choose fuel tanks'));await card('Choose fuel tanks');await page.waitForSelector('dialog[open]');
     await page.screenshot({path:'.next/owner-login-validation/field-picker.png'});await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));await heading('Fuel tank access');
     await click('Login status');await click('Deactivate');await page.waitForFunction(()=>document.querySelector('[data-active="false"]'));await click('Activate');await page.waitForFunction(()=>document.querySelector('[data-active="true"]'));
     await click('All logins');await click('Add login');await page.waitForSelector('input[autocomplete="new-password"]');await click('Show password');assert.equal(await page.$eval('input[autocomplete="new-password"]',e=>e.type),'text');await click('Cancel');
     await page.evaluate(()=>ReactDOM.unmountComponentAtNode(document.getElementById('other-app')));
     continue;
   }
   await click('Business login settings');assert(await page.evaluate(()=>document.body.textContent.includes('Business login ID:')));await click('All logins');
   await click('Manage Alex');await heading('Login details');
   await page.evaluate(()=>Promise.allSettled(document.getAnimations().map(a=>a.finished)));await page.screenshot({path:'.next/owner-login-validation/'+kind+'-overview.png'});
   await click('Login details');
   if(kind!=='field') {
     assert(await page.$$eval('label input',inputs=>inputs.every(input=>{const icon=input.parentElement.querySelector('svg');return !icon||parseFloat(getComputedStyle(input).paddingLeft)>icon.getBoundingClientRect().right-input.getBoundingClientRect().left+6;})), 'Input text must clear the leading icon');
     await page.screenshot({path:'.next/owner-login-validation/'+kind+'-details.png'});
   }
   await fill('Display name','Alex Updated');await click('Save changes');await heading('Login details');
   assert.deepEqual(await patch(),{displayName:'Alex Updated',username:'alex@skb'});
   await click('Password');await fill('New password','new-secret-123');await click('Show password');assert.equal(await page.$eval('input[autocomplete="new-password"]',e=>e.type),'text');await click('Save changes');await page.waitForFunction(()=>document.querySelector('input[autocomplete="new-password"]').value==='');assert.deepEqual(await patch(),{password:'new-secret-123'});
   await click('Permissions');
   if(kind==='field') {
     await page.waitForSelector('input[type="checkbox"]');await page.click('input[type="checkbox"]');await click('Save changes');await heading('Manage access');
     assert.equal(await page.evaluate(()=>window.appSettings.canRecordWork),false);
     assert.deepEqual(await page.evaluate(()=>window.appSettings.fuelStorageIds),['tank']);
     await click('Asset access');await page.waitForFunction(()=>document.body.textContent.includes('Umbrellas'));await card('Umbrellas');await page.waitForSelector('dialog[open] input[type="checkbox"]');await page.click('dialog[open] input[type="checkbox"]');await click('Cancel');
     await card('Umbrellas');await page.waitForSelector('dialog[open] input[type="checkbox"]');assert.equal(await page.$eval('dialog[open] input[type="checkbox"]',e=>e.checked),false);await page.click('dialog[open] input[type="checkbox"]');await click('Confirm selection');
     await click('Save changes');await heading('Manage access');assert.deepEqual(await page.evaluate(()=>window.appSettings.groupIds),['farm']);
     await card('Fuel tank access');await page.waitForFunction(()=>document.body.textContent.includes('Choose fuel tanks'));await card('Choose fuel tanks');await page.waitForSelector('dialog[open]');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));await heading('Fuel tank access');await click('‹ Back');
   } else {
     assert.equal(await page.$$eval('input[type="radio"]',els=>els.length),kind==='dealer'?4:2);
     if(kind!=='field') {
       assert(await page.$$eval('input[type="radio"]',els=>els[0].closest('label').getBoundingClientRect().top===els[1].closest('label').getBoundingClientRect().top), 'Business app roles should use two columns');
       assert(await page.$eval('button[type="submit"]',el=>el.getBoundingClientRect().bottom<=innerHeight), 'Save action should fit on screen');
       await page.screenshot({path:'.next/owner-login-validation/'+kind+'-permissions.png'});
     }
     await page.click('input[value="owner"]');await click('Save changes');await heading('Permissions');assert.deepEqual(await patch(),{role:'owner'});
   }
   await page.setViewport({width:390,height:844});assert(await page.$eval('[role="dialog"]',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}));await page.screenshot({path:'.next/owner-login-validation/'+kind+'-mobile.png'});await page.setViewport({width:1280,height:900});
   if(kind!=='field') await click('Login status'); else await click('Login status');await click('Deactivate');await page.waitForFunction(()=>document.querySelector('[data-active="false"]'));await click('Activate');await page.waitForFunction(()=>document.querySelector('[data-active="true"]'));
   await page.evaluate(()=>ReactDOM.unmountComponentAtNode(document.getElementById('other-app')));
 }
 assert.deepEqual(errors,[]);console.log('PASS: section navigation, role/asset access, scoped saves, duplicate errors, unsaved edits, status actions and mobile layout');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
