/* Native app homes: real components/CSS and synthetic sessions; no live accounts or writes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const ownerScreen=process.env.OWNER_SCREEN||'home', restricted=process.env.OWNER_RESTRICTED==='1';
const ownerPage=ownerScreen==='home'?'app/owner-app/page':'app/owner-app/'+ownerScreen+'/page';
const appMode=process.env.APP_MODE||'owner',appRoot=appMode==='owner'?'/owner-app':'/'+appMode;
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
let cssIndex=0;
const stubs={'components/AppHeader':'module.exports=()=>null;', 'components/ListingAlertSettings':'module.exports=()=>null;', 'components/useWebsiteStyles':'exports.useWebsiteStyles=(native)=>native;', 'components/DateInput':'module.exports=()=>null;', 'lib/use-dealer-app-root':'exports.useDealerAppRoot=()=>'+JSON.stringify(appMode==='middleman'?'/middleman':'/dealer')+';'};
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




Object.assign(stubs, {
 'lib/report-print': 'exports.buildAssetSheetReportHtml=()=>"";',
 'components/DealerMaintenanceAccessSettings':'module.exports=()=>null;',
 'components/AppMaintenanceActions':'module.exports=()=>null;',
 'components/SaleabilityModal':'module.exports=()=>null;',
 'app/owner-app/assets/[assetId]/owner-asset-options-client':'module.exports=()=>null;',
 'app/owner-app/assets/[assetId]/owner-asset-report-picker':'module.exports=()=>null;',
});
add('app/owner-app/assets/[assetId]/owner-asset-detail-client');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="next/dynamic")return ()=>()=>null;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({back(){},push(){},replace(){}}),usePathname:()=>'+JSON.stringify(appMode==='owner'&&ownerScreen!=='home'?appRoot+'/'+ownerScreen:appRoot)+'};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';
const roles={viewer:{},operator:{updateUsage:true,viewPhotos:true},workshop:{updateUsage:true,viewPhotos:true,uploadPhotos:true,uploadDocuments:true,viewMaintenance:true},office:{editDetails:true,updateUsage:true,viewPhotos:true,uploadPhotos:true,uploadDocuments:true,exportAssets:true,viewMaintenance:true},manager:{editDetails:true,updateUsage:true,viewValues:true,viewMap:true,updateLocation:true,viewPhotos:true,uploadPhotos:true,uploadDocuments:true,exportAssets:true,viewMaintenance:true}};
(async()=>{const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});try{
for(const width of [320,393])for(const [role,permissions] of Object.entries(roles))for(const view of ['summary','details','manage','section']){
 const page=await browser.newPage(),errors=[],requests=[],writes=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width,height:852});
 const asset={id:'a',title:'2021 Test Tractor',kind:'tractor',yearModel:2021,brandName:'Test',modelName:'Tractor',condition:'good',serialNumber:'TEST',hours:1400,lifeWorkedPercent:null,specsJson:{usageMetric:'hours'},value:permissions.viewValues?100000:null,replacementPriceExVat:permissions.viewValues?200000:null,insuredValueExVat:null,valuesRestricted:!permissions.viewValues,photos:[],documents:[],updatedAtIso:'revision',createdAtIso:'2026-01-01',registerId:null};
 await page.setRequestInterception(true);page.on('request',async request=>{
 const url=new URL(request.url());requests.push(url.pathname);
 if(request.method()==='PATCH'){writes.push(JSON.parse(request.postData()));asset.hours=1401;}
 const body=url.pathname==='/api/owner-app/session'?{ok:true,session:{permissions:['view'],teamPermissions:permissions,ownerAppUserId:'member'}}:url.pathname==='/api/owner-app/assets/a'?{ok:true,item:asset,maintenance:[],registers:[],ownerContext:null}:{ok:true};
 await request.respond({contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('https://preview.test');await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+'window.testRequire=require;'});
 await page.evaluate(view=>{const Component=window.testRequire('app/owner-app/assets/[assetId]/owner-asset-detail-client').default;const css=window.testRequire('app/owner-app/owner-app.module.css');ReactDOM.createRoot(document.getElementById('app')).render(React.createElement('div',{className:css.appShell,'data-app-shell':'owner'},React.createElement(Component,{assetId:'a',view,section:'usage'})));},view);
 await page.waitForFunction(()=>document.body.textContent.replace(/\s+/g,' ').includes('2021 Test Tractor'),{timeout:10000}).catch(async error=>{console.error(role,view,errors,await page.$eval('body',el=>el.innerText));throw error;});
 await page.waitForFunction(()=>!document.body.innerText.includes('Loading asset…'));
 if(view==='summary'){
 assert.equal(await page.$eval('body',el=>!!el.querySelector('a[href$="/options"]')),false,'staff cannot open sharing');
 assert.equal(await page.$eval('body',el=>!!el.querySelector('a[href$="/manage/usage"]')),!!permissions.updateUsage);
 }
 if(view==='details'){
 assert.equal(await page.$$eval('a[href*="undefined"]',els=>els.length),0);
 if(!permissions.viewValues)assert(await page.$eval('body',el=>!!el.querySelector('[aria-label="Value restricted"]')));
 const enabled=await page.$$eval('input[type="file"]',els=>els.map(e=>!e.disabled));assert.deepEqual(enabled,[!!permissions.uploadPhotos,!!permissions.uploadDocuments]);
 assert(await page.$eval('body',el=>el.innerText.includes('No approved documents')));
 }
 if(view==='manage')assert(!requests.includes('/api/dealer-maintenance-access'),'staff Manage never calls owner-only endpoint');
 if(view==='section' && permissions.updateUsage){
 await page.$eval('input[type="number"]',el=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'1401');el.dispatchEvent(new Event('input',{bubbles:true}));});await page.click('button[type="submit"]');await page.waitForFunction(()=>document.body.innerText.includes('Asset changes saved.'));assert.deepEqual(writes[0].patch,{usage:1401});assert.equal(writes[0].expectedUpdatedAtIso,'revision');
 }
 assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');if(role==='operator'&&view==='details')await page.screenshot({path:'/tmp/manager-operator-details-'+width+'.png',fullPage:true});await page.close();console.log('PASS',width,role,view);
}
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
