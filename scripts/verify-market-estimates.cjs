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


add('components/asset-register/AssetPriceSwitch');
add('components/asset-register/AssetMarketDetail');
add('components/SaleabilityModal');
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const runtime='const sources='+JSON.stringify(modules)+',cache={};'+
 'function require(name){if(name==="react")return React;if(name==="next/dynamic")return ()=>()=>null;if(name==="react-dom")return ReactDOM;if(name==="next/link")return ({prefetch,...props})=>React.createElement("a",props);if(name==="next/navigation")return {useRouter:()=>({prefetch:()=>{},refresh:()=>{},push:()=>{}}),usePathname:()=>"/admin"};if(name==="react/jsx-runtime")return {jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),Fragment:React.Fragment};if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!sources[name])throw Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}';



(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#edf4ef;font-family:Arial}#app{background:white;padding:24px;border-radius:20px;max-width:650px;margin:auto}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});await page.addScriptTag({content:runtime+`window.root=ReactDOM.createRoot(document.getElementById('app'));window.renderCard=(saved,replacementPrice=1000000)=>{function App(){const [view,setView]=React.useState('fair'),[vat,setVat]=React.useState(false);return React.createElement(require('components/asset-register/AssetPriceSwitch').default,{value:459000,manual:false,view,onViewChange:setView,replacementPrice,replacementParts:{asset:900000,extras:100000},onEditReplacement:()=>{window.editReplacement=true},onRecalculate:()=>{window.recalculate=true},included:vat,onVatChange:setVat,saved,stale:!!saved,canCalculate:true,loading:false,error:false,onCalculate:()=>{window.calculateClicked=true}})}window.root.render(React.createElement(App,{key:String(Math.random())}));};window.renderCard();`});
 const click=async text=>{const basis={'Replacement':'replacement','Fair value':'fair','Market estimate':'market'}[text];if(basis){await page.waitForSelector('select[aria-label="Value basis"]');await page.select('select[aria-label="Value basis"]',basis);return;}await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>b.textContent===t),{},text);await page.$$eval('button',(nodes,t)=>nodes.find(n=>n.textContent===t).click(),text)};
 await page.setViewport({width:1366,height:768});await click('Market estimate');await click('Calculate market estimate');assert(await page.evaluate(()=>window.calculateClicked));
 await page.evaluate(()=>window.renderCard({priceExVat:425000,assessedAt:'2026-10-19T10:00:00Z'}));await click('Market estimate');await click('Incl. VAT');
 assert(await page.evaluate(()=>document.querySelector('section strong').textContent.replace(/\D/g,'')==='488750'));
 await click('Fair value');assert(await page.evaluate(()=>document.querySelector('section strong').textContent.replace(/\D/g,'')==='527850'));
 await click('Replacement');assert(await page.evaluate(()=>document.querySelector('section strong').textContent.replace(/\D/g,'')==='1150000'));
 await click('Edit replacement price');assert(await page.evaluate(()=>window.editReplacement));
 await page.click('[aria-label="About replacement"]');assert(await page.evaluate(()=>document.body.textContent.includes('supplier quotation')));
 await click('Fair value');await click('Recalculate value');assert(await page.evaluate(()=>window.recalculate));
 await click('Market estimate');assert(await page.evaluate(()=>document.body.textContent.includes('Review needed')));
 await page.screenshot({path:'/tmp/market-card-desktop.png'});
 await page.setViewport({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/market-card-mobile.png'});
 await page.evaluate(()=>window.renderCard(undefined,null));await click('Replacement');await click('Add replacement price');assert(await page.evaluate(()=>document.body.textContent.includes('Replacement price not set')));

 await page.evaluate(()=>{
   window.renderMarketDetail=(saved,extra={})=>window.root.render(React.createElement(require('components/asset-register/AssetMarketDetail').default,{
     saved,stale:false,included:false,loading:false,error:false,canCalculate:true,onCalculate:()=>{window.detailCalculated=(window.detailCalculated||0)+1},...extra
   }));
   window.renderMarketDetail();
 });
 await page.waitForSelector('[aria-label="Open saleability assessment"]');
 await page.click('[aria-label="Open saleability assessment"]');
 assert.equal(await page.evaluate(()=>window.detailCalculated),1);
 await page.evaluate(()=>window.renderMarketDetail({priceExVat:425000,assessedAt:'2026-10-19T10:00:00Z'},{included:true,stale:true}));
 await page.waitForFunction(()=>document.querySelector('[aria-label="Estimated selling price"] [aria-live="polite"]')?.textContent.replace(/\D/g,'')==='488750');
 await page.focus('[aria-label="Open saleability assessment"]');
 await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>window.detailCalculated),2);
 assert(await page.evaluate(()=>document.body.textContent.includes('Review needed')));
 assert.equal(await page.$('[aria-label="About estimated selling price"]'),null);
 assert.equal(await page.$eval('[aria-label="Open saleability assessment"] strong',node=>node.textContent),'SALEABILITY');
 assert(await page.evaluate(()=>!document.querySelector('[aria-label="Estimated selling price"]').textContent.includes('Open assessment')));
 assert.equal(await page.evaluate(()=>window.detailCalculated),2);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.evaluate(()=>window.renderMarketDetail(undefined,{error:true}));
 await page.waitForFunction(()=>document.body.textContent.includes('Unavailable'));
 assert(await page.evaluate(()=>document.querySelector('[aria-label="Open saleability assessment"]').disabled));
 await page.evaluate(()=>window.renderMarketDetail(undefined,{canCalculate:false}));
 await page.waitForFunction(()=>document.body.textContent.includes('Not calculated'));
 assert(await page.evaluate(()=>document.querySelector('[aria-label="Saleability estimate"]').disabled));
 await page.evaluate(()=>{window.root.render(React.createElement(require('components/SaleabilityModal').default,{open:true,onClose:()=>{window.modalClosed=true},assetTitle:'Test asset',valuationExVat:459000,input:{condition:'good',lifeWorkedPercent:50},initialAnswers:{saleArea:'province',similarAssetsAvailable:'one_to_three',realisticBuyerPool:'moderate',currentDemand:'normal',modelFamiliarity:'common',desiredTimeline:'60',sellingPriority:'balanced'},onSave:async answers=>{window.sent=answers;if(!window.allowSave)throw Error('Save failed — retry');}}));});
 await click('Save market estimate');await page.waitForFunction(()=>document.body.textContent.includes('Save failed — retry'));assert.equal(await page.evaluate(()=>!!window.modalClosed),false);
 await page.evaluate(()=>window.allowSave=true);await click('Save market estimate');await page.waitForFunction(()=>window.modalClosed);assert.equal(await page.evaluate(()=>window.sent.currentDemand),'normal');
 assert.deepEqual(errors,[]);console.log('PASS all three price views, replacement actions, independent VAT, empty states, mobile fit and save retry');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
