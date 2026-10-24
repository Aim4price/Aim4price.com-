/* Facebook advert handoff with synthetic listing data; no external posts. */
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


add('components/asset-register/AssetAccessSettingsDialog');
add('components/asset-register/ShareHistory');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';



(async()=>{
 const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],headless:true,pipe:true});
 try {
 const page=await browser.newPage();await page.setViewport({width:1440,height:1000});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;font-family:Arial}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:runtime+`;window.fetch=async()=>({ok:true,json:async()=>({shares:[{token:'test',created_at:'2026-10-24T10:00:00Z',recipient_name:'Test recipient',permissions:{}}],hasMore:false})});
 const root=ReactDOM.createRoot(document.getElementById('app'));
 root.render(React.createElement(require('components/asset-register/AssetAccessSettingsDialog').default,{title:'Sharing history',assetTitle:'Test umbrella',onClose:()=>{}},React.createElement(require('components/asset-register/ShareHistory').default,{assetIds:['test'],subject:'Test umbrella',onBack:()=>{}})));`});
 await page.waitForSelector('[data-share-history] article');
 const gap=await page.$eval('[data-share-history]',panel=>{const header=panel.closest('[role=dialog]').querySelector('h3').parentElement.parentElement;return panel.querySelector('p').getBoundingClientRect().top-header.getBoundingClientRect().bottom;});
 assert(gap>=0&&gap<24,'History header gap: '+gap);
 await page.screenshot({path:'/tmp/share-history-fixed.png'});
 await page.evaluate(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Settings').click());
 await page.waitForFunction(()=>document.body.textContent.includes('Choose permissions'));
 await page.evaluate(()=>document.querySelector('[aria-label="Choose permissions"]').click());
 await page.waitForFunction(()=>document.body.textContent.includes('Update market price'));
 const market=await page.evaluate(()=>Array.from(document.querySelectorAll('label')).find(l=>l.textContent.includes('Update market price')).querySelector('input').checked);assert.equal(market,false);
 await page.evaluate(()=>Array.from(document.querySelectorAll('label')).find(l=>l.textContent.includes('Select all permissions')).querySelector('input').click());
 assert(await page.evaluate(()=>Array.from(document.querySelectorAll('label')).find(l=>l.textContent.includes('Update market price')).querySelector('input').checked));
 await page.screenshot({path:'/tmp/share-market-permissions.png'});
 assert.deepEqual(errors,[]);console.log('PASS compact sharing history, default-off market permission and select-all');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
