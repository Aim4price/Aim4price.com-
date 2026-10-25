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




const client=fs.readFileSync(path.join(root,'app/valuation/valuation-client.tsx'),'utf8');
const start=client.indexOf('      <div className={`${styles.resultsLayout} ${styles.finalEstimateLayout}`}>');
const end=client.indexOf('\n    );\n  }',start);
const jsx=client.slice(start,end);
add('app/valuation/page.module.css');add('components/estimate-modal.module.css');
const breakdown=client.slice(client.indexOf('  function renderResultReplacementBreakdown()'),client.indexOf('  function getCurrentResultReplacementPriceExVat()'));
const code=ts.transpileModule(breakdown+'\nfunction Fixture(){return ('+jsx+');}',{compilerOptions:{target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText;
const react=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),'utf8');
const reactDOM=fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),'utf8');
const styleMap=JSON.parse(modules['app/valuation/page.module.css'].slice('module.exports='.length));
const modalMap=JSON.parse(modules['components/estimate-modal.module.css'].slice('module.exports='.length));
(async()=>{const browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:['--no-sandbox'],headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:1366,height:1000});
 await page.setContent('<style>*{box-sizing:border-box}body{margin:24px;font-family:Arial;background:#f4f8f6}#app{max-width:1100px;margin:auto}'+sheets.join('\n')+'</style><div id="app"></div>');
 await page.addScriptTag({content:react});await page.addScriptTag({content:reactDOM});
 await page.evaluate(({code,styleMap,modalMap})=>{
 const h=React.createElement;
 const env={Number,styles:styleMap,modalStyles:modalMap,basicEstimateActive:true,isGeneric:true,genericResult:{sector:{key:'agricultural'},family:{key:'tractor'},usageAmount:4000},resultState:{kind:'generic',result:{specsJson:{basic_extra_replacement_price_ex_vat:15000}}},resultHeroTone:'',headlineDisplayValue:431903,headlineValue:431903,headlineVatLabel:'VAT excluded',vatDisplayMode:'excl',machineTitle:'Tractor • Example model',yearSummary:'2021',usageSummary:'4 000 hours',resultCondition:'fair',appliedAdvancedAssumptions:{popularityStars:4},canUseAdvancedAssumptions:true,isSignedIn:true,canSaveToAssetRegister:true,canUseMarketplacePublishFlow:true,currentMarketPrice:null,
 money:v=>'R '+Math.round(v).toLocaleString('en-ZA'),getVatDisplayValue:v=>v,getCurrentResultReplacementPriceExVat:()=>985000,conditionLabel:()=> 'Fair',getSaleabilityInputFromResult:()=>({}),
 renderDetailIcon:()=>h('span',{className:styleMap.detailIcon},h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor'},h('circle',{cx:12,cy:12,r:8}))),renderResultActionIcon:()=>h('span',{className:styleMap.resultActionIcon},'↗'),ValuationResultTour:()=>h('button',null,'Explain my value'),SaleabilityModal:()=>null,AdvancedAssumptionsModal:()=>null,
 renderResultReplacementBreakdown:()=>h('div',{className:styleMap.replacementCostSummary},h('dl',{className:styleMap.replacementCostParts},h('div',null,h('dt',null,'Asset price'),h('dd',null,'R 970 000')),h('div',null,h('dt',null,'Selected extras'),h('dd',null,'R 15 000'))),h('div',{className:styleMap.replacementCostTotal},h('span',null,'Total replacement price'),h('strong',null,'R 985 000'),h('small',null,'VAT excluded')))};
 const proxy=new Proxy(env,{has:(_,key)=>!['React','Fixture','renderResultReplacementBreakdown'].includes(key),get:(target,key)=>key===Symbol.unscopables?undefined:key in target?target[key]:key==='Array'?Array:key==='undefined'?undefined:/^(render|get|set|open|save|download|create|parse|apply|update)/.test(String(key))?()=>null:null});
 window.env=env;window.root=ReactDOM.createRoot(document.getElementById('app'));window.Fixture=new Function('env','React','with(env){'+code+';return Fixture;}')(proxy,React);window.root.render(h(window.Fixture));
 },{code,styleMap,modalMap});
 await page.waitForSelector('[data-value-tour="saleability"]');assert.deepEqual(errors,[]);
 const rect=selector=>page.$eval(selector,e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,bottom:r.bottom};});
 const hero=await rect('[data-value-tour="value"]'),actions=await rect('[aria-label="Estimate actions"]');
 assert(Math.abs(hero.y-actions.y)<2,'Main value and actions share the top row');
 const replacement=await rect('[data-value-tour="replacement"]'),market=await rect('[data-value-tour="saleability"]');
 assert(Math.abs(replacement.y-market.y)<2,'Supporting cards align');assert(market.x>replacement.x+replacement.w,'Cards use both columns');
 await page.screenshot({path:'/tmp/final-layout.png',fullPage:true});
 const buttons=await page.$$eval('[data-value-tour="replacement"] > button, [data-value-tour="saleability"] > button',els=>els.map(e=>({y:e.getBoundingClientRect().y,h:e.getBoundingClientRect().height})));
 assert(Math.abs(buttons[0].y-buttons[1].y)<2,'Actions align at the top');
 const actionStyles=await page.$$eval('[data-value-tour="replacement"] > button, [data-value-tour="saleability"] > button',els=>els.map(el=>{const s=getComputedStyle(el);return [s.fontFamily,s.fontWeight,s.fontSize,s.padding,s.borderRadius,s.backgroundColor,s.color]}));
 assert.deepEqual(actionStyles[0],actionStyles[1], 'Adjust and Calculate use the same design');

 await page.evaluate(()=>{window.env.currentMarketPrice=390000;window.root.render(React.createElement(window.Fixture));});
 await page.waitForFunction(()=>document.querySelector('[data-value-tour="saleability"]').textContent.includes('390'));
 assert.equal(await page.$eval('[data-value-tour="saleability"] button',el=>el.textContent),'Update');
 const amounts=await page.$$eval('[data-value-tour="replacement"] strong, [data-value-tour="saleability"] strong',els=>els.map(e=>({y:e.getBoundingClientRect().y,font:getComputedStyle(e).fontSize})));
 assert.equal(amounts[0].font,amounts[1].font,'Matching main price sizes');
 assert(Math.abs(amounts[0].y-amounts[1].y)<2,'Matching main price baselines');
 await page.screenshot({path:'/tmp/price-cards.png',fullPage:true});

 await page.setViewport({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No mobile horizontal overflow');
 await page.screenshot({path:'/tmp/final-layout-mobile.png',fullPage:true});
 await page.evaluate(()=>{
   Object.assign(window.env,{breakdownAccess:true,activeBreakdown:{report:{}},getResultUsageMetricType:()=> 'hours',getResultMaxLifetimeUsage:()=>14000,formatPlainNumber:v=>String(v).replace(/\B(?=(\d{3})+(?!\d))/g,' '),EstimateTools:()=>null});
   window.root.render(React.createElement(window.Fixture));
 });
 await page.waitForFunction(()=>document.body.textContent.includes('Expected lifetime'));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.setViewport({width:1366,height:1000});
 await page.screenshot({path:'/tmp/price-cards-lifetime.png',fullPage:true});
 await page.evaluate(()=>{
   Object.assign(window.env,{breakdownAccess:false,advancedShowLifetimeInput:true,advancedLifetimeShortUnit:'hours',openFinalLifetimeModal:()=>{window.lifetimeOpened=true}});
   window.root.render(React.createElement(window.Fixture));
 });
 await page.waitForFunction(()=>document.querySelector('[data-value-tour="assumptions"]')?.textContent.includes('14 000'));
 await page.click('[data-value-tour="assumptions"] button');
 assert(await page.evaluate(()=>window.lifetimeOpened), 'Normal account opens the standard lifetime editor directly');
 assert(!(await page.evaluate(()=>document.body.textContent.includes('Advanced assumptions'))));
 assert.deepEqual(errors,[]);console.log('PASS desktop supporting-card alignment, completed market result and mobile layout');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
