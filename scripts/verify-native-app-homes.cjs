/* Native app homes: real components/CSS and synthetic sessions; no live accounts or writes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const appMode=process.env.APP_MODE||'field-manager',appRoot=appMode==='owner'?'/owner-app':'/'+appMode;
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
 'lib/auth-session':'exports.getServerSession=async()=>({user:{id:"fixture",name:"Test account",email:"fixture@example.invalid"}});exports.isDealerAppSession=()=>false;',
 'lib/dealer-app-session':'exports.getDealerAppSession=async()=>({role:"owner"});',
 'lib/account-profile':'exports.getAccountProfile=async()=>({accountType:"dealer",accountStatus:"active",businessName:"Test account"});',
 'lib/dealer-maintenance-notification-inbox':'exports.listDealerMaintenanceNotificationsForViewer=async()=>[];',
 'lib/dealer-maintenance-tracker':'exports.listDealerTrackedAssets=async()=>[];',
 'lib/partner-access':'exports.listAssetLeadsForUser=async()=>[];'
});
add('app/field-manager/field-manager-bottom-nav');add('app/field-manager/field-manager-assets-client');add('app/field-manager/field-manager-top-nav');add('app/field-manager/field-manager-home-client');
add('app/dealer/dealer-nav');add('app/dealer/dealer-bottom-nav');add('app/dealer/page');add('app/middleman/page');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="next/dynamic")return ()=>()=>null;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({back(){},push(){},replace(){}}),usePathname:()=>'+JSON.stringify(appRoot)+'};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';


(async()=>{const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:Number(process.env.VIEWPORT_WIDTH||320),height:852});
 await page.setRequestInterception(true);page.on('request',r=>r.respond({contentType:'application/json',body:JSON.stringify({ok:true,manager:{id:'fixture',displayName:'A long Field Manager account name',username:'fixture'},assets:[{id:'baler',title:'2021 Krone Fortima 1250MC Baler',kind:'baler',publicAssetCode:'fixture',serialNumber:'RPS601S1',usageLabel:'30%',yearModel:2021}],groups:[{id:'balers',name:'Balers and agricultural equipment with a long name',memberAssetIds:['baler'],memberCount:1}],session:{role:'owner'},summary:{needsAttentionCount:3,comingUpCount:14},unreadCount:2})}));
 await page.goto('https://preview.test');await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial;background:#eef5f0}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:runtime+'window.testRequire=require;'});
 await page.evaluate(async mode=>{const req=window.testRequire;
 const field=mode==='field-manager',css=req(field?'app/field-manager/page.module.css':'app/dealer/dealer.module.css');
 const Nav=req(field?'app/field-manager/field-manager-top-nav':'app/dealer/dealer-nav').default;
 const Home=req(field?'app/field-manager/field-manager-home-client':'app/'+mode+'/page').default;
 const content=field?React.createElement(Home):await Home();
 ReactDOM.createRoot(document.getElementById('app')).render(React.createElement('div',{className:field?css.appShell:css.dealerLayout,'data-app-shell':field?'field':'dealer',style:field?{display:'contents'}:undefined},React.createElement(Nav),field?content:React.createElement('div',{className:css.patternPageContent},content),React.createElement(req(field?'app/field-manager/field-manager-bottom-nav':'app/dealer/dealer-bottom-nav').default)));
 },appMode);
 await page.waitForFunction(()=>document.body.innerText.includes('Add fuel')||document.body.innerText.includes('Value Asset'));
 await page.waitForFunction(()=>!document.body.innerText.includes('Opening Field Manager'));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
 const header=appMode==='field-manager'?'Field Manager navigation':appMode==='middleman'?'Middleman App navigation':'Dealer App navigation';
 assert.equal(await page.$$eval('header[aria-label="'+header+'"] [aria-label="Back"]',els=>els.length),1);
 assert(await page.evaluate(label=>{const h=document.querySelector('header[aria-label="'+label+'"]');const controls=[...h.querySelectorAll('button,a')].filter(e=>e.textContent==='Back'||e.textContent==='Home');return controls.length===2&&controls.every(e=>e.getBoundingClientRect().height>=44);},header));
 if(appMode==='field-manager')assert(await page.$$eval('[class*="tile"]',els=>els.every(e=>getComputedStyle(e).textAlign==='center')));
 else {await page.waitForSelector('nav[aria-label$="bottom navigation"]');assert(await page.$$eval('nav[aria-label$="bottom navigation"] a',(els,root)=>els.every(e=>e.getAttribute('href').startsWith(root)),appRoot));}
 if(appMode!=='field-manager')assert(await page.evaluate(()=>document.querySelector('main nav').getBoundingClientRect().top-document.querySelector('header').getBoundingClientRect().bottom<40),'Home tools start below navigation without a large blank gap');
 await page.screenshot({path:'/tmp/parity-home-'+appMode+'-'+(process.env.VIEWPORT_WIDTH||320)+'.png',fullPage:true});
 if(appMode==='field-manager') {
   await page.evaluate(()=>{const C=window.testRequire('app/field-manager/field-manager-assets-client').default;ReactDOM.createRoot(document.getElementById('app')).render(React.createElement('div',{className:window.testRequire('app/field-manager/page.module.css').appShell},React.createElement(C)));});
   await page.waitForSelector('[aria-label="View all assets"]');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Field directory must fit');
   await page.screenshot({path:'/tmp/parity-directory-field-'+(process.env.VIEWPORT_WIDTH||320)+'.png',fullPage:true});
   await page.click('[aria-label^="Open Balers"]');
   await page.waitForFunction(()=>document.body.innerText.includes('2021 Krone'));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Selected umbrella must fit');
 }
 assert.deepEqual(errors,[]);console.log('PASS actual home and navigation',appMode);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
