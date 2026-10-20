/* Result walkthrough browser checks with synthetic assets; no real writes. */
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


add('components/ValuationResultTour');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';




(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:1366,height:768});
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;background:#edf4ef;font-family:Arial}main{max-width:850px;margin:24px auto}section{background:white;border-radius:18px;margin:16px 0;padding:24px;min-height:140px}'+sheets.join('\n')+'</style><main><div id="app"></div><section data-value-tour="value"><h2>Estimated asset value</h2><h1>R 459 000</h1></section><section data-value-tour="replacement"><h2>Replacement price</h2>R 1 080 000</section><section data-value-tour="saleability"><h2>How easily could it sell?</h2>Refine Saleability</section><section data-value-tour="settings"><h2>Valuation settings</h2>Review usage and condition</section></main>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:runtime+"window.root=ReactDOM.createRoot(document.getElementById('app'));window.root.render(React.createElement(require('components/ValuationResultTour').default));"});
 const click=async text=>{await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>b.textContent===t),{},text);await page.$$eval('button',(nodes,t)=>nodes.find(n=>n.textContent===t).click(),text)};
 await page.waitForSelector('[aria-haspopup="dialog"]');
 assert.equal(await page.$('dialog[open]'),null);
 await page.click('[aria-haspopup="dialog"]');
 await page.waitForSelector('dialog[open]');
 await page.waitForFunction(()=>document.querySelector('#value-tour-title')?.textContent==='Your estimated value');
 await page.waitForFunction(()=>!document.querySelector('dialog').getAnimations({subtree:true}).some(a=>a.playState==='running'));
 await page.screenshot({path:'/tmp/result-tour-desktop.png'});
 await click('Next');await page.waitForFunction(()=>document.querySelector('#value-tour-title').textContent==='Replacement price');
 await click('Back');await page.waitForFunction(()=>document.querySelector('#value-tour-title').textContent==='Your estimated value');
 await click('Next');await click('Next');await click('Next');
 await page.waitForFunction(()=>document.querySelector('#value-tour-title').textContent==='Fine-tune your estimate');
 await click('Done');assert.equal(await page.$('dialog[open]'),null);
 assert(await page.evaluate(()=>document.activeElement?.getAttribute('aria-haspopup')==='dialog'));
 await click('Show me around');await page.waitForSelector('dialog[open]');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 await page.setViewport({width:390,height:844});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await click('Show me around');await page.waitForSelector('dialog[open]');
 await click('Next');await page.waitForFunction(()=>document.querySelector('#value-tour-title').textContent==='Replacement price');
 await page.screenshot({path:'/tmp/result-tour-mobile.png'});
 assert(await page.evaluate(()=>{const r=document.querySelector('#value-tour-title').parentElement.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
 await page.keyboard.press('Tab');
 assert(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)));
 await click('Skip');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 await page.evaluate(()=>document.querySelector('[data-value-tour="replacement"]').remove());
 await click('Show me around');await page.waitForSelector('dialog[open]');
 assert(await page.evaluate(()=>document.querySelector('dialog').textContent.includes('1 of 3')));
 await click('Next');await page.waitForFunction(()=>document.querySelector('#value-tour-title').textContent==='Saleability');
 assert.deepEqual(errors,[]);
 console.log('PASS optional start, four steps, Back, Done, focus restore, Escape, Skip, reopen, mobile, reduced motion and missing target');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
