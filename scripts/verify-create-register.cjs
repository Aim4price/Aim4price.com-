/* Shared-link/Leads dialog checks with synthetic data; no real writes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),postcss=require('postcss'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..'),modules={},sheets=[];
let cssIndex=0;
const stubs={'components/DateInput':'module.exports=()=>null;'};
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



add('components/asset-register/CreateAssetRegisterModal');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';



(async()=>{
const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],headless:true});
try {
const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.setViewport({width:1280,height:720});
await page.setContent('<style>*{box-sizing:border-box}body{margin:0;background:#dce7e0;font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');
await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
await page.addScriptTag({content:runtime+`function Demo(){const [draft,setDraft]=React.useState({businessName:'',email:'',phone:'',addressLine1:'',includeInCombinedTotals:true});return React.createElement(require('components/asset-register/CreateAssetRegisterModal').default,{draft,onChange:setDraft,onSubmit:e=>{e.preventDefault();window.saved=draft;},onClose:()=>{},busy:false});}ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(Demo));`});
await page.waitForSelector('[role="switch"]');
for(const [width,height] of [[1280,720],[1440,900],[390,844]]) {
 await page.setViewport({width,height});
 const fit=await page.$eval('form',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight});assert(fit,'Dialog exceeds viewport');
 assert(await page.$eval('form',el=>el.scrollWidth<=el.clientWidth+1),'Horizontal overflow');
 if(width>1000)assert(await page.$eval('form',el=>Array.from(el.querySelectorAll('*')).every(n=>n.scrollHeight<=n.clientHeight+1||getComputedStyle(n).overflowY!=='auto')),'Unnecessary desktop scrolling');
 await page.screenshot({path:'/tmp/register-create-'+width+'.png'});
}
await page.locator('input[required]').fill('Example Farm');await page.click('[role="switch"]');await page.click('button[type="submit"]');
assert.equal(await page.evaluate(()=>window.saved.includeInCombinedTotals),false);assert.equal(await page.evaluate(()=>window.saved.businessName),'Example Farm');assert.deepEqual(errors,[]);console.log('PASS register modal bounds, desktop scrolling, inclusion switch and submission');
} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
