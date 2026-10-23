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
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;background:#edf4ef;font-family:Arial}main{max-width:850px;margin:24px auto}section{background:white;border-radius:18px;margin:16px 0;padding:24px;min-height:140px}'+sheets.join('\n')+'</style><main><section data-value-tour="value"><div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap"><h2>Ideal Price</h2><div id="app"></div></div><h1>R 459 000</h1></section><section data-value-tour="replacement"><h2>Replacement price</h2>R 1 080 000</section><section data-value-tour="saleability"><h2>How easily could it sell?</h2>Calculate Realistic Market Price</section><section data-value-tour="details"><h2>Asset details</h2>Review usage and condition</section><section data-value-tour="assumptions"><h2>Advanced assumptions</h2>Expected lifetime</section></main>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.addScriptTag({content:runtime+"window.root=ReactDOM.createRoot(document.getElementById('app'));window.root.render(React.createElement(require('components/ValuationResultTour').default));"});
 const click=async text=>{await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===t),{},text);await page.$$eval('button',(nodes,t)=>nodes.find(n=>n.textContent.trim()===t).click(),text)};
 const finish=async()=>{while(await page.$('dialog[open]')){const done=await page.$$eval('button',nodes=>nodes.some(n=>n.textContent==='Done'));await click(done?'Done':'Next');await page.evaluate(()=>new Promise(requestAnimationFrame));}};
 await page.waitForSelector('[aria-haspopup="dialog"]');
 assert.equal(await page.$('button[aria-label="Close walkthrough"]'),null);
 await page.waitForSelector('dialog[open]');
 await page.waitForFunction(()=>document.querySelector('#value-tour-title')?.textContent==='Your Ideal Price');
 await page.waitForFunction(()=>!document.querySelector('dialog').getAnimations({subtree:true}).some(a=>a.playState==='running'));
 await page.screenshot({path:'/tmp/result-tour-desktop.png'});
 await click('Next');await page.waitForFunction(()=>document.querySelector('#value-tour-title').textContent==='Start with the right replacement price');
 await click('Back');await page.waitForFunction(()=>document.querySelector('#value-tour-title').textContent==='Your Ideal Price');
 await click('Next');await click('Next');await click('Next');
 await page.waitForFunction(()=>document.querySelector('#value-tour-title').textContent==='Make the details match your asset');
 await click('Next');await page.waitForFunction(()=>document.querySelector('#value-tour-title').textContent==='Review advanced assumptions');
 assert(await page.evaluate(()=>document.querySelector('dialog').textContent.includes('5 of 5') && !document.querySelector('dialog').textContent.includes('Quick guide')));
 await click('Done');assert.equal(await page.$('dialog[open]'),null);
 assert(await page.evaluate(()=>document.activeElement?.getAttribute('aria-haspopup')==='dialog'));
 await click('Explain my value');await page.waitForSelector('dialog[open]');
 await page.keyboard.press('Escape');assert(await page.$('dialog[open]'));
 await finish();
 await page.setViewport({width:390,height:844});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await click('Explain my value');await page.waitForSelector('dialog[open]');
 await click('Next');await page.waitForFunction(()=>document.querySelector('#value-tour-title').textContent==='Start with the right replacement price');
 await page.screenshot({path:'/tmp/result-tour-mobile.png'});
 assert(await page.evaluate(()=>{const r=document.querySelector('#value-tour-title').parentElement.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
 await page.keyboard.press('Tab');
 assert(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)));
 await finish();
 await page.evaluate(()=>document.querySelector('[data-value-tour="replacement"]').remove());
 await click('Explain my value');await page.waitForSelector('dialog[open]');
 assert(await page.evaluate(()=>document.querySelector('dialog').textContent.includes('1 of 4')));
 await click('Next');await page.waitForFunction(()=>document.querySelector('#value-tour-title').textContent==='Why the two prices can differ');

 await finish();
 await page.setViewport({width:1366,height:768});
 for (const scale of [0.6,1,1.2]) {
   await page.evaluate(scale=>{
     const main=document.querySelector('main');
     main.dataset.websiteCanvas='';main.dataset.websiteScale=String(scale);
     main.style.zoom=String(scale);
     main.style.setProperty('--website-visible-width',innerWidth/scale+'px');
     main.style.setProperty('--website-visible-height',innerHeight/scale+'px');
   },scale);
   await click('Explain my value');await page.waitForSelector('dialog[open]');
   await page.waitForFunction(()=>!document.querySelector('dialog').getAnimations({subtree:true}).some(a=>a.playState==='running'));
   const geometry=await page.evaluate(()=>{
     const target=document.querySelector('[data-value-tour="value"]').getBoundingClientRect();
     const spotlight=document.querySelector('dialog > div').getBoundingClientRect();
     const panel=document.querySelector('#value-tour-title').parentElement.getBoundingClientRect();
     return {target:{left:target.left,top:target.top,right:target.right,bottom:target.bottom},spotlight:{left:spotlight.left,top:spotlight.top,right:spotlight.right,bottom:spotlight.bottom},panel:{left:panel.left,top:panel.top,right:panel.right,bottom:panel.bottom},width:innerWidth,height:innerHeight};
   });
   assert(Math.abs(geometry.target.left-geometry.spotlight.left)<=9,JSON.stringify({scale,geometry}));
   assert(Math.abs(geometry.target.top-geometry.spotlight.top)<=9,JSON.stringify({scale,geometry}));
   assert(geometry.panel.left>=0&&geometry.panel.right<=geometry.width&&geometry.panel.top>=0&&geometry.panel.bottom<=geometry.height,JSON.stringify({scale,geometry}));
   await finish();
 }

 await page.evaluate(()=>document.querySelector('[data-value-tour="assumptions"]').dataset.valueTourReadonly='true');
 await click('Explain my value');await page.waitForSelector('dialog[open]');
 await click('Next');await click('Next');await click('Next');
 await page.waitForFunction(()=>document.querySelector('#value-tour-description').textContent.includes('requires an active Aim4price account'));
 await finish();
 // Match the result page's main column and right action column.
 await page.setViewport({width:1600,height:900});
 await page.evaluate(()=>{
   const main=document.querySelector('main');main.style.zoom='1';main.dataset.websiteScale='1';main.style.maxWidth='1100px';
   main.style.setProperty('--website-visible-width',innerWidth+'px');main.style.setProperty('--website-visible-height',innerHeight+'px');
   document.querySelectorAll('section').forEach(el=>el.style.width='660px');
 });
 await click('Explain my value');await page.waitForSelector('dialog[open]');
 await page.waitForFunction(()=>{
   const target=document.querySelector('[data-value-tour="value"]').getBoundingClientRect();
   const panel=document.querySelector('#value-tour-title').parentElement.getBoundingClientRect();
   return panel.left>=target.right+16 && panel.right<=innerWidth-16;
 });
 await page.screenshot({path:'/tmp/result-tour-side.png'});
 await finish();
 // Remounting a new result must start the walkthrough again.
 await page.evaluate(()=>window.root.render(React.createElement(require('components/ValuationResultTour').default,{key:'new-estimate'})));
 await page.waitForSelector('dialog[open]');await finish();
 // Exercise the production step-reset function with a reused, focused footer.
 const valuationSource=fs.readFileSync(path.join(root,'app/valuation/valuation-client.tsx'),'utf8');
 const scrollFunction=valuationSource.slice(valuationSource.indexOf('  function scrollWizardToStart() {'),valuationSource.indexOf('  function scrollToDetailsCard'));
 await page.addScriptTag({content:'const wizardScrollFrameRef={current:0};'+scrollFunction+';window.resetWizardScroll=scrollWizardToStart;'});
 await page.evaluate(()=>{
   window.root.unmount();
   document.body.innerHTML='<div style="height:180px"></div><div id="valuation-wizard-card" tabindex="-1" style="scroll-margin-top:112px"><h2>Current step</h2><div id="step-content" style="height:1400px"></div><button id="next-step">Continue</button></div><div style="height:1000px"></div>';
   document.getElementById('next-step').focus();
   window.resetWizardScroll();
   document.querySelector('h2').textContent='Next step';
   document.getElementById('step-content').style.height='800px';
 });
 await page.waitForFunction(()=>document.activeElement?.id==='valuation-wizard-card' && Math.abs(document.getElementById('valuation-wizard-card').getBoundingClientRect().top-112)<2);
 assert.deepEqual(errors,[]);
 console.log('PASS mandatory start on every result, five steps, Back/Done, keyboard, mobile, zoom alignment');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
