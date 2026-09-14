/* Real Discovery client, synthetic read-only APIs; no deployment credentials needed. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
let cssIndex=0;
const stubs={
 'components/useWebsiteStyles':'exports.useWebsiteStyles=(native,website)=>window.compact?native:website;',
 'components/WebsitePortal':'exports.createPortal=(children)=>ReactDOM.createPortal(children,document.getElementById("aim4price-website-overlays"));',
 'components/DropdownOverlay':'exports.default=()=>null;',
 'components/WorkspacePrimitives':'exports.workspaceStyles={};exports.WorkspaceTitlePanel=({title,children})=>React.createElement("header",null,React.createElement("h1",null,title),children);',
 'app/asset-discovery/recently-advertised-client':'exports.default=()=>null;',
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
 const filename=['.tsx','.ts',''].map(ext=>path.join(root,file+ext)).find(fs.existsSync);
 if(!filename)throw Error('Missing module '+file);
 modules[file]='';
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 modules[file]=code.replace(/require\(["']([^"']+)["']\)/g,(match,name)=>{
  if(!name.startsWith('.'))return match;
  const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),name));add(resolved);
  return 'require('+JSON.stringify(resolved)+')';
 });
}
const entry='app/asset-discovery/asset-discovery-client';add(entry);
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const appCode='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}'+
 'const Component=require('+JSON.stringify(entry)+').default;ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(Component,{dealerAppMode:window.compact}));';
const asset={id:'fixture-1',type:'Bakkies / LDVs',brand:'Toyota',model:'Hilux',year:'2023',usage:'140 676 km',condition:'Good',province:'Western Cape',renewalWindow:'',renewalTiming:null,enquiryId:null,enquiryStatus:null,requestAgainAtIso:null,approvedAtIso:null};
const evidence=path.join(root,'.next/discovery-focus-validation');
(async()=>{
 fs.mkdirSync(evidence,{recursive:true});
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let approved=false,fail=false;
  await page.setRequestInterception(true);
  page.on('request',request=>{
   const url=request.url(),respond=body=>request.respond({contentType:'application/json',body:JSON.stringify(body)});
   if(url.includes('/api/asset-discovery')&&!url.includes('/assets/'))return respond({ok:true,access:{accountType:'dealer',canBrowse:true,canContact:true,participationEnabled:true},assets:[{...asset,...(approved?{enquiryId:'enquiry-1',enquiryStatus:'approved'}:{})}],pagination:{page:1,pageSize:10,totalItems:1,totalPages:1,rangeStart:1,rangeEnd:1},summary:{totalAssets:1,typeCount:1,provinceCount:1}});
   if(url.includes('/assets/'))return fail?request.respond({status:500,contentType:'application/json',body:'{"ok":false,"error":"Fixture details unavailable"}'}):respond({ok:true,details:{asset,photosUnlocked:approved,contactUnlocked:approved,photoUrls:approved?['data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="green"/></svg>']:[],ownerContact:null,accessSource:approved?'approved_enquiry':null}});
   if(url.startsWith('data:'))return request.continue();
   if(url==='https://discovery.test/')return request.respond({contentType:'text/html',body:'<html><body></body></html>'});
   return request.abort();
  });
  async function open(width,compact=false){
   await page.setViewport({width,height:900});await page.goto('https://discovery.test/');
   await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#eef5f0}#app{padding:24px}button{font:inherit}'+sheets.join('\n')+'</style><div id="app"></div><div id="aim4price-website-overlays"></div>');
   await page.evaluate(value=>{window.compact=value;},compact);
   await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:appCode});
   await page.waitForSelector('button[aria-label="Open Toyota Hilux details"]');
  }
  for(const [width,compact] of [[1440,false],[390,true],[320,true]]){
   approved=false;fail=false;await open(width,compact);
   const trigger='button[aria-label="Open Toyota Hilux details"]';
   await page.click(trigger);
   await page.waitForFunction(()=>document.querySelector('#discovery-details-fixture-1')?.textContent.includes('Photos are locked'));
   assert.equal(await page.$('[role="dialog"]'),null,'details retain the inline design');
   const state=await page.$eval('#discovery-details-fixture-1',details=>{
    const card=details.closest('[data-discovery-card]');
    const summary=card.querySelector('[class*="discoverySummaryBlur"]');
    const close=card.querySelector('button[aria-expanded="true"]');
    function clear(element){
     for(let node=element;node&&node!==document.body;node=node.parentElement){
      if(getComputedStyle(node).filter!=='none')return false;
     }
     return true;
    }
    return {summaryBlur:getComputedStyle(summary).filter,detailsClear:clear(details),closeClear:clear(close),
     backgrounds:[...document.querySelectorAll('[class*="discoveryBackgroundBlur"]')].filter(e=>e.offsetWidth>0).length,
     portalClear:!document.getElementById('aim4price-website-overlays').inert};
   });
   assert.match(state.summaryBlur,/blur\(5px\)/);
   assert.equal(state.detailsClear,true);assert.equal(state.closeClear,true);
   assert.ok(state.backgrounds>0);assert.equal(state.portalClear,true);
   await page.screenshot({path:path.join(evidence,'discovery-'+width+'.png'),fullPage:true});
   await page.click('button[aria-label="Close Toyota Hilux details"]');
   assert.equal(await page.$('#discovery-details-fixture-1'),null);
   assert.equal((await page.$$('[class*="discoveryBackgroundBlur"]')).length,0);
   assert.equal((await page.$$('[inert]')).length,0);
   console.log('PASS original inline design, blurred background/upper summary, sharp details/Close and cleanup at '+width);
  }
  approved=true;await open(1440);await page.click('button[aria-label="Open Toyota Hilux details"]');
  await page.waitForSelector('button[aria-label="Open Toyota Hilux photo 1"]');
  await page.click('button[aria-label="Open Toyota Hilux photo 1"]');await page.waitForSelector('button[aria-label="Close asset photos"]');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('button[aria-label="Close asset photos"]'));
  assert.ok(await page.$('#discovery-details-fixture-1'),'closing photos keeps inline details open');
  await page.keyboard.press('Escape');
  assert.equal(await page.$('#discovery-details-fixture-1'),null);
  fail=true;await open(1440);await page.click('button[aria-label="Open Toyota Hilux details"]');
  await page.waitForFunction(()=>document.querySelector('#discovery-details-fixture-1')?.textContent.includes('Fixture details unavailable'));
  await page.click('button[aria-label="Close Toyota Hilux details"]');assert.equal(await page.$('#discovery-details-fixture-1'),null);
  assert.deepEqual(errors,[]);console.log('PASS nested photos, Escape and dismissible failed details');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
