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
const entry='app/asset-discovery/recently-advertised-client';add(entry);
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const appCode='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}'+
 'const Component=require('+JSON.stringify(entry)+').default;ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(Component,{compactAppMode:window.compact}));';

(async()=>{const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});try{const page=await browser.newPage();await page.setCacheEnabled(false);const errors=[];let failPhoto=false;page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{if(r.url().includes('/api/'))return r.respond({contentType:'application/json',body:JSON.stringify({ok:true,access:{authenticated:true,canContact:true,identityVisible:true},adverts:[{id:'a',title:'Tractor',condition:'used',status:'available',imageUrls:['/one.png','/two.png'],publishedAtIso:'2026-01-01',contactEligible:false}],pagination:{totalItems:1,totalPages:1,page:1,rangeStart:1,rangeEnd:1},summary:{totalAdverts:1,advertiserCount:1,provinceCount:1}})});if(r.url().endsWith('.png'))return failPhoto?r.respond({status:503,body:'Unavailable'}):r.respond({headers:{'Cache-Control':'no-store'},contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#528c68"/></svg>'});return r.respond({contentType:'text/html',body:'<html><body></body></html>'})});for(const width of [1440,390,320]){await page.setViewport({width,height:950});await page.goto('https://discovery.test/');await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial}#app{padding:24px}'+sheets.join('\n')+'</style><div id="app"></div><div id="aim4price-website-overlays"></div>');await page.evaluate(v=>window.compact=v,width<500);await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:appCode});await page.waitForSelector('button[aria-expanded="false"]');assert((await page.$eval('[data-discovery-card]',e=>e.textContent)).includes('Used'));await page.click('button[aria-expanded="false"]');await page.waitForSelector('button[aria-label="Next photo"]');await page.click('button[aria-label="Next photo"]');assert((await page.$eval('#recent-advert-a img',e=>e.src)).endsWith('/two.png'));await page.click('button[aria-label="Open Tractor photo 2"]');await page.waitForSelector('[role="dialog"]');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));assert(await page.$('#recent-advert-a'));failPhoto=true;
await page.click('button[aria-label="Previous photo"]');
await page.waitForFunction(()=>document.querySelector('#recent-advert-a')?.textContent.includes('Photo unavailable'));
assert(await page.$eval('#recent-advert-a [role="status"]',e=>e.scrollHeight<=e.clientHeight),'Failure message is not clipped');
await page.screenshot({path:'/tmp/recent-unavailable-'+width+'.png',fullPage:true});
failPhoto=false;
await page.evaluate(()=>[...document.querySelectorAll('#recent-advert-a button')].find(e=>e.textContent==='Retry photo').click());
await page.waitForFunction(()=>{const image=document.querySelector('#recent-advert-a img');return image?.complete&&image.naturalWidth>0});
await page.click('button[aria-label="Open Tractor photo 1"]');
await page.waitForSelector('button[aria-label="Close asset photos"]');
await page.keyboard.press('Escape');
await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
}assert.deepEqual(errors,[]);console.log('PASS Recently advertised capitalized condition, multiple photos, navigation and modal Escape and failure/retry at 1440, 390 and 320.');}finally{await browser.close()}})();
