/* Owner App access editor against synthetic APIs; no production writes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
let cssIndex=0;
const cssMaps={};
const stubs={'components/AppHeader':'module.exports=()=>null;'};
function cssModule(file){
 if(cssMaps[file])return cssMaps[file];
 const prefix='c'+cssIndex+++'_',map={},sheet=postcss.parse(fs.readFileSync(path.join(root,file),'utf8'));
 cssMaps[file]=map;
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
 sheet.walkDecls('composes',decl=>{
  const match=decl.value.match(/^([\w ]+) from ['"](.+)['"]$/);
  assert(match,'Unsupported CSS composition: '+decl.value);
  const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[2]));
  const composed=cssModule(dependency);
  const key=decl.parent.selector.slice(prefix.length+1);
  assert(map[key],'Missing composed class');
  for(const name of match[1].split(' ')){assert(composed[name],'Missing composed class '+name);map[key]+=' '+composed[name];}
  decl.remove();
 });
 sheets.push(sheet.toString());modules[file]='module.exports='+JSON.stringify(map);
 return map;
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
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return (loader,options={})=>{const Lazy=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=>React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(Lazy,props));};if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';



(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});
 try {
 const page=await browser.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.setViewport({width:1440,height:900});
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:runtime+`;
 window.record={id:'one',displayName:'Example Owner',username:'owner@farm',accessRole:'operations',isActive:true,lastLoginAtIso:null,updatedAtIso:'2026-11-07T10:00:00Z'};
 window.settings={assetScope:'all',assetIds:[],registerIds:[],groupIds:[]};window.writes=[];
 window.fetch=async(url,init={})=>{let body={ok:true};
 if(url.includes('/access')){if(init.method==='PUT'){window.settings=JSON.parse(init.body);window.writes.push(window.settings)}body={ok:true,settings:window.settings,assets:[],registers:[],groups:[]};}
 else if(url.includes('app-login-name'))body={ok:true,accountName:'farm',suggestedName:'farm'};
 else if(init.method==='PATCH'){Object.assign(window.record,JSON.parse(init.body));window.writes.push(JSON.parse(init.body));body={ok:true,user:window.record};}
 else if(url.includes('/users'))body={ok:true,users:[window.record]};
 return {ok:true,json:async()=>body};};
 ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(require('app/account/app-access-management-client').OwnerAppAccessManagement));`});
 async function click(text){await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>!b.disabled && (b.textContent.trim()===t||b.querySelector('strong')?.textContent===t)),{},text);await page.evaluate(t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t||b.querySelector('strong')?.textContent===t).click(),text);}
 await click('Manage logins');await click('Manage');
 await page.waitForFunction(()=>document.body.textContent.includes('All changes saved'));
 assert.equal(await page.$eval('nav[aria-label="Login settings"] button',e=>e.textContent),'All users');
 const field=await page.$('input[value="Example Owner"]');await field.click({clickCount:3});await field.type('Updated Owner');
 await click('Save access');await page.waitForFunction(()=>window.writes.length===1);
 assert.equal(await page.evaluate(()=>window.writes[0].displayName),'Updated Owner');
 await click('Permissions');await page.waitForSelector('input[value="view_only"]');await page.click('label:has(input[value="view_only"])');await click('Save access');await page.waitForFunction(()=>window.writes.length===2);
 await page.screenshot({path:'/tmp/owner-permissions-desktop.png'});
 assert(await page.$$eval('input[name="owner-role"]',inputs=>{
   const cards=inputs.map(input=>input.closest('label').getBoundingClientRect());
   return cards.length===3&&Math.abs(cards[0].width-cards[1].width)<1&&Math.abs(cards[0].top-cards[1].top)<1&&Math.abs(cards[2].right-cards[1].right)<1;
 }),'Owner role cards fill both columns without an empty gap');
 await page.setViewport({width:390,height:844});await page.screenshot({path:'/tmp/owner-permissions-mobile.png'});await page.setViewport({width:1440,height:800});
 await click('Asset access');await page.waitForSelector('input[name="owner-asset-scope"]');
 await page.click('input[name="owner-asset-scope"]:not(:checked)');await click('Save access');await page.waitForFunction(()=>window.writes.length===3);
 assert.equal(await page.evaluate(()=>window.writes[2].assetScope),'selected');
 await click('Passcode');await page.waitForSelector('input[autocomplete="new-password"]');await page.type('input[autocomplete="new-password"]','5678');await click('Save access');await page.waitForFunction(()=>window.writes.length===4);
 assert.equal(await page.evaluate(()=>window.writes[3].password),'5678');
 await click('Login details');await page.waitForSelector('input[value="Updated Owner"]');
 for(const width of [1440,390]){await page.setViewport({width,height:800});await page.screenshot({path:'/tmp/owner-flow-'+width+'.png'});const g=await page.$eval('footer',e=>{const r=e.getBoundingClientRect();return {bottom:r.bottom,right:r.right}});assert(g.bottom<=801 && g.right<=width+1,JSON.stringify(g));}
 await click('Login status');await page.waitForFunction(()=>!document.querySelector('footer'));assert.equal(await page.$('footer'),null);
 assert.deepEqual(errors,[]);console.log('Owner flow: navigation, details, permissions, assets, passcode, footer and mobile checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

