/* Customer billing and email visual checks with synthetic data; no real email or account writes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
let cssIndex=0;
const stubs={
 'lib/sharing-foundation':'exports.sharingPlan=async()=>"desktop";',
 'lib/guest-enquiry-credits':'exports.guestCreditLimit=()=>null;',
 'lib/guest-business-access':'exports.getGuestViewer=async()=>null;',
 'components/AppHeader':'module.exports=()=>null;',
 'lib/account-access':'exports.getAccountAccess=async()=>({isActive:false,isAdmin:false});',
 'lib/account-profile':'exports.getAccountProfile=async()=>({accountType:"owner"});',
 'lib/auth-session':'exports.getAnyServerSession=async()=>globalThis.fixtureAnonymous?null:({user:{id:"test",email:"customer@example.test"}});',
 'lib/middleman-account':'exports.isMiddlemanAccountSubtype=()=>false;'
};
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

add('components/leads/SharedAssetContributionDialog');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';

(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});
 try{
 const page=await browser.newPage();const requests=[],errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
 await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/api/admin/sharing'){requests.push(JSON.parse(r.postData()));return r.respond({contentType:'application/json',body:'{"ok":true}'});}if(u.pathname==='/api/billing/plans')return r.respond({status:503,contentType:'application/json',body:'{}'});if(u.pathname.startsWith('/api/test/'))return r.respond({contentType:'application/json',body:'{"ok":true}'});if(u.pathname.startsWith('/api/'))return r.respond({contentType:'application/json',body:u.pathname.includes('session')?'null':'{}'});return r.respond({contentType:'text/html',body:'<html></html>'});});
 const font=fs.readFileSync(path.join(root,'public/field-manager/montserrat-latin.woff')).toString('base64');
 await page.setViewport({width:1440,height:1000});
 async function render(module,props,url='/'){
  await page.goto('https://usage.test'+url);
  await page.setContent('<style>@font-face{font-family:Montserrat;src:url(data:font/woff;base64,'+font+')}*{box-sizing:border-box}body{margin:0;font:16px Montserrat,Arial,sans-serif;background:#f2f6f3;--website-design-vw:1vw;--website-design-vh:10px;--shell-narrow-width:min(calc(100% - 32px),1100px);--website-visible-height:100dvh;--text-strong:#173c32}button,input,select{font:inherit}'+sheets.join('\n')+'</style><div id="app" style="padding:24px"></div>');
  await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
  await page.addScriptTag({content:runtime+'ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(require('+JSON.stringify(module)+').default,'+JSON.stringify(props)+'));'});
  await page.evaluate(()=>document.fonts.ready);
 }
 await render('components/leads/SharedAssetContributionDialog',{kind:'costs',endpoint:'/api/test/costs',assetTitle:'John Deere 6155M · JD-001'});
 await page.waitForSelector('input[name=amount]');
 await page.type('input[name=description]','Oil and filter service');await page.type('input[name=amount]','1200');
 const geometry=await page.evaluate(()=>{const amount=document.querySelector('[name=amount]').getBoundingClientRect(),vat=document.querySelector('[name=vat]').getBoundingClientRect(),dialog=document.querySelector('[role=dialog]').getBoundingClientRect();return{aligned:Math.abs(amount.top-vat.top)<2,inside:dialog.top>=0&&dialog.bottom<=innerHeight};});
 assert(geometry.aligned);assert(geometry.inside);await page.screenshot({path:'/tmp/shared-cost-dialog.png'});
 await page.click('button[type=submit]');await page.waitForFunction(()=>document.body.textContent.includes('Cost saved'));
 await render('components/leads/SharedAssetContributionDialog',{kind:'photos',endpoint:'/api/test/photos',assetTitle:'John Deere 6155M · JD-001'});
 await page.waitForSelector('input[type=file]');await page.screenshot({path:'/tmp/shared-photo-dialog.png'});
 assert.deepEqual(errors,[]);console.log('PASS shared photo/cost dialog rendering, alignment, viewport fit and cost submission');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
