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

// Exercise the actual pre-save prompt and entry guard with a synthetic estimate.
const valuationSource=fs.readFileSync(path.join(root,'app/valuation/valuation-client.tsx'),'utf8');
const saveEntry=valuationSource.slice(valuationSource.indexOf('  function openFinalSaveModal('),valuationSource.indexOf('  function closeFinalSaveModal()'));
const savePrompt=valuationSource.slice(valuationSource.indexOf("      {finalSaveIntent && saveMarketChoice === 'prompt'"),valuationSource.indexOf("      {finalSaveIntent && !conversionAssetId && !saveMarketChoice"));
const completionProps=valuationSource.slice(valuationSource.indexOf('          onClose={() => {\n            setSaleabilityOpen(false);'),valuationSource.indexOf('          assetTitle={machineTitle}',valuationSource.indexOf('        <SaleabilityModal')));
add('app/valuation/page.module.css');
add('lib/estimate-photo-handoff');
const saveFixture=`import React,{useState} from 'react';
import SaleabilityModal from 'components/SaleabilityModal';
import {getEstimatePhotoFiles} from 'lib/estimate-photo-handoff';
import styles from 'app/valuation/page.module.css';import modalStyles from 'components/estimate-modal.module.css';
export default function SaveFixture(){
const [resultState,setResultState]=useState({id:1}),headlineValue=459000;
const [finalSaveEditing,setFinalSaveEditing]=useState(false);
const [savePhotoFiles,setSavePhotoFiles]=useState([]),[savePhotoMode,setSavePhotoMode]=useState('skip');
const [finalSaveIntent,setFinalSaveIntent]=useState(null),[saveMarketChoice,setSaveMarketChoice]=useState(null);
const [saleabilityOpen,setSaleabilityOpen]=useState(false),[completedMarketAssessment,setCompletedMarketAssessment]=useState(null);
const dealerSaveTargetRegisterId='',isSignedIn=true,canSaveToAssetRegister=true,isDealerAccount=false,canUseMarketplacePublishFlow=true,conversionAssetId=null,userReplacementPrice='500000';
const getCurrentResultReplacementPriceExVat=()=>500000,setMessage=()=>{},setFinalSaveError=()=>{},setReplacementPanelOpen=()=>{},setUserReplacementPrice=()=>{};
function closeFinalSaveModal(){setFinalSaveIntent(null);setSaveMarketChoice(null);}
${saveEntry}
return <><button onClick={()=>openFinalSaveModal('asset-register')}>Save asset</button>
<button onClick={()=>setResultState({id:2})}>Change estimate</button>
${savePrompt}
{finalSaveIntent&&!saveMarketChoice?<output data-photo-count={savePhotoFiles.length} data-photo-mode={savePhotoMode}>Save review</output>:null}
<SaleabilityModal open={saleabilityOpen} ${completionProps}
 assetTitle="Fixture" valuationExVat={headlineValue} input={{}} />
</>;
}`;
modules['save-fixture']=ts.transpileModule(saveFixture,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
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
 const click=async text=>{const basis={'Replacement':'replacement','Fair value':'fair','Market estimate':'market'}[text];if(basis){await page.waitForSelector('select[aria-label="Value basis"]');await page.select('select[aria-label="Value basis"]',basis);return;}await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>(b.textContent===t||b.querySelector("strong")?.textContent===t)),{},text);await page.$$eval('button',(nodes,t)=>nodes.find(n=>(n.textContent===t||n.querySelector("strong")?.textContent===t)).click(),text)};
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
 await page.waitForSelector('[aria-label="Open Realistic Market Value"]');
 await page.click('[aria-label="Open Realistic Market Value"]');
 assert.equal(await page.evaluate(()=>window.detailCalculated),1);
 await page.evaluate(()=>window.renderMarketDetail({priceExVat:425000,assessedAt:'2026-10-19T10:00:00Z'},{included:true,stale:true}));
 await page.waitForFunction(()=>document.querySelector('[aria-label="Realistic Market Value"] [aria-live="polite"]')?.textContent.replace(/\D/g,'')==='488750');
 await page.focus('[aria-label="Update needed: open Realistic Market Value"]');
 await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>window.detailCalculated),2);
 assert(await page.evaluate(()=>document.body.textContent.includes('Update needed') && !document.body.textContent.includes('Previous estimate')));
 assert(await page.evaluate(()=>!!document.querySelector('[data-detail-icon="alert"]')));
 assert.equal(await page.$eval('[aria-label="Realistic Market Value"]',el=>getComputedStyle(el).backgroundColor),'rgb(255, 241, 242)');
 assert.equal(await page.$('[aria-label="About estimated selling price"]'),null);
 assert.equal(await page.$eval('[aria-label="Update needed: open Realistic Market Value"] strong',node=>node.textContent),'Realistic Market Value');
 assert(await page.evaluate(()=>!document.querySelector('[aria-label="Realistic Market Value"]').textContent.includes('Open assessment')));
 assert.equal(await page.evaluate(()=>window.detailCalculated),2);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // A newly saved matching basis restores the normal presentation.
 await page.evaluate(()=>window.renderMarketDetail({priceExVat:430000,assessedAt:'2026-10-19T11:00:00Z'},{stale:false}));
 await page.waitForSelector('[aria-label="Open Realistic Market Value"]');
 assert(await page.evaluate(()=>!document.body.textContent.includes('Update needed') && !document.body.textContent.includes('Previous estimate')));
 assert.equal(await page.$eval('[aria-label="Realistic Market Value"]',el=>getComputedStyle(el).backgroundColor),'rgb(240, 247, 255)');
 await page.evaluate(()=>window.renderMarketDetail(undefined,{error:true}));
 await page.waitForFunction(()=>document.body.textContent.includes('Unavailable'));
 assert(await page.evaluate(()=>document.querySelector('[aria-label="Open Realistic Market Value"]').disabled));
 await page.evaluate(()=>window.renderMarketDetail(undefined,{canCalculate:false}));
 await page.waitForFunction(()=>document.body.textContent.includes('Not calculated'));
 assert(await page.evaluate(()=>document.querySelector('button[aria-label="Realistic Market Value"]').disabled));
 await page.evaluate(()=>{window.fetch=async()=>({ok:true,json:async()=>({quote:{priceExVat:390000,resultLabel:'Estimated selling price',modelVersion:'saleability-2.0',ease:{score:72,version:'fixture-ease',provisional:false}}})});window.root.render(React.createElement(require('components/SaleabilityModal').default,{open:true,onClose:()=>{window.modalClosed=true},assetTitle:'Test asset',valuationExVat:459000,input:{condition:'good',lifeWorkedPercent:50},initialAnswers:{modelVersion:2,sellingRoute:'direct',saleArea:'province',similarAssetsAvailable:'one_to_three',realisticBuyerPool:'moderate',currentDemand:'normal',modelFamiliarity:'common',desiredTimeline:'60',sellingPriority:'balanced'},onSave:async answers=>{window.sent=answers;if(!window.allowSave)throw Error('Save failed — retry');}}));});
 await page.waitForSelector('[aria-label="Your selling estimate"]');
 assert(!await page.evaluate(()=>document.body.textContent.includes('Uses your previous answers')));
 await page.setViewport({width:1366,height:768});
 assert(await page.evaluate(()=>!document.querySelector('[role="dialog"]').textContent.includes('Question 1 of 5')));
 await page.screenshot({path:'/tmp/saleability-recalculate.png'});
 await page.setViewport({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Recalculate'&&!b.disabled));
 await click('Recalculate');await page.waitForFunction(()=>document.body.textContent.includes('Save failed — retry'));assert.equal(await page.evaluate(()=>!!window.modalClosed),false);
 await page.evaluate(()=>window.allowSave=true);await click('Recalculate');await page.waitForFunction(()=>window.modalClosed);assert.equal(await page.evaluate(()=>window.sent.currentDemand),'normal');
 await click('Change answers');
 await page.waitForSelector('[aria-label="Question 1 of 5"]');
 await page.$$eval('button',nodes=>nodes.find(n=>n.textContent.includes('Dealer / trade-in')).click());
 await page.waitForSelector('[aria-label="Question 2 of 5"]');
 // Complete all five questions and check the uncluttered result.
 await page.$$eval('button',nodes=>nodes.find(n=>n.querySelector('strong')?.textContent==='Within 30 days').click());
 await page.waitForSelector('[aria-label="Question 3 of 5"]');
 await click('Near me');
 await page.waitForSelector('[aria-label="Question 4 of 5"]');
 await page.$$eval('button',nodes=>nodes.find(n=>n.textContent.startsWith('Normal')).click());
 await page.waitForSelector('[aria-label="Question 5 of 5"]');
 await click('Several');
 await page.waitForFunction(()=>document.body.textContent.includes('Estimated selling price'));
 assert(!await page.evaluate(()=>/Rating details|Market score|Grade [A-E]/.test(document.body.textContent)));
 await page.setViewport({width:1366,height:768});
 assert(await page.$eval('[aria-label="Your selling estimate"]',el=>el.scrollHeight<=el.clientHeight+1));
 assert.equal(await page.$eval('[role="meter"]',el=>el.getAttribute('aria-valuenow')),'72');
 await click('Incl. VAT');
 assert.equal(await page.$eval('[role="meter"]',el=>el.getAttribute('aria-valuenow')),'72','VAT does not change ease');
 assert(await page.evaluate(()=>document.body.textContent.includes('Not a probability or guarantee of sale.')));
 await page.screenshot({path:'/tmp/saleability-v2-desktop.png'});
 await page.setViewport({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'/tmp/saleability-v2-mobile.png'});

 // Fresh assessments must not preselect a selling area, even for dealers.
 await page.setViewport({width:1280,height:650});
 await page.evaluate(()=>window.root.render(React.createElement(require('components/SaleabilityModal').default,{key:'fresh-spacing',open:true,onClose:()=>{},assetTitle:'2022 New Holland TT4.90 4WD Openstation',valuationExVat:459000})));
 const questionFits=async n=>{
   await page.waitForFunction(n=>document.querySelector('[aria-label="Question '+n+' of 5"]'),{},n);
   assert(await page.$eval('[aria-label="Question '+n+' of 5"]',el=>el.scrollHeight<=el.clientHeight+1),'Question '+n+' should fit without scrolling');
 };
 await questionFits(1);
 await page.screenshot({path:'/tmp/saleability-spacing-question.png'});
 await page.$$eval('button',nodes=>nodes.find(n=>n.textContent.includes('Dealer / trade-in')).click());
 await questionFits(2);
 await page.$$eval('button',nodes=>nodes.find(n=>n.querySelector('strong')?.textContent==='Within 30 days').click());
 await questionFits(3);
 assert.equal(await page.$$eval('[aria-label="Question 3 of 5"] [aria-pressed="true"]',nodes=>nodes.length),0,'Selling area requires an explicit choice');
 await click('Near me');
 await questionFits(4);
 await page.$$eval('button',nodes=>nodes.find(n=>n.textContent.startsWith('Normal')).click());
 await questionFits(5);
 await click('Several');
 await page.waitForSelector('[role="meter"]');
 await page.screenshot({path:'/tmp/saleability-spacing-result.png'});
 assert(await page.$eval('[aria-label="Your selling estimate"]',el=>el.scrollHeight<=el.clientHeight+1),'Result should fit a compact desktop viewport');
 await page.screenshot({path:'/tmp/saleability-spacing-result.png'});
 assert(!Object.keys(modules).some(name=>name.includes('server/saleability')));

// Save review: skip, cancel, finish assessment, and invalidate after editing.
 await page.evaluate(()=>window.root.render(React.createElement(require('save-fixture').default)));
 await click('Save asset');assert.deepEqual(errors,[], 'Save entry must not throw before opening the prompt');await page.waitForSelector('#market-save-title');
 await click('Save with Ideal Value only');await page.waitForSelector('output');
 assert.equal(await page.$eval('output',el=>el.dataset.photoMode),'skip');
 await page.evaluate(()=>require('lib/estimate-photo-handoff').setEstimatePhotoFiles([new File(['fixture'],'asset.png',{type:'image/png'})]));

 await click('Save asset');assert.deepEqual(errors,[], 'Save entry must not throw before opening the prompt');await page.waitForSelector('#market-save-title');
 await click('Calculate market value');await page.waitForSelector('[aria-label="Question 1 of 5"]');
 await page.click('[aria-label="Close Realistic Market Value"]');await page.waitForSelector('#market-save-title');
 await click('Calculate market value');await page.waitForSelector('[aria-label="Question 1 of 5"]');
 await page.$$eval('button',nodes=>nodes.find(n=>n.textContent.includes('Dealer / trade-in')).click());
 await page.waitForSelector('[aria-label="Question 2 of 5"]');
 await page.$$eval('button',nodes=>nodes.find(n=>n.querySelector('strong')?.textContent==='Within 30 days').click());
 await page.waitForSelector('[aria-label="Question 3 of 5"]');await click('Near me');
 await page.waitForSelector('[aria-label="Question 4 of 5"]');await page.$$eval('button',nodes=>nodes.find(n=>n.textContent.startsWith('Normal')).click());
 await page.waitForSelector('[aria-label="Question 5 of 5"]');await click('Several');
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Done'&&!b.disabled));
 await click('Done');await page.waitForSelector('output');
 assert.equal(await page.$eval('output',el=>el.dataset.photoCount),'1');
 assert.equal(await page.$eval('output',el=>el.dataset.photoMode),'files');
 await click('Save asset');assert.equal(await page.$('#market-save-title'),null,'Current assessment skips prompt');
 await click('Change estimate');await click('Save asset');await page.waitForSelector('#market-save-title');
 await page.setViewport({width:1366,height:768});
 await page.screenshot({path:'/tmp/market-save-prompt.png'});
 assert(await page.$eval('[aria-labelledby="market-save-title"]',el=>el.scrollHeight<=el.clientHeight+1));
 await page.setViewport({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert(await page.$eval('[aria-labelledby="market-save-title"]',el=>el.scrollHeight<=el.clientHeight+1),'Prompt fits a phone without scrolling');
 await page.screenshot({path:'/tmp/market-save-prompt-mobile.png'});
 await page.addStyleTag({content:fs.readFileSync(path.join(root,'public/app-theme.css'),'utf8')});
 await page.evaluate(()=>document.documentElement.dataset.appTheme='dark');
 await page.setViewport({width:1366,height:768});
 await page.mouse.move(0,0);
 await page.waitForFunction(()=>{const button=document.querySelector('[aria-labelledby="market-save-title"] button:nth-child(1)');return [...document.querySelectorAll('[aria-labelledby="market-save-title"] button')].filter(b=>b.querySelector('strong')).every(b=>getComputedStyle(b).backgroundColor.match(/rgb\((\d+)/)?.[1]<60);});
 await page.screenshot({path:'/tmp/market-save-prompt-dark.png'});
 // The valuation summary receives the server quote when Done is clicked.
 await page.evaluate(()=>{
   window.fetch=async()=>({ok:true,json:async()=>({quote:{priceExVat:390000,resultLabel:'Estimated selling price',modelVersion:'saleability-2.0',ease:{score:72,version:'fixture-ease',provisional:false}}})});
   window.root.render(React.createElement(require('components/SaleabilityModal').default,{key:'completion-quote',estimateStyle:true,open:true,onClose:()=>{},assetTitle:'Test asset',valuationExVat:459000,input:{condition:'good',lifeWorkedPercent:50},initialAnswers:window.sent,onComplete:(answers,quote)=>{window.completedQuote=quote;window.completedAnswers=answers;}}));
 });
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Done'&&!b.disabled));
 await page.evaluate(()=>document.documentElement.dataset.appTheme='light');
 await page.setViewport({width:1366,height:900});
 await page.waitForSelector('[aria-label="Your selling estimate"]');
 assert(await page.$eval('[aria-label="Your selling estimate"]',el=>el.scrollHeight<=el.clientHeight+2),'Value Asset result fits without an internal scrollbar');
 await page.screenshot({path:'/tmp/value-market-result.png'});
 await click('Done');
 assert.equal(await page.evaluate(()=>window.completedQuote.priceExVat),390000);
 assert.equal(await page.evaluate(()=>window.completedAnswers.modelVersion),2);
 assert.deepEqual(errors,[]);console.log('PASS all three price views, replacement actions, independent VAT, empty states, mobile fit and save retry');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
