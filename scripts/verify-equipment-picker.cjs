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


add('app/valuation/ValuationFlowPolish');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';




(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:1366,height:900});
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;background:#e5eee8;font:16px Arial;--website-visible-height:900px}button,input{font:inherit}'+sheets.join('\n')+'</style><div id="valuation-wizard-card"><div><span>Search asset type</span><input><button aria-expanded="false" id="trigger">Choose</button><div id="choices"></div></div></div><div id="app"></div>');
 await page.evaluate(()=>{
 const choices=[['Tractor','Tractors'],['Feedout Wagon','Feeding'],['Automatic Calf Feeder','Feeding'],['Milk Cooling Tank','Dairy'],['Baler','Implements']];
 for(const [label,group] of choices){const button=document.createElement('button');button.dataset.familyLabel=label;button.dataset.familyGroup=group;button.innerHTML='<span>'+label+'</span>';button.onclick=()=>{window.selectedFamily=label;document.getElementById('trigger').setAttribute('aria-expanded','false')};document.getElementById('choices').append(button)}
 document.getElementById('trigger').onclick=function(){this.setAttribute('aria-expanded',this.getAttribute('aria-expanded')==='true'?'false':'true')};
 });
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+"ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(require('app/valuation/ValuationFlowPolish').default));"});
 await page.click('#trigger');await page.waitForSelector('[role=dialog]');
 const click=async text=>{await page.$$eval('[role=dialog] button, [role=listbox] button',(els,text)=>{const el=els.find(e=>e.textContent===text || e.getAttribute('aria-label')===text || (e.getAttribute('role')==='option' && e.querySelector('span')?.textContent===text));if(!el)throw Error(text);el.click()},text)};
 await page.waitForFunction(()=>document.querySelector('[role=dialog]').textContent.includes('Automatic Calf Feeder'));
 assert.deepEqual(await page.$$eval('[role=dialog] button strong',els=>els.map(e=>e.textContent)),['Automatic Calf Feeder','Baler','Feedout Wagon','Milk Cooling Tank','Tractor']);
 await page.click('[aria-label="Filter by category"]');await click('Feeding');await page.waitForFunction(()=>document.querySelector('[role=dialog]').textContent.includes('2 matching asset types'));
 assert.deepEqual(await page.$$eval('[role=dialog] button strong',els=>els.map(e=>e.textContent)),['Automatic Calf Feeder','Feedout Wagon']);
 await page.type('[role=dialog] input','zzzz');await page.waitForFunction(()=>document.querySelector('[role=dialog]').textContent.includes('No matching'));
 await click('Clear search');await page.click('[aria-label="Filter by category"]');await click('All categories');assert(!await page.$('#family-picker-help'));

 await page.evaluate(()=>{
   const groups=['Animal Feed Equipment','Dairy & Poultry','Farm Maintenance','Farm Trailers','Grain & Produce Handling','Harvester Headers','Harvesting','Hay & Baling','Irrigation','Livestock Equipment','Orchard & Grass Care','Planting','Soil Preparation','Spraying & Spreading','Tractors'];
   for(let i=0;i<135;i++){const b=document.createElement('button');b.dataset.familyLabel='Equipment '+String(i+1).padStart(3,'0');b.dataset.familyGroup=groups[i%groups.length];b.innerHTML='<span>'+b.dataset.familyLabel+'</span>';document.getElementById('choices').append(b)}
 });
 await page.waitForFunction(()=>document.querySelector('[role=dialog]').textContent.includes('140 matching asset types'));
 await page.setViewport({width:1366,height:768});
 await page.evaluate(()=>document.body.style.setProperty('--website-visible-height','768px'));
 assert(await page.$eval('[aria-label="Filter by category"]',el=>el.getBoundingClientRect().height<65),'Category filter stays a single row with the full catalogue');
 assert(await page.$$eval('[role=dialog] button strong',els=>els.filter(el=>{const r=el.getBoundingClientRect();const dlg=el.closest('[role=dialog]');const bounds=dlg.getBoundingClientRect();return r.top>0&&r.bottom<bounds.bottom-28}).length>=8),'At least eight equipment options are visible');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
 await page.click('#trigger');
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('[aria-label="Filter by category"]')).animationIterationCount==='infinite');
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 assert.equal(await page.$eval('[aria-label="Filter by category"]',el=>getComputedStyle(el).animationName),'none');
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
 await page.screenshot({path:'/tmp/equipment-picker-desktop.png'});
 await page.click('[aria-label="Filter by category"]');
 await page.waitForSelector('[role="listbox"]');
 assert.equal(await page.$eval('[aria-label="Filter by category"]',el=>getComputedStyle(el).animationName),'none','Opening the filter stops the pulse');
 await page.screenshot({path:'/tmp/equipment-category-menu.png'});
 await page.keyboard.press('End');
 assert.equal(await page.evaluate(()=>document.activeElement.querySelector('span')?.textContent),'Tractors');
 await page.keyboard.press('Home');
 await page.keyboard.press('ArrowDown');
 await page.keyboard.press('Enter');
 assert.equal(await page.$eval('[aria-label="Filter by category"] span',el=>el.textContent),'Animal Feed Equipment');
 await page.click('[aria-label="Filter by category"]');await click('All categories');
 await page.click('[aria-label="Filter by category"]');await page.keyboard.press('Escape');
 assert(await page.$('[role="dialog"]'),'Escape closes only the category menu first');
 assert(!await page.$('[role="listbox"]'));

 await page.type('[role=dialog] input','Equipment');
 await page.waitForFunction(()=>document.querySelector('[role=dialog]').textContent.includes('135 matching asset types'));
 await page.click('[aria-label="Filter by category"]');
 assert.equal(await page.$$eval('[role=option] > span:first-child',els=>els.some(e=>e.textContent==='Feeding')),false,'Categories without search matches are omitted');
 await click('Animal Feed Equipment');
 assert.equal(await page.$eval('[role=dialog] input',el=>el.value),'Equipment','Category selection preserves search');
 await page.waitForFunction(()=>document.querySelector('[role=dialog]').textContent.includes('9 matching asset types'));
 await page.click('[aria-label="Filter by category"]');await click('All categories');await click('Clear family search');
 await page.type('[role=dialog] input','milk-cooling');await page.waitForFunction(()=>document.querySelector('[role=dialog]').textContent.includes('1 matching asset type'));
 await click('Milk Cooling Tank');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));assert.equal(await page.evaluate(()=>window.selectedFamily),'Milk Cooling Tank');
 await page.setViewport({width:390,height:844});await page.click('#trigger');await page.waitForSelector('[role=dialog]');
 await page.waitForFunction(()=>{const r=document.querySelector('[role=dialog]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'/tmp/equipment-picker-mobile.png'});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));
 assert.deepEqual(errors,[]);console.log('PASS alphabetical browsing, categories, empty recovery, styled category keyboard controls, normalised search, original selection, mobile fit and Escape');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
