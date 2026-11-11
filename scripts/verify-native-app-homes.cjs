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
 'lib/auth-session':'exports.getServerSession=async()=>({user:{id:"fixture",name:"Test account",email:"fixture@example.invalid"}});exports.isDealerAppSession=()=>false;',
 'lib/dealer-app-session':'exports.getDealerAppSession=async()=>({role:"owner"});',
 'lib/account-profile':'exports.getAccountProfile=async()=>({accountType:"dealer",accountStatus:"active",businessName:"Test account"});',
 'lib/dealer-maintenance-notification-inbox':'exports.listDealerMaintenanceNotificationsForViewer=async()=>[];',
 'lib/dealer-maintenance-tracker':'exports.listDealerTrackedAssets=async()=>[];',
 'lib/partner-access':'exports.listAssetLeadsForUser=async()=>[];'
});
stubs['lib/owner-app-access']='exports.requireOwnerAppPageAccess=async()=>({displayName:"Test manager",ownerUserId:"fixture"});exports.ownerAppCan=()=>'+(!restricted)+';';stubs['app/owner-app/owner-home-attention']='module.exports=()=>null;';stubs['components/AppSettings']='module.exports=()=>null;';add(ownerPage);add('app/owner-app/owner-bottom-nav');
add('app/dealer/dealer-nav');add('app/dealer/dealer-bottom-nav');add('app/dealer/page');add('app/middleman/page');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="next/dynamic")return ()=>()=>null;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({back(){},push(){},replace(){}}),usePathname:()=>'+JSON.stringify(appMode==='owner'&&ownerScreen!=='home'?appRoot+'/'+ownerScreen:appRoot)+'};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';


(async()=>{const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.setViewport({width:Number(process.env.VIEWPORT_WIDTH||320),height:852});
 await page.setRequestInterception(true);page.on('request',r=>r.respond({contentType:'application/json',body:JSON.stringify({ok:true,manager:{id:'fixture',displayName:'A long Manager account name',username:'fixture'},items:[{id:'baler',title:'2021 Krone Fortima 1250MC Baler',kind:'baler',serialNumber:'RPS601S1',usage:30,usageMetric:'percentage',yearModel:2021}],assets:[{id:'baler',title:'2021 Krone Fortima 1250MC Baler',kind:'baler',publicAssetCode:'fixture',serialNumber:'RPS601S1',usageLabel:'30%',yearModel:2021}],groups:[{id:'balers',name:'Balers and agricultural equipment with a long name',memberAssetIds:['baler'],memberCount:1}],session:{role:'owner',permissions:restricted?['view']:['view','operate']},summary:{needsAttentionCount:3,comingUpCount:14},unreadCount:2})}));
 await page.goto('https://preview.test');await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial;background:#eef5f0}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:runtime+'window.testRequire=require;'});
 await page.evaluate(async ({mode,ownerPage})=>{const req=window.testRequire;
 const owner=mode==='owner',css=req(owner?'app/owner-app/owner-app.module.css':'app/dealer/dealer.module.css');
 const Home=req(owner?ownerPage:'app/'+mode+'/page').default;
 const content=await Home({searchParams:{q:'Baler'}});
 ReactDOM.createRoot(document.getElementById('app')).render(React.createElement('div',{className:owner?css.appShell:css.dealerLayout,'data-app-shell':owner?'owner':'dealer'},owner?null:React.createElement(req('app/dealer/dealer-nav').default),owner?content:React.createElement('div',{className:css.patternPageContent},content),React.createElement(req(owner?'app/owner-app/owner-bottom-nav':'app/dealer/dealer-bottom-nav').default)));
 },{mode:appMode,ownerPage});
 await page.waitForFunction(()=>document.body.innerText.includes('Add fuel')||document.body.innerText.includes('Value Asset')||document.querySelector('a[href="/owner-app/assets/baler"]'));
 if(appMode==='owner'){
  assert.equal(await page.$$eval('a[href*="/workspace/"]',els=>els.length),0,'No desktop workspace links');
  if(ownerScreen==='assets'){await page.waitForSelector('a[href="/owner-app/assets/baler"]');assert.equal(await page.$$eval('a[href="/owner-app/assets/add"]',els=>els.length),restricted?0:1);}
  if(ownerScreen==='home' && restricted) assert.equal(await page.$$eval('[aria-disabled="true"]',els=>els.length),4);
 }

 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
 const header=appMode==='owner'?'Aim4price Manager account controls':appMode==='middleman'?'Middleman App navigation':'Dealer App navigation';
 assert.equal(await page.$$eval('header[aria-label="'+header+'"] [aria-label="Back"]',els=>els.length),1);
 assert(await page.evaluate(label=>{const h=document.querySelector('header[aria-label="'+label+'"]');const controls=[...h.querySelectorAll('button,a')].filter(e=>e.textContent==='Back'||e.textContent==='Home');return controls.length===2&&controls.every(e=>e.getBoundingClientRect().height>=44);},header));
 const bottomLabel=appMode==='owner'?'Manager App navigation':null;
 await page.waitForSelector(bottomLabel?'nav[aria-label="'+bottomLabel+'"]':'nav[aria-label$="bottom navigation"]');
 assert(await page.$$eval(bottomLabel?'nav[aria-label="'+bottomLabel+'"] a':'nav[aria-label$="bottom navigation"] a',(els,root)=>els.every(e=>e.getAttribute('href').startsWith(root)),appRoot));
 await page.screenshot({path:'/tmp/parity-home-'+appMode+'-'+ownerScreen+'-'+(restricted?'restricted':'owner')+'-'+(process.env.VIEWPORT_WIDTH||320)+'.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS actual home and navigation',appMode);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
