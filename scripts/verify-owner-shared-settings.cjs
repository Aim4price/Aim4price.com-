/* Browser checks for owner shared-maintenance recipient settings. */
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



add('app/asset-register/page.module.css');
add('components/DealerMaintenanceAccessSettings');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';

(async()=>{
 const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],headless:true});
 try {
 const page=await browser.newPage();
 page.on('pageerror',error=>console.error('Browser error:',error.message));
 await page.setViewport({width:1366,height:900});
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:runtime+`window.requests=[];window.failSave=false;
 window.entry={id:'access-1',dealerUserId:'dealer-1',dealerName:'Example Dealer',dealerLogoUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII=',grantedByName:'Owner',createdAtIso:'2026-11-02',permissions:{canViewHistory:false,canCreateMaintenanceSchedules:true}};
 window.fetch=async(url,options)=>{const body=JSON.parse(options.body);window.requests.push({url,method:options.method,body});if(window.failSave)return {ok:false,json:async()=>({error:'Please try again.'})};return {ok:true,json:async()=>({ok:true,trackingAccess:{...window.entry,permissions:body.permissions}})};};
 function Fixture(){const [entries,setEntries]=React.useState([window.entry]);return React.createElement(require('components/DealerMaintenanceAccessSettings').default,{assetId:'asset-1',assetTitle:'2022 John Deere 6135B',entries,mutationUrl:'/api/dealer-maintenance-access',onEntriesChange:setEntries});}
 ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(Fixture));`});
 const click=async text=>page.evaluate(text=>{const button=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===text);if(!button)throw Error('Missing button '+text);button.click();},text);
 const open=async()=>{await page.click('[aria-label="Businesses and dealers with access"] button');await page.waitForSelector('[role="dialog"]');};
 await page.waitForSelector('[aria-label="Businesses and dealers with access"] img');
 assert.equal(await page.$eval('[aria-label="Businesses and dealers with access"]',e=>e.textContent.includes('›')),false);
 await open();assert.equal(await page.$eval('[role="dialog"] h3',e=>e.textContent),'Business/Dealer asset settings');
 assert.equal(await page.$$eval('[data-permission-groups]',els=>els.length),1);
 assert.equal(await page.$$eval('[data-permission-grid] input',els=>els.length),15);
 await page.click('[data-permission-grid] input');await click('Cancel');
 assert.equal(await page.evaluate(()=>window.requests.length),0);await open();
 assert.equal(await page.$eval('[data-permission-grid] input',e=>e.checked),false);
 await page.click('[data-permission-grid] input');await page.evaluate(()=>window.failSave=true);await click('Save asset settings');await page.waitForSelector('[role="dialog"] [role="alert"]');
 assert.equal(await page.$eval('[data-permission-grid] input',e=>e.checked),true);
 await page.evaluate(()=>window.failSave=false);await click('Save asset settings');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
 const request=await page.evaluate(()=>window.requests.at(-1));assert.equal(request.method,'PATCH');assert.equal(request.body.assetId,'asset-1');assert.equal(request.body.accessId,'access-1');assert.equal(request.body.permissions.canUpdateDetails,true);
 await open();
 for(const width of [1366,768,390]){await page.setViewport({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+width);assert(await page.$eval('[role="dialog"]',e=>e.scrollWidth<=e.clientWidth+1),'dialog overflow '+width);await page.screenshot({path:'/tmp/shared-access-'+width+'.png'});}
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
 await page.$eval('[aria-label="Businesses and dealers with access"] img',e=>e.dispatchEvent(new Event('error')));
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Businesses and dealers with access"] img'));
 await open();await click('Disable tracking');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
 const revoke=await page.evaluate(()=>window.requests.at(-1));assert.equal(revoke.method,'DELETE');assert.equal(revoke.body.accessId,'access-1');assert.equal(revoke.body.dealerUserId,'dealer-1');
 console.log('Shared settings: logo fallback, standard dialog, cancel, failed/successful save, revoke and responsive layout passed.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
