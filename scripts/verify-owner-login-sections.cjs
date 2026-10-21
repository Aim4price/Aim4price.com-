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
 let confirm=true;page.on('dialog',dialog=>confirm?dialog.accept():dialog.dismiss());
 await page.setViewport({width:1280,height:900});
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial;background:#eef4ef}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:`${runtime}
 window.requests=[];window.failSave=false;
 let users=[{id:'one',displayName:'George Jnr',username:'jnr@skb',accessRole:'admin',isActive:true,lastLoginAtIso:null,updatedAtIso:'2026-10-08T08:26:00Z'}, {id:'two',displayName:'Gerald',username:'gerald@skb',accessRole:'view_only',isActive:true,lastLoginAtIso:null,updatedAtIso:'2026-10-08T08:26:00Z'}];
 let settings={assetScope:'selected',assetIds:[],groupIds:[]};
 window.fetch=async(url,options={})=>{
 const method=options.method||'GET',body=options.body?JSON.parse(options.body):null;window.requests.push({url,method,body});
 let data={ok:true};let ok=true;
 if(url==='/api/account/app-login-name')data={ok:true,accountName:'skb',suggestedName:'skb'};
 else if(url==='/api/owner-app/users')data={ok:true,users};
 else if(url.endsWith('/access')){if(method==='PUT'){if(window.holdAccess)await new Promise(resolve=>window.releaseAccess=resolve);settings=body;}data={ok:true,settings,assets:[{id:'tractor',title:'Tractor',kind:'Tractor'}],groups:[{id:'farm',name:'Farm equipment',memberCount:2}]};}
 else if(method==='PATCH'){if(window.failSave){ok=false;data={ok:false,error:'Username is already in use.'};}else{users=users.map(u=>url.endsWith(u.id)?{...u,...body}:u);data={ok:true,user:users.find(u=>url.endsWith(u.id))};}}
 else if(method==='DELETE')users=users.filter(u=>!url.endsWith(u.id));
 return {ok,json:async()=>data};};
 ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(require('app/account/app-access-management-client').OwnerAppAccessManagement));`});
 async function click(text){await page.waitForFunction(text=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()===text||b.getAttribute('aria-label')===text),{},text);await page.evaluate(text=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===text||b.getAttribute('aria-label')===text);b.click();},text);}
 async function card(title){await page.evaluate(title=>Array.from(document.querySelectorAll('button')).find(b=>b.querySelector('strong')?.textContent===title).click(),title);}
 async function heading(title){await page.waitForFunction(title=>Array.from(document.querySelectorAll('h3')).some(h=>h.textContent===title),{},title);}
 async function fill(label,value){const input=await page.evaluateHandle(label=>Array.from(document.querySelectorAll('label')).find(l=>l.textContent.startsWith(label))?.querySelector('input'),label);await input.click({clickCount:3});await input.press('Backspace');await input.type(value);}
 async function patch(){return page.evaluate(()=>window.requests.filter(r=>r.method==='PATCH').at(-1).body);}
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Manage logins')));
 await page.evaluate(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Manage logins')).click());
 await click('Manage George Jnr');await heading('What would you like to change?');
 assert.equal(await page.$$eval('button strong',els=>els.filter(e=>['Login details','Permissions','Asset access','Passcode'].includes(e.textContent)).length),4);
 assert.equal(await page.evaluate(()=>Array.from(document.querySelectorAll('[role="dialog"] button')).some(b=>b.textContent==='Delete')),false);
 fs.mkdirSync('.next/owner-login-validation',{recursive:true});
 await page.evaluate(()=>Promise.allSettled(document.getAnimations().map(a=>a.finished)));
 await page.screenshot({path:'.next/owner-login-validation/overview-desktop.png'});
 await page.setViewport({width:390,height:844});
 assert(await page.$eval('[role="dialog"]',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}));
 await page.screenshot({path:'.next/owner-login-validation/overview-mobile.png'});
 await page.setViewport({width:1280,height:900});
 await card('Asset access');assert(await page.evaluate(()=>document.body.textContent.includes('Owner / Admin has access to all umbrellas and assets.')));
 assert.equal(await page.$$eval('input[type="checkbox"]',els=>els.length),0);await click('‹ Back');
 await card('Permissions');await page.click('input[value="operations"]');await click('Save changes');await heading('What would you like to change?');assert.deepEqual(await patch(),{accessRole:'operations'});
 await card('Asset access');await page.waitForSelector('input[type="checkbox"]');await page.click('input[type="checkbox"]');await page.evaluate(()=>window.holdAccess=true);await click('Save changes');await page.waitForFunction(()=>document.querySelector('[data-modal-close]').disabled);await page.evaluate(()=>{window.holdAccess=false;window.releaseAccess();});await heading('What would you like to change?');assert.deepEqual(await page.evaluate(()=>window.requests.filter(r=>r.method==='PUT').at(-1).body.groupIds),['farm']);
 await card('Passcode');await fill('New passcode','4321');await click('Save changes');await heading('What would you like to change?');assert.deepEqual(await patch(),{password:'4321'});
 await card('Login details');await fill('Display name','George Junior');await page.evaluate(()=>window.failSave=true);await click('Save changes');await page.waitForFunction(()=>document.body.textContent.includes('Username is already in use.'));await heading('Login details');
 await page.evaluate(()=>window.failSave=false);await click('Save changes');await heading('What would you like to change?');assert.deepEqual(await patch(),{displayName:'George Junior',username:'jnr@skb'});
 await card('Login details');await fill('Display name','Unsaved');confirm=false;await click('‹ Back');await heading('Login details');confirm=true;await click('‹ Back');await heading('What would you like to change?');
 await click('Manage login status');await click('Deactivate');await page.waitForFunction(()=>document.querySelector('[data-active="false"]'));await click('Activate');await page.waitForFunction(()=>document.querySelector('[data-active="true"]'));
 confirm=false;await click('Delete');assert.equal(await page.evaluate(()=>window.requests.filter(r=>r.method==='DELETE').length),0);confirm=true;await click('Delete');await page.waitForFunction(()=>!document.body.textContent.includes('Manage George Junior'));
 assert.deepEqual(errors,[]);console.log('PASS: section navigation, role/asset access, scoped saves, duplicate errors, unsaved edits, status actions and mobile layout');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
